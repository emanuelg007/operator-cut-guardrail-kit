export const Events = {
  csvChooseFile: 'csv:choose-file',
  csvFileSelected: 'csv:file-selected',
  csvParsed: 'csv:parsed',
} as const

export type EventName = typeof Events[keyof typeof Events]
