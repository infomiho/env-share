import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex')
const X25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex')
const HKDF_INFO = Buffer.from('env-share-ecies')
const RAW_KEY_LENGTH = 32

function toX25519PublicKeyObject(raw: Buffer) {
  return crypto.createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  })
}

function toX25519PrivateKeyObject(raw: Buffer) {
  return crypto.createPrivateKey({
    key: Buffer.concat([X25519_PKCS8_PREFIX, raw]),
    format: 'der',
    type: 'pkcs8',
  })
}

function deriveSharedKey(privateKey: crypto.KeyObject, publicKey: crypto.KeyObject): Buffer {
  const sharedSecret = crypto.diffieHellman({ privateKey, publicKey })
  const derived = crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), HKDF_INFO, RAW_KEY_LENGTH)
  return Buffer.from(derived)
}

function aesGcmEncrypt(plaintext: Buffer, key: Buffer): { iv: Buffer; authTag: Buffer; ciphertext: Buffer } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { iv, authTag: cipher.getAuthTag(), ciphertext }
}

function aesGcmDecrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519')
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).subarray(-RAW_KEY_LENGTH),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-RAW_KEY_LENGTH),
  }
}

export function eciesEncrypt(data: Buffer, recipientPublicKey: Buffer): string {
  const ephemeral = crypto.generateKeyPairSync('x25519')
  const ephemeralPublicRaw = ephemeral.publicKey.export({ type: 'spki', format: 'der' }).subarray(-RAW_KEY_LENGTH)

  const derivedKey = deriveSharedKey(ephemeral.privateKey, toX25519PublicKeyObject(recipientPublicKey))
  const { iv, authTag, ciphertext } = aesGcmEncrypt(data, derivedKey)

  return Buffer.concat([ephemeralPublicRaw, iv, authTag, ciphertext]).toString('base64')
}

export function eciesDecrypt(envelope: string, privateKeyRaw: Buffer): Buffer {
  const buf = Buffer.from(envelope, 'base64')
  const ephemeralPublicRaw = buf.subarray(0, 32)
  const iv = buf.subarray(32, 44)
  const authTag = buf.subarray(44, 60)
  const ciphertext = buf.subarray(60)

  const derivedKey = deriveSharedKey(toX25519PrivateKeyObject(privateKeyRaw), toX25519PublicKeyObject(ephemeralPublicRaw))
  return aesGcmDecrypt(ciphertext, derivedKey, iv, authTag)
}

export function aesEncrypt(data: Buffer, key: Buffer): string {
  const { iv, authTag, ciphertext } = aesGcmEncrypt(data, key)
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function aesDecrypt(envelope: string, key: Buffer): Buffer {
  const buf = Buffer.from(envelope, 'base64')
  return aesGcmDecrypt(buf.subarray(28), key, buf.subarray(0, 12), buf.subarray(12, 28))
}

const KEY_DIR = path.join(os.homedir(), '.env-share', 'keys')

export function getPrivateKeyPath(serverHost: string): string {
  return path.join(KEY_DIR, `${serverHost}.key`)
}

export function savePrivateKey(serverHost: string, privateKeyRaw: Buffer) {
  fs.mkdirSync(KEY_DIR, { recursive: true })
  fs.writeFileSync(getPrivateKeyPath(serverHost), privateKeyRaw.toString('base64'), { mode: 0o600 })
}

export function loadPrivateKey(serverHost: string): Buffer {
  const keyPath = getPrivateKeyPath(serverHost)
  if (!fs.existsSync(keyPath)) {
    throw new Error(`No private key found for ${serverHost}. Run 'env-share login' first.`)
  }
  return Buffer.from(fs.readFileSync(keyPath, 'utf-8').trim(), 'base64')
}

export function generateProjectKey(): Buffer {
  return crypto.randomBytes(RAW_KEY_LENGTH)
}
