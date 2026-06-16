export function normCol(c: string): string {
  return c
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/[^a-z0-9]+/g, '');
}

export function asFloat(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '' || /^(na|nan|none|null)$/i.test(s)) return null;
  const f = parseFloat(s);
  return Number.isNaN(f) ? null : f;
}

export function asInt(v: unknown): number | null {
  const f = asFloat(v);
  return f === null ? null : Math.round(f);
}

/** Resolve a row value using config column alias lists (first match wins). */
export function pickColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  if (!row || aliases.length === 0) return undefined;
  const normMap: Record<string, string> = {};
  for (const col of Object.keys(row)) {
    normMap[normCol(col)] = col;
  }
  // First pass: exact normalized match
  for (const alias of aliases) {
    const key = normMap[normCol(alias)];
    if (key !== undefined && row[key] !== undefined && row[key] !== '') {
      return row[key];
    }
  }
  // Second pass: normalized substring match
  for (const alias of aliases) {
    const nc = normCol(alias);
    const matchedKey = Object.keys(row).find((c) => normCol(c).includes(nc));
    if (matchedKey !== undefined && row[matchedKey] !== undefined && row[matchedKey] !== '') {
      return row[matchedKey];
    }
  }
  return undefined;
}

export function findColumn(data: Record<string, unknown>[], aliases: string[]): string | null {
  if (!data?.length) return null;
  const columns = Object.keys(data[0]);
  const normMap: Record<string, string> = {};
  for (const col of columns) {
    normMap[normCol(col)] = col;
  }
  for (const alias of aliases) {
    const nc = normCol(alias);
    if (nc in normMap) return normMap[nc];
  }

  // Fallback: substring match
  for (const alias of aliases) {
    const nc = normCol(alias);
    const found = columns.find((c) => normCol(c).includes(nc));
    if (found) return found;
  }

  return null;
}

export function downsample<T>(points: T[], maxPoints = 8000): T[] {
  if (!points || points.length <= maxPoints) return points;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const result: T[] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  return result;
}
