import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function getS3Client() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
  });
  return { bucket, client, publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "") };
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!ENV.manusIntegrationsEnabled || !forgeUrl || !forgeKey) return null;
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3 = getS3Client();
  if (s3) {
    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));
    const url = s3.publicBaseUrl
      ? `${s3.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`
      : await getSignedUrl(s3.client, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: 3600 });
    return { key, url };
  }

  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage is not configured. Set S3_* variables or enable Manus Forge integrations.");
  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Forge storage presign failed (${presignResp.status})`);
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType }),
  });
  if (!uploadResp.ok) throw new Error(`Storage upload to Forge S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (s3) {
    if (s3.publicBaseUrl) return `${s3.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
    return getSignedUrl(s3.client, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: 3600 });
  }
  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage is not configured. Set S3_* variables or enable Manus Forge integrations.");
  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!resp.ok) throw new Error(`Forge storage signed URL failed (${resp.status})`);
  const { url } = (await resp.json()) as { url: string };
  return url;
}
