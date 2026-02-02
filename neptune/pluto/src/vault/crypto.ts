import crypto from "crypto";

const ALGO = "aes-256-gcm";

// 32 bytes key (base64 in env)
export function getKey(): Buffer {
  const b64 = process.env.PLUTO_MASTER_KEY_B64;
  if (!b64) throw new Error("Missing PLUTO_MASTER_KEY_B64");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("PLUTO_MASTER_KEY_B64 must decode to 32 bytes");
  return key;
}

export function encryptJson(obj: unknown) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv_b64: iv.toString("base64"),
    tag_b64: tag.toString("base64"),
    ct_b64: ciphertext.toString("base64"),
    v: 1
  };
}

export function decryptJson(blob: { iv_b64: string; tag_b64: string; ct_b64: string; v: number }) {
  const key = getKey();
  const iv = Buffer.from(blob.iv_b64, "base64");
  const tag = Buffer.from(blob.tag_b64, "base64");
  const ct = Buffer.from(blob.ct_b64, "base64");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
