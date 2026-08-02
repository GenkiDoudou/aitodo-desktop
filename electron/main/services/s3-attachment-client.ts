import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import type { AttachmentS3PublicConfig } from '@shared/attachment-storage'
import { validateS3PublicConfig } from '@shared/attachment-storage'
import type { S3Secrets } from '../s3-credentials'

export type S3ClientConfig = AttachmentS3PublicConfig & S3Secrets

function buildClient(cfg: S3ClientConfig): S3Client {
  return new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region?.trim() || 'us-east-1',
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey
    },
    forcePathStyle: true
  })
}

/** 测试连接：校验公共配置 + HeadBucket（或等价探测） */
export async function testS3Connection(cfg: S3ClientConfig): Promise<void> {
  const err = validateS3PublicConfig(cfg)
  if (err) throw new Error(err)
  if (!cfg.accessKey?.trim() || !cfg.secretKey?.trim()) {
    throw new Error('请填写 AccessKey 与 Secret')
  }
  const client = buildClient(cfg)
  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }))
  } finally {
    client.destroy()
  }
}

export async function uploadS3Object(
  cfg: S3ClientConfig,
  objectKey: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  const client = buildClient(cfg)
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType || 'application/octet-stream'
      })
    )
  } finally {
    client.destroy()
  }
}

export async function downloadS3Object(cfg: S3ClientConfig, objectKey: string): Promise<Buffer> {
  const client = buildClient(cfg)
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey
      })
    )
    const bytes = await out.Body?.transformToByteArray()
    if (!bytes) throw new Error('S3 对象为空')
    return Buffer.from(bytes)
  } finally {
    client.destroy()
  }
}
