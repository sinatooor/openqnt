import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/utils/crypto.js';

const TEST_KEY = 'test-encryption-key-32-chars-ok!';

describe('AES-256-GCM Crypto', () => {
    it('encrypts and decrypts a string correctly', () => {
        const plaintext = 'my-super-secret-api-key-12345';
        const encrypted = encrypt(plaintext, TEST_KEY);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for the same input (random IV)', () => {
        const plaintext = 'same-plaintext';
        const a = encrypt(plaintext, TEST_KEY);
        const b = encrypt(plaintext, TEST_KEY);
        expect(a).not.toBe(b); // Different IVs → different ciphertexts
        expect(decrypt(a, TEST_KEY)).toBe(plaintext);
        expect(decrypt(b, TEST_KEY)).toBe(plaintext);
    });

    it('fails to decrypt with wrong key', () => {
        const plaintext = 'sensitive-data';
        const encrypted = encrypt(plaintext, TEST_KEY);
        const wrongKey = 'wrong-key-32-chars-long-ok-here!';
        expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('handles empty string', () => {
        const plaintext = '';
        const encrypted = encrypt(plaintext, TEST_KEY);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe('');
    });

    it('handles unicode characters', () => {
        const plaintext = '🔑 My key with émojis and ñ characters';
        const encrypted = encrypt(plaintext, TEST_KEY);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe(plaintext);
    });
});
