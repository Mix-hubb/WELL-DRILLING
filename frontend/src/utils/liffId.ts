export function sanitizeLiffId(raw: unknown): string {
  if (raw == null) return "";
  const value = (Array.isArray(raw) ? String(raw[0] ?? "") : String(raw)).trim();
  if (!value) return "";

  const fromUrl = value.match(/liff\.line\.me\/([^/?#]+)/i);
  if (fromUrl?.[1]) return fromUrl[1].trim();

  return value.split("/")[0].split("?")[0].split("#")[0].trim();
}
