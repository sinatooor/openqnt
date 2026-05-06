"""Audio format bridge between Twilio Media Streams and Gemini Live.

Twilio sends μ-law 8 kHz mono in 20 ms frames (160 samples = 320 bytes ulaw).
Gemini Live accepts 16 kHz PCM16 input and emits 24 kHz PCM16 output.

We do the conversion in two steps: μ-law ↔ PCM16 via `audioop` (built-in,
G.711 standard), then linear sample-rate conversion via `audioop.ratecv`.
`audioop` is deprecated in 3.13+ but still present; fallback path uses numpy
linear interpolation if it's ever removed.
"""

from __future__ import annotations

import math
from typing import Tuple

try:  # audioop is built-in through 3.12 and slated for removal in 3.13
    import audioop  # type: ignore
    _HAS_AUDIOOP = True
except ImportError:  # pragma: no cover
    _HAS_AUDIOOP = False
    import numpy as np

ULAW_RATE = 8000
PCM16_GEMINI_IN_RATE = 16000
PCM16_GEMINI_OUT_RATE = 24000

_BIAS = 0x84
_CLIP = 32635


def _ulaw_to_linear_table() -> bytes:
    """Build a 256-entry μ-law → 16-bit linear lookup, used in the numpy fallback."""
    out = bytearray()
    for i in range(256):
        ulaw = ~i & 0xFF
        sign = ulaw & 0x80
        exponent = (ulaw >> 4) & 0x07
        mantissa = ulaw & 0x0F
        sample = ((mantissa << 3) + _BIAS) << exponent
        sample -= _BIAS
        if sign:
            sample = -sample
        out += int(sample).to_bytes(2, "little", signed=True)
    return bytes(out)


_ULAW_LUT = _ulaw_to_linear_table() if not _HAS_AUDIOOP else None


def ulaw_to_pcm16(ulaw_bytes: bytes) -> bytes:
    """Decode μ-law 8 kHz bytes → PCM16 little-endian 8 kHz bytes."""
    if _HAS_AUDIOOP:
        return audioop.ulaw2lin(ulaw_bytes, 2)
    # numpy fallback
    arr = np.frombuffer(ulaw_bytes, dtype=np.uint8)
    lut = np.frombuffer(_ULAW_LUT, dtype=np.int16)
    return lut[arr].tobytes()


def pcm16_to_ulaw(pcm_bytes: bytes) -> bytes:
    """Encode PCM16 LE 8 kHz → μ-law 8 kHz."""
    if _HAS_AUDIOOP:
        return audioop.lin2ulaw(pcm_bytes, 2)
    # numpy fallback — straightforward G.711 encoder
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.int32)
    sign = (samples >> 8) & 0x80
    samples = np.where(sign != 0, -samples, samples)
    samples = np.clip(samples, 0, _CLIP) + _BIAS
    exponent = np.zeros_like(samples)
    mask = samples >= 0x100
    while np.any(mask) and np.max(exponent[mask]) < 7:
        exponent[mask] += 1
        samples[mask] >>= 1
        mask = (samples >= 0x100) & (exponent < 7)
    mantissa = (samples >> 4) & 0x0F
    encoded = ~(sign | (exponent << 4) | mantissa) & 0xFF
    return encoded.astype(np.uint8).tobytes()


_resample_state: dict[Tuple[int, int, int], object] = {}


def resample_pcm16(
    pcm_bytes: bytes,
    src_rate: int,
    dst_rate: int,
    state_key: Tuple[int, int, int] | None = None,
) -> bytes:
    """Resample 16-bit mono PCM between two sample rates.

    `state_key` lets the caller maintain `audioop.ratecv` state across chunks
    (essential — without it you get clicks at every chunk boundary).
    """
    if src_rate == dst_rate:
        return pcm_bytes
    if _HAS_AUDIOOP:
        prev_state = _resample_state.get(state_key) if state_key is not None else None
        converted, new_state = audioop.ratecv(
            pcm_bytes, 2, 1, src_rate, dst_rate, prev_state
        )
        if state_key is not None:
            _resample_state[state_key] = new_state
        return converted
    # numpy linear-interp fallback (no state — adequate for most clean inputs)
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
    if samples.size == 0:
        return b""
    duration = samples.size / src_rate
    new_count = max(1, int(math.ceil(duration * dst_rate)))
    src_idx = np.linspace(0, samples.size - 1, new_count)
    floor_idx = np.floor(src_idx).astype(np.int64)
    ceil_idx = np.minimum(floor_idx + 1, samples.size - 1)
    frac = src_idx - floor_idx
    interp = samples[floor_idx] * (1 - frac) + samples[ceil_idx] * frac
    return np.clip(interp, -32768, 32767).astype(np.int16).tobytes()


def reset_resample_state(state_key: Tuple[int, int, int]) -> None:
    """Drop accumulated ratecv state for a finished call."""
    _resample_state.pop(state_key, None)
