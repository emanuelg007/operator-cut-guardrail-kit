// src/csv/parseCsv.ts
export function parseCsv(text: string): { headers: string[]; rows: string[][]; delimiter: string } {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delim = [",",";","|","\\t"].map(d => d === "\\t" ? "\t" : d)
    .reduce((best, d) => (firstLine.split(d).length > (firstLine.split(best).length)) ? d : best, ",");
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const headers = (lines.shift() || "").split(delim).map(s => s.trim());
  const rows = lines.map(l => l.split(delim).map(s => s.trim()));
  return { headers, rows, delimiter: delim === "\t" ? "\\t" : delim };
}
