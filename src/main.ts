import { eventBus } from './core/eventBus'
import { Events } from './core/events'
import { parseCsv } from './csv/parseCsv'

const logEl = document.getElementById('log')!
const btn = document.getElementById('importBtn') as HTMLButtonElement

function log(line: string) {
  const time = new Date().toLocaleTimeString()
  logEl.textContent += `\n[${time}] ${line}`
}

btn.addEventListener('click', () => {
  eventBus.emit(Events.csvChooseFile)
})

let fileInput: HTMLInputElement | null = null

eventBus.on(Events.csvChooseFile, () => {
  if (!fileInput) {
    fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.csv,text/csv'
    fileInput.style.display = 'none'
    document.body.appendChild(fileInput)
    fileInput.addEventListener('change', async () => {
      const file = fileInput!.files?.[0]
      if (!file) return
      eventBus.emit(Events.csvFileSelected, file)
      try {
        const rows = await parseCsv(file)
        eventBus.emit(Events.csvParsed, rows)
      } catch (err) {
        console.error(err)
        log('CSV parse failed (see console).')
      } finally {
        fileInput!.value = ''
      }
    })
  }
  fileInput.click()
})

eventBus.on<File>(Events.csvFileSelected, (file) => {
  log(`Selected file: ${file.name} (${file.size} bytes)`)
})

eventBus.on<any[]>(Events.csvParsed, (rows) => {
  log(`Parsed rows: ${rows.length}`)
})
