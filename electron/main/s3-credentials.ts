import { safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDefaultDataDir } from './data-path'

const CREDENTIALS_FILE = 's3-credentials.bin'

export interface S3Secrets {
  accessKey: string
  secretKey: string
}

function credentialsPath(): string {
  return path.join(getDefaultDataDir(), CREDENTIALS_FILE)
}

/** 读取本机 S3 密钥；不存在返回 null */
export function readS3Secrets(): S3Secrets | null {
  const file = credentialsPath()
  if (!fs.existsSync(file)) return null
  try {
    const buf = fs.readFileSync(file)
    const json =
      safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString('utf-8')
    const parsed = JSON.parse(json) as Partial<S3Secrets>
    if (typeof parsed.accessKey !== 'string' || typeof parsed.secretKey !== 'string') {
      return null
    }
    return { accessKey: parsed.accessKey, secretKey: parsed.secretKey }
  } catch {
    return null
  }
}

/** 写入本机 S3 密钥（优先 safeStorage 加密） */
export function saveS3Secrets(secrets: S3Secrets): void {
  const dir = getDefaultDataDir()
  fs.mkdirSync(dir, { recursive: true })
  const payload = JSON.stringify({
    accessKey: secrets.accessKey,
    secretKey: secrets.secretKey
  })
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(payload)
    : Buffer.from(payload, 'utf-8')
  fs.writeFileSync(credentialsPath(), data)
}

export function clearS3Secrets(): void {
  const file = credentialsPath()
  if (fs.existsSync(file)) {
    fs.unlinkSync(file)
  }
}

export function hasS3Secrets(): boolean {
  return readS3Secrets() != null
}
