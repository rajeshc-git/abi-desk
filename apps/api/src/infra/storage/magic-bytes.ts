/**
 * Server-side content-type detection from leading bytes.
 *
 * Never trusts a client-supplied `Content-Type` or file extension: both are
 * attacker-controlled, and a `.png` that is actually an HTML payload is a stored-XSS
 * vector the moment it is served back with the wrong header. The magic-byte check is
 * the only server-side signal that cannot be spoofed by renaming a file.
 *
 * Deliberately hand-written rather than a dependency (`file-type` was considered and
 * rejected): the widget accepts about ten formats, so the allow-list below - not
 * format detection in general - is the actual security control, and it has to be
 * written by hand regardless of what detects the bytes. `file-type`'s current major
 * is also ESM-only, which is friction against this API's CommonJS build for a
 * capability that reduces to matching a handful of fixed byte sequences.
 *
 * Each entry checks a signature at a fixed offset, which is how every real magic-byte
 * sniffer (`file(1)`, `file-type`, browsers' MIME sniffing) works. Reference:
 * https://en.wikipedia.org/wiki/List_of_file_signatures
 */

export interface DetectedType {
  mimeType: string;
  extension: string;
}

interface Signature {
  mimeType: string;
  extension: string;
  offset: number;
  bytes: readonly number[];
  /** Extra structural check beyond the fixed bytes (e.g. WebP's RIFF container). */
  extra?: (buf: Buffer) => boolean;
}

const SIGNATURES: readonly Signature[] = [
  {
    mimeType: 'image/png',
    extension: 'png',
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mimeType: 'image/jpeg', extension: 'jpg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/gif', extension: 'gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // Both WebP and WAV are RIFF containers, distinguished by the FourCC at offset 8.
  {
    mimeType: 'image/webp',
    extension: 'webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    extra: (buf) => buf.length >= 12 && buf.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mimeType: 'audio/wav',
    extension: 'wav',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    extra: (buf) => buf.length >= 12 && buf.subarray(8, 12).toString('ascii') === 'WAVE',
  },
  { mimeType: 'application/pdf', extension: 'pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  // EBML header. WebM audio and WebM video are byte-identical at the container level -
  // telling them apart needs a full track parse. Reported as `video/webm`; see
  // `isCompatibleType`, which is why a voice note declared `audio/webm` still passes.
  { mimeType: 'video/webm', extension: 'webm', offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mimeType: 'audio/ogg', extension: 'ogg', offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { mimeType: 'audio/mpeg', extension: 'mp3', offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3-tagged
  // MP3 with no ID3 tag starts directly with an 11-bit frame sync. The second byte
  // varies by MPEG version and layer, so the common values are listed individually.
  { mimeType: 'audio/mpeg', extension: 'mp3', offset: 0, bytes: [0xff, 0xfb] },
  { mimeType: 'audio/mpeg', extension: 'mp3', offset: 0, bytes: [0xff, 0xf3] },
  { mimeType: 'audio/mpeg', extension: 'mp3', offset: 0, bytes: [0xff, 0xf2] },
  {
    // MP4/MOV containers store their type in an "ftyp" box starting at offset 4,
    // not at the start of the file.
    mimeType: 'video/mp4',
    extension: 'mp4',
    offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70], // "ftyp"
  },
];

/**
 * The formats the widget and ticket attachments accept. Detecting a byte signature is
 * necessary but not sufficient - this is the actual allow-list a caller enforces.
 */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/webm',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
  'video/mp4',
  'text/plain',
  'text/csv',
  'application/json',
]);

/**
 * Types that a detected type may legitimately be recorded as.
 *
 * Exists for one real case: a WebM voice note is byte-identical to a WebM video, so a
 * browser that declares `audio/webm` is telling the truth even though the bytes only
 * prove `video/webm`. Treating that as a mismatch would reject every voice recording.
 *
 * Text is the other case - `text/csv` and `application/json` have no signature, so a
 * declared subtype is accepted over the detected `text/plain`. That is safe because
 * none of the three is ever served in a way a browser would execute.
 */
const COMPATIBLE_DECLARATIONS: Readonly<Record<string, readonly string[]>> = {
  'video/webm': ['audio/webm'],
  'text/plain': ['text/csv', 'application/json'],
};

/**
 * Whether a client's declared type is an acceptable label for bytes detected as
 * `detectedMime`. Exact matches always pass; anything else must be explicitly listed.
 */
export function isCompatibleType(detectedMime: string, declaredMime: string): boolean {
  if (detectedMime === declaredMime) return true;
  return (COMPATIBLE_DECLARATIONS[detectedMime] ?? []).includes(declaredMime);
}

/**
 * The type to persist: the client's declaration when it is a legitimate refinement of
 * what the bytes prove, otherwise the detected type. Never returns something outside
 * the allow-list.
 */
export function resolveStoredType(
  detected: DetectedType,
  declaredMime: string | undefined,
): string {
  if (
    declaredMime &&
    ALLOWED_MIME_TYPES.has(declaredMime) &&
    isCompatibleType(detected.mimeType, declaredMime)
  ) {
    return declaredMime;
  }

  return detected.mimeType;
}

function matches(buf: Buffer, sig: Signature): boolean {
  if (sig.bytes.length === 0) return false;
  if (buf.length < sig.offset + sig.bytes.length) return false;

  for (let i = 0; i < sig.bytes.length; i += 1) {
    if (buf[sig.offset + i] !== sig.bytes[i]) return false;
  }

  return sig.extra ? sig.extra(buf) : true;
}

/**
 * Text-like formats have no magic bytes: JSON, CSV and plain text are just their
 * content. These are accepted only for log/diagnostic exports, never for anything
 * that could be reflected back into a browser context as HTML, so the absence of a
 * signature is not a downgrade in safety - it is the correct classification.
 */
function looksLikeText(buf: Buffer): boolean {
  if (buf.length === 0) return true;

  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let controlBytes = 0;

  for (const byte of sample) {
    // Tab, LF, CR are fine; anything else below 0x20, or a null byte, indicates binary.
    if (byte === 0x00) return false;
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) controlBytes += 1;
  }

  return controlBytes / sample.length < 0.01;
}

/**
 * Detects a buffer's real content type from its leading bytes.
 *
 * Returns `null` when no known signature matches, rather than trusting the caller's
 * claim - `null` must be treated as "reject", never as "assume declared type".
 */
export function detectType(buffer: Buffer): DetectedType | null {
  for (const sig of SIGNATURES) {
    if (sig.bytes.length > 0 && matches(buffer, sig)) {
      return { mimeType: sig.mimeType, extension: sig.extension };
    }
  }

  if (looksLikeText(buffer)) {
    return { mimeType: 'text/plain', extension: 'txt' };
  }

  return null;
}

/**
 * Detects and enforces the allow-list in one call - the operation every upload path
 * actually needs, so the two checks cannot accidentally be split apart.
 */
export function detectAllowedType(buffer: Buffer): DetectedType | null {
  const detected = detectType(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mimeType)) return null;
  return detected;
}
