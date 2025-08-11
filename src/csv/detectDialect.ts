export function detectDialect(sample: string): { delimiter: string } {
  const comma = (sample.match(/,/g) || []).length
  const semi = (sample.match(/;/g) || []).length
  return { delimiter: semi > comma ? ';' : ',' }
}
