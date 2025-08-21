export function parseGcsUri(uri: string): { bucket: string; object: string } {
  if (!uri.startsWith("gs://")) throw new Error("Invalid GCS URI");
  const without = uri.slice(5);
  const slash = without.indexOf("/");
  if (slash <= 0) throw new Error("Invalid GCS URI");
  const bucket = without.slice(0, slash);
  const object = without.slice(slash + 1);
  return { bucket, object };
}


