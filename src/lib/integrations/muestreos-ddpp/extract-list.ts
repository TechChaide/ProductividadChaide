/**
 * Extrae un array desde respuestas del backend que a veces anidan
 * `data.data`, `recordset`, o entregan `data` directo.
 */
export function extractList<T>(res: unknown, depth = 0): T[] {
  if (Array.isArray(res)) return res as T[];
  if (!res || typeof res !== "object" || depth > 4) return [];

  if (typeof res === "string") {
    try {
      return extractList<T>(JSON.parse(res), depth + 1);
    } catch {
      return [];
    }
  }

  const obj = res as Record<string, unknown>;
  const keys = [
    "data",
    "payload",
    "body",
    "recordset",
    "rows",
    "items",
    "result",
    "results",
  ];
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
  }

  for (const key of keys) {
    const v = obj[key];
    if (v && typeof v === "object") {
      const nested = extractList<T>(v, depth + 1);
      if (nested.length > 0) return nested;
    }
  }

  const arrays = Object.values(obj).filter(Array.isArray) as unknown[][];
  if (arrays.length === 1) return arrays[0] as T[];
  if (arrays.length > 1) {
    arrays.sort((a, b) => b.length - a.length);
    return arrays[0] as T[];
  }

  return [];
}

export function pickRowField(
  row: Record<string, unknown>,
  names: string[],
): string {
  const entries = Object.entries(row);
  for (const name of names) {
    const want = name.toLowerCase();
    const found = entries.find(([k]) => k.toLowerCase() === want);
    if (found && found[1] != null && String(found[1]).trim()) {
      return String(found[1]).trim();
    }
  }
  return "";
}
