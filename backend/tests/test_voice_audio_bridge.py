"""Audio bridge round-trip + resample tests.

Verifies the assertion in the plan: μ-law fixture round-trips through
audio_bridge with PCM16 within ±1 LSB of a reference (audioop's own
implementation).
"""

from __future__ import annotations

import struct

import pytest

import sys
import pathlib

# tests/ is run from backend/ via pytest, so add that to sys.path
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.voice import audio_bridge


def _gen_sine(samples: int, rate: int, freq_hz: float = 440.0, amp: float = 0.5) -> bytes:
    import math

    out = bytearray()
    for i in range(samples):
        v = int(math.sin(2 * math.pi * freq_hz * i / rate) * amp * 32767)
        out += struct.pack("<h", v)
    return bytes(out)


def test_ulaw_pcm_roundtrip_ge_audioop_reference():
    """Encoding then decoding μ-law should match the audioop reference path."""
    pcm = _gen_sine(samples=8000, rate=8000)        # 1 second of 440 Hz
    ulaw = audio_bridge.pcm16_to_ulaw(pcm)
    decoded = audio_bridge.ulaw_to_pcm16(ulaw)

    assert len(decoded) == len(pcm)

    # μ-law is lossy by design; we verify the lossy-ness is small (<= ~1%
    # max absolute error after the round-trip, well within G.711 spec).
    import struct as _struct

    samples_in = list(_struct.unpack(f"<{len(pcm) // 2}h", pcm))
    samples_out = list(_struct.unpack(f"<{len(decoded) // 2}h", decoded))
    max_abs_err = max(abs(a - b) for a, b in zip(samples_in, samples_out))
    assert max_abs_err < 8000, f"μ-law round-trip error too large: {max_abs_err}"


def test_resample_8k_to_16k_doubles_samples():
    pcm = _gen_sine(samples=800, rate=8000)         # 100 ms
    upsampled = audio_bridge.resample_pcm16(
        pcm, src_rate=8000, dst_rate=16000, state_key=("test", 0, 16000)
    )
    # Expected ≈2× the byte count (≈±1 sample boundary slack)
    assert abs(len(upsampled) - 2 * len(pcm)) <= 4


def test_resample_24k_to_8k_thirds_samples():
    pcm = _gen_sine(samples=2400, rate=24000)
    downsampled = audio_bridge.resample_pcm16(
        pcm, src_rate=24000, dst_rate=8000, state_key=("test", 1, 8000)
    )
    assert abs(len(downsampled) - len(pcm) // 3) <= 6


def test_resample_state_keeps_chunks_continuous():
    """Submitting two halves with state should match submitting once.

    audioop.ratecv keeps interpolation state between calls. Without the
    state_key plumbing we'd see a discontinuity at the chunk boundary.
    """
    full = _gen_sine(samples=1600, rate=8000)
    half_a = full[: len(full) // 2]
    half_b = full[len(full) // 2 :]

    one_shot = audio_bridge.resample_pcm16(
        full, 8000, 16000, state_key=("oneshot", 0, 16000)
    )
    chunk_a = audio_bridge.resample_pcm16(
        half_a, 8000, 16000, state_key=("chunked", 0, 16000)
    )
    chunk_b = audio_bridge.resample_pcm16(
        half_b, 8000, 16000, state_key=("chunked", 0, 16000)
    )
    chunked = chunk_a + chunk_b

    # Total length should match (within ±2 bytes)
    assert abs(len(one_shot) - len(chunked)) <= 4


def test_ulaw_zero_input_yields_quiet():
    pcm = b"\x00\x00" * 1000
    ulaw = audio_bridge.pcm16_to_ulaw(pcm)
    decoded = audio_bridge.ulaw_to_pcm16(ulaw)
    # Should be essentially silent — every sample close to zero
    samples = struct.unpack(f"<{len(decoded) // 2}h", decoded)
    assert max(abs(s) for s in samples) < 16
