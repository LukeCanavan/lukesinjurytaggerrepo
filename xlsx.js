import XLSX from 'xlsx'

export function exportWorkbook(events=[]) {
  const ws = XLSX.utils.json_to_sheet(events)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Events')
  return {
    write: (filepath) => XLSX.writeFile(wb, filepath)
  }
}
