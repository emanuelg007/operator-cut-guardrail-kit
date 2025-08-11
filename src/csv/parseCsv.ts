import { detectDialect } from './detectDialect'

// very tolerant, tiny parser for demo wiring only
export async function parseCsv(file: File): Promise<any[]> {
  const text = await file.text()
  const { delimiter } = detectDialect(text)
  const [headerLine, ...rest] = text.split(/\r?\n/).filter(Boolean)
  if (!headerLine) return []
  const headers = headerLine.split(delimiter).map(h => h.trim())
  const rows = rest.map(line => {
    const cols = line.split(delimiter)
    const obj: Record<string,string> = {}
    headers.forEach((h, i) => obj[h] = (cols[i] ?? '').trim())
    return obj
  })
  return rows
}
