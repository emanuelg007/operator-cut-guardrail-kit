export async function parseCsv(file: File | Blob): Promise<string[][]> {
  const text = await file.text();
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  return lines.map(line => {
    const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)|;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return parts.map(p => p.replace(/^"|"$/g, "").trim());
  });
}
