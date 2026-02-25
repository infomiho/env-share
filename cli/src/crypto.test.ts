import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  eciesEncrypt,
  eciesDecrypt,
  aesEncrypt,
  aesDecrypt,
  derivePublicKey,
  generateProjectKey,
} from "./crypto.js";

describe("generateKeyPair", () => {
  it("returns 32-byte public and private keys", () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(publicKey).toHaveLength(32);
    expect(privateKey).toHaveLength(32);
  });
});

describe("ECIES", () => {
  it("round-trips encrypt then decrypt", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const data = Buffer.from("secret-data");
    const encrypted = eciesEncrypt(data, publicKey);
    const decrypted = eciesDecrypt(encrypted, privateKey);
    expect(decrypted).toEqual(data);
  });

  it("throws with wrong private key", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const encrypted = eciesEncrypt(Buffer.from("data"), kp1.publicKey);
    expect(() => eciesDecrypt(encrypted, kp2.privateKey)).toThrow();
  });
});

describe("AES-256-GCM", () => {
  it("round-trips encrypt then decrypt", () => {
    const key = generateProjectKey();
    const data = Buffer.from("MY_SECRET=value");
    const encrypted = aesEncrypt(data, key);
    const decrypted = aesDecrypt(encrypted, key);
    expect(decrypted).toEqual(data);
  });

  it("throws with wrong key", () => {
    const encrypted = aesEncrypt(Buffer.from("data"), generateProjectKey());
    expect(() => aesDecrypt(encrypted, generateProjectKey())).toThrow();
  });
});

describe("derivePublicKey", () => {
  it("matches generateKeyPair output", () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(derivePublicKey(privateKey)).toEqual(publicKey);
  });
});

describe("generateProjectKey", () => {
  it("returns 32-byte buffer", () => {
    expect(generateProjectKey()).toHaveLength(32);
  });
});
