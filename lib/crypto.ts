import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
function getEncryptionKey(): Buffer {
  const value = process.env.ENCRYPTION_KEY

  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('ENCRYPTION_KEY trebuie să fie o cheie hexazecimală de 32 de bytes (64 de caractere).')
  }

  return Buffer.from(value, 'hex')
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, 'base64')
  const iv = buffer.subarray(0, 12)
  const authTag = buffer.subarray(12, 28)
  const encrypted = buffer.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

