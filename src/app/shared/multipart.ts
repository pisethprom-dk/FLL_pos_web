// v1.0.0 — a body for a multipart (file) upload. The generated client drops
// null fields from multipart, so a cleared link (no brand, no parent) would
// never reach the server. Sent as empty text instead, Django REST reads it as
// "none" for links and optional fields. Never use this for the file field
// itself — an empty file field clears the image.
export function forMultipart<T extends object>(body: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) out[key] = value === null ? '' : value;
  return out as T;
}
