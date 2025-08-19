/** RFC4180-ish CSV → array of objects (header row required). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur = "", row: string[] = [], inQ = false, i = 0;

  const pushCell = () => { row.push(cur); cur = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ",") { pushCell(); i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { pushCell(); pushRow(); i++; continue; }
    cur += ch; i++;
  }
  pushCell(); pushRow();

  const header = rows.shift() ?? [];
  const keys = header.map(h => h.trim());
  return rows
    .filter(r => r.length && r.some(c => c !== ""))
    .map(r => Object.fromEntries(keys.map((k, idx) => [k, (r[idx] ?? "").trim()])));
}


