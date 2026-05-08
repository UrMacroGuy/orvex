import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const secret = process.env.ORVEX_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing ORVEX_ENCRYPTION_KEY");
  }
  return createHash("sha256").update(secret).digest();
}

export function maskKey(secret: string) {
  if (secret.length <= 8) {
    return `${secret.slice(0, 2)}***${secret.slice(-2)}`;
  }
  return `${secret.slice(0, 4)}***${secret.slice(-4)}`;
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(payload: {
  ciphertext: string;
  iv: string;
  authTag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
