/** Builds a CSV (Excel / Google Sheets friendly) and downloads it. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 names (e.g. "Nour El-Din") correctly.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
