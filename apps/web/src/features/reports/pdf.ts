import { periodLabel, type PerformanceWeights, type PeriodType } from '@dm/shared'
import type { ReportView } from './model'

/**
 * Downloads the report as a PDF with the same sections as the screen. jsPDF is loaded only
 * when needed, so it doesn't slow down the rest of the app.
 */
export async function downloadReportPdf(
  report: ReportView,
  {
    type,
    key,
    shopName,
    weights,
  }: { type: PeriodType; key: string; shopName: string; weights: PerformanceWeights },
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const title = `${type === 'weekly' ? 'Weekly' : 'Monthly'} report · ${periodLabel(type, key)}`
  const s = report.summary
  const green: [number, number, number] = [22, 61, 46]

  pdf.setFontSize(18).text(shopName, 40, 50)
  pdf.setFontSize(12).setTextColor(90).text(title, 40, 70)
  pdf
    .setFontSize(9)
    .text(
      `Generated ${new Date().toLocaleString('en-GB')} by Digital Manager · rule-based, no AI`,
      40,
      86,
    )
  pdf.setTextColor(0)

  autoTable(pdf, {
    startY: 104,
    head: [
      [
        'Avg score',
        'Attendance',
        'Late arrivals',
        'Absences',
        'Tasks done',
        'Tasks missed',
        'Stock alerts',
      ],
    ],
    body: [
      [
        s.averageScore ?? '—',
        `${s.attendancePct}%`,
        s.lateArrivals,
        s.absences,
        s.tasksCompleted,
        s.tasksMissed,
        s.inventoryAlerts,
      ],
    ],
    headStyles: { fillColor: green },
    styles: { halign: 'center' },
  })

  const h = report.highlights
  const lines = [
    h.top && `Top performer: ${h.top.employee.name} (${h.top.score}/100)`,
    h.improved && `Most improved: ${h.improved.employee.name} (+${h.improved.delta} points)`,
    h.attention &&
      `Needs attention: ${h.attention.employee.name} (${h.attention.score}/100)${h.attention.weakest ? ` — lowest on ${h.attention.weakest}` : ''}`,
  ].filter(Boolean) as string[]
  let y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
  pdf.setFontSize(12).text('Highlights', 40, y)
  pdf.setFontSize(10)
  lines.forEach((line, i) => pdf.text(`• ${line}`, 48, y + 18 + i * 15))
  y += 30 + lines.length * 15

  autoTable(pdf, {
    startY: y,
    head: [
      [
        'Employee',
        'Position',
        'Score',
        'Attendance',
        'Tasks done',
        'Missed',
        'Late',
        'Manager comment',
      ],
    ],
    body: report.rows.map((r) => [
      r.employee.name,
      r.employee.position,
      r.score,
      `${r.attendancePct}%`,
      r.tasksDone,
      r.tasksMissed,
      r.lateArrivals,
      r.comment ?? '',
    ]),
    headStyles: { fillColor: green },
    columnStyles: { 7: { cellWidth: 140 } },
    styles: { fontSize: 9 },
  })

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
  pdf.setFontSize(8).setTextColor(110)
  pdf.text(
    `Score = ${pct(weights.attendance)} attendance + ${pct(weights.punctuality)} punctuality + ${pct(weights.tasks)} tasks completed on time + ${pct(weights.manager)} manager rating (weights from Settings; unrated parts are left out and the rest rescaled).`,
    40,
    y,
    { maxWidth: 515 },
  )
  pdf.save(`digital-manager-${type}-${key}.pdf`)
}

const pct = (w: number) => `${Math.round(w * 100)}%`
