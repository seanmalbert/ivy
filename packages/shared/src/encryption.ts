/**
 * Client-side encryption utilities for the PII vault.
 * Uses Web Crypto API for AES-256-GCM encryption.
 * Argon2id key derivation would use libsodium.js (imported at runtime in extension).
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}

/** Derive an AES-256 key from raw key material using HKDF. */
export async function deriveEncryptionKey(
  masterKey: CryptoKey,
  salt: Uint8Array,
  info: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const derivedBits = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as BufferSource,
      info: encoder.encode(info) as BufferSource,
    },
    masterKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
  return derivedBits;
}

/** Import raw key bytes as a CryptoKey suitable for HKDF derivation. */
export async function importMasterKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HKDF" }, false, ["deriveKey"]);
}

/** Encrypt plaintext with AES-256-GCM. Returns ciphertext + IV. */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    key,
    encoder.encode(plaintext) as BufferSource
  );

  return { ciphertext, iv };
}

/** Decrypt AES-256-GCM ciphertext. */
export async function decrypt(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array
): Promise<string> {
  const decoder = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv: iv as BufferSource }, key, ciphertext);
  return decoder.decode(plaintext);
}

/** Generate a random salt for key derivation. */
export function generateSalt(length = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Encode bytes to base64 for storage/transport. */
export function toBase64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/** Decode base64 to bytes. */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
