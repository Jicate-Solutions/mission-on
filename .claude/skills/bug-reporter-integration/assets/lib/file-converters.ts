// Minimal data-URL <-> File helpers used by the widget + service.
// Copy to your app as `lib/utils/file-converters.ts`.

/** Convert a `data:<mime>;base64,...` string into a File (browser only). */
export function dataURLtoFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+);/);
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
