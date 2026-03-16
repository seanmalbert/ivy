import { describe, it, expect } from "vitest";
import {
  importMasterKey,
  deriveEncryptionKey,
  encrypt,
  decrypt,
  generateSalt,
  toBase64,
  fromBase64,
} from "./encryption.js";

describe("toBase64 / fromBase64", () => {
  it("round-trips a Uint8Array", () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const encoded = toBase64(original);
    const decoded = fromBase64(encoded);
    expect(decoded).toEqual(original);
  });

  it("round-trips an ArrayBuffer", () => {
    const original = new Uint8Array([10, 20, 30]).buffer;
    const encoded = toBase64(original);
    const decoded = fromBase64(encoded);
    expect(decoded).toEqual(new Uint8Array(original));
  });

  it("round-trips empty data", () => {
    const original = new Uint8Array([]);
    const encoded = toBase64(original);
    expect(encoded).toBe("");
    const decoded = fromBase64(encoded);
    expect(decoded).toEqual(original);
  });

  it("produces valid base64 characters", () => {
    const data = crypto.getRandomValues(new Uint8Array(100));
    const encoded = toBase64(data);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });
});

describe("generateSalt", () => {
  it("generates salt of default length", () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
  });

  it("generates salt of custom length", () => {
    const salt = generateSalt(16);
    expect(salt.length).toBe(16);
  });

  it("generates unique salts", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(toBase64(a)).not.toBe(toBase64(b));
  });
});

describe("encrypt / decrypt round-trip", () => {
  async function makeKey() {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const master = await importMasterKey(keyBytes);
    const salt = generateSalt();
    return deriveEncryptionKey(master, salt, "test");
  }

  it("encrypts and decrypts a simple string", async () => {
    const key = await makeKey();
    const plaintext = "Hello, Ivy!";
    const { ciphertext, iv } = await encrypt(key, plaintext);
    const result = await decrypt(key, ciphertext, iv);
    expect(result).toBe(plaintext);
  });

  it("encrypts and decrypts unicode text", async () => {
    const key = await makeKey();
    const plaintext = "Benefits: SNAP, Medicaid — $1,200/mo 🏠";
    const { ciphertext, iv } = await encrypt(key, plaintext);
    const result = await decrypt(key, ciphertext, iv);
    expect(result).toBe(plaintext);
  });

  it("encrypts and decrypts empty string", async () => {
    const key = await makeKey();
    const { ciphertext, iv } = await encrypt(key, "");
    const result = await decrypt(key, ciphertext, iv);
    expect(result).toBe("");
  });

  it("produces different ciphertext for same plaintext (random IV)", async () => {
    const key = await makeKey();
    const a = await encrypt(key, "same text");
    const b = await encrypt(key, "same text");
    expect(toBase64(a.iv)).not.toBe(toBase64(b.iv));
    expect(toBase64(a.ciphertext)).not.toBe(toBase64(b.ciphertext));
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const { ciphertext, iv } = await encrypt(key1, "secret");
    await expect(decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });

  it("fails to decrypt with tampered ciphertext", async () => {
    const key = await makeKey();
    const { ciphertext, iv } = await encrypt(key, "secret");
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;
    await expect(decrypt(key, tampered.buffer, iv)).rejects.toThrow();
  });

  it("fails to decrypt with wrong IV", async () => {
    const key = await makeKey();
    const { ciphertext } = await encrypt(key, "secret");
    const wrongIv = crypto.getRandomValues(new Uint8Array(12));
    await expect(decrypt(key, ciphertext, wrongIv)).rejects.toThrow();
  });
});

describe("key derivation", () => {
  it("derives different keys from different salts", async () => {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const master = await importMasterKey(keyBytes);

    const key1 = await deriveEncryptionKey(master, generateSalt(), "test");
    const key2 = await deriveEncryptionKey(master, generateSalt(), "test");

    // Verify they're different by encrypting with one and failing to decrypt with other
    const { ciphertext, iv } = await encrypt(key1, "test data");
    await expect(decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });

  it("derives different keys from different info strings", async () => {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const master = await importMasterKey(keyBytes);
    const salt = generateSalt();

    const key1 = await deriveEncryptionKey(master, salt, "vault");
    const key2 = await deriveEncryptionKey(master, salt, "auth");

    const { ciphertext, iv } = await encrypt(key1, "test data");
    await expect(decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });

  it("derives same key from same inputs", async () => {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const salt = generateSalt();

    const master1 = await importMasterKey(keyBytes);
    const key1 = await deriveEncryptionKey(master1, salt, "test");

    const master2 = await importMasterKey(keyBytes);
    const key2 = await deriveEncryptionKey(master2, salt, "test");

    const { ciphertext, iv } = await encrypt(key1, "deterministic");
    const result = await decrypt(key2, ciphertext, iv);
    expect(result).toBe("deterministic");
  });
});
