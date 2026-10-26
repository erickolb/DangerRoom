import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';

export const coverPattern = /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/;
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export function storageConfig(env = process.env) {
  const mode = env.IMAGE_STORAGE || 'local';
  if (!['local', 's3'].includes(mode)) throw Error('IMAGE_STORAGE must be local or s3.');
  const bucket = env.S3_BUCKET || '';
  const prefix = (env.S3_PREFIX ?? 'dangerroom/covers').replace(/^\/+|\/+$/g, '');
  if (prefix.split('/').some(x => x === '.' || x === '..')) throw Error('S3_PREFIX cannot contain dot path segments.');
  if (mode === 's3' && (!bucket || !env.AWS_REGION)) throw Error('S3 storage requires S3_BUCKET and AWS_REGION.');
  return { mode, bucket, prefix, region: env.AWS_REGION };
}
export class S3Images {
  constructor(config, client) { this.config = config; this.client = client || new S3Client({ region: config.region }); }
  key(filename) { return [this.config.prefix, filename].filter(Boolean).join('/'); }
  async read(bucket, key) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(30000) });
    if (Number(response.ContentLength) > 25 * 1024 * 1024) throw Error('S3 cover exceeds size limit.');
    const chunks = []; let size = 0;
    for await (const chunk of response.Body) {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) throw Error('S3 cover exceeds size limit.');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async upload(filename, bytes) {
    if (!coverPattern.test(filename) || digest(bytes) !== filename.split('.')[0]) throw Error('Cover checksum does not match its filename.');
    const bucket = this.config.bucket, key = this.key(filename);
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes,
      ContentType: mime[filename.split('.')[1]], ChecksumSHA256: createHash('sha256').update(bytes).digest('base64') }),
    { abortSignal: AbortSignal.timeout(30000) });
    // Verify the actual stored bytes before changing the database location.
    if (digest(await this.read(bucket, key)) !== digest(bytes)) throw Error('S3 cover verification failed.');
    return { bucket, key };
  }
}
