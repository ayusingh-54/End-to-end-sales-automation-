import { createHmac, createHash } from 'node:crypto';

// Minimal AWS SigV4 presign for Cloudflare R2 (S3-compatible).
// Avoids pulling the full @aws-sdk client for one call.

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}
function hex(b: Buffer): string {
  return b.toString('hex');
}

export interface PresignOpts {
  accessKeyId: string;
  secretAccessKey: string;
  accountId: string;
  bucket: string;
  key: string;
  expiresInSeconds: number;
}

export function presignR2GetUrl(opts: PresignOpts): string {
  const host = `${opts.bucket}.${opts.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const HH = String(now.getUTCHours()).padStart(2, '0');
  const MM = String(now.getUTCMinutes()).padStart(2, '0');
  const SS = String(now.getUTCSeconds()).padStart(2, '0');
  const date = `${yyyy}${mm}${dd}`;
  const amzDate = `${date}T${HH}${MM}${SS}Z`;
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const canonicalUri =
    '/' +
    opts.key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${opts.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(opts.expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  });
  // URLSearchParams encodes spaces as +; S3 wants %20. Re-encode:
  const canonicalQuery = params.toString().replace(/\+/g, '%20').split('&').sort().join('&');
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hex(createHash('sha256').update(canonicalRequest).digest()),
  ].join('\n');

  const kDate = hmac('AWS4' + opts.secretAccessKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hex(hmac(kSigning, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
