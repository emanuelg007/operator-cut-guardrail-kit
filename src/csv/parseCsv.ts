// src/csv/parseCsv.ts
export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
  delimiter: string;
} {
  // Strip BOM and normalize newlines
  let s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Keep lines, drop empty/whitespace-only
  const rawLines = s.split("\n");
  const lines = rawLines.filter((l) => l && l.trim().length > 0);

  const dialect = detectDialect(lines);
  if (!dialect) {
    return { headers: [], rows: [], delimiter: "," };
  }
  const { delimiter, headerIndex } = dialect;

  // Parse header
  const headerLine = lines[headerIndex];
  const headers = splitCsvLine(headerLine, delimiter).map((h) =>
    h.replace(/\uFEFF/g, "").replace(/\s+/g, " ").trim()
  );

  // Parse body
  const rows: string[][] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const fields = splitCsvLine(line, delimiter);

    // Normalize column count to header length
    if (fields.length < headers.length) {
      while (fields.length < headers.length) fields.push("");
    } else if (fields.length > headers.length) {
      fields.length = headers.length;
    }

    rows.push(fields.map((f) => f.trim()));
  }

  return { headers, rows, delimiter };
}

function detectDialect(
  lines: string[]
): { delimiter: string; headerIndex: number } | null {
  // Check first ~12 non-empty lines for the widest, sensible split
  const candidates = [";", ",", "\t", "|"];
  let best:
    | { delimiter: string; headerIndex: number; cols: number }
    | null = null;

  const maxCheck = Math.min(lines.length, 12);
  for (let i = 0; i < maxCheck; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const d of candidates) {
      const cols = splitCsvLine(line, d).length;
      // Prefer lines that split into 3+ columns, then widest
      const good = cols >= 2;
      if (good && (!best || cols > best.cols)) {
        best = { delimiter: d, headerIndex: i, cols };
      }
    }
  }

  if (!best) return null;
  return { delimiter: best.delimiter, headerIndex: best.headerIndex };
}

// CSV splitter that respects quotes and double-quotes
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Double quote inside quoted field -> literal quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}
