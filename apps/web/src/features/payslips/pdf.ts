import type { Payslip } from '@cityreach/shared'
import { formatMoney } from '@/features/leave/model'
import { formatMinutes } from '@/lib/format'

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  )

/** The payslip as an A4 PDF (jsPDF is loaded only when a payslip is downloaded). */
export async function downloadPayslipPdf(slip: Payslip, shopName: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const brown: [number, number, number] = [110, 63, 39]

  pdf.setFontSize(18).text(shopName, 40, 50)
  pdf
    .setFontSize(13)
    .setTextColor(90)
    .text(`Payslip · ${monthLabel(slip.month)}`, 40, 72)
  pdf.setFontSize(11).setTextColor(0)
  pdf.text(`${slip.employeeName} · ${slip.position}`, 40, 96)
  pdf
    .setFontSize(9)
    .setTextColor(90)
    .text(
      slip.status === 'paid' && slip.paidAt
        ? `Paid on ${slip.paidAt.toLocaleDateString('en-GB')}${slip.paymentMethod ? ` by ${slip.paymentMethod}` : ''}${slip.paymentRef ? ` (ref ${slip.paymentRef})` : ''}`
        : 'Not paid yet',
      40,
      112,
    )
  pdf.setTextColor(0)

  const money = (n: number) => formatMoney(n)
  const earnings = [
    ['Basic salary', money(slip.salary)],
    ['Allowances', money(slip.allowances)],
    [
      `Overtime (${formatMinutes(slip.overtimeMinutes)} at 125 % of the hourly basic)`,
      money(slip.overtimePay),
    ],
    ['Bonus', money(slip.bonus)],
  ]
  const deductions = [
    [
      `Unpaid leave (${slip.unpaidLeaveDays} d) and absences (${slip.absentDays} d), salary ÷ 30 a day`,
      money(slip.leaveDeduction),
    ],
    [
      `Other deductions${slip.deductionNote ? `: ${slip.deductionNote}` : ''}`,
      money(slip.otherDeductions),
    ],
  ]
  const table = (startY: number, title: string, rows: string[][], total: string[]) =>
    autoTable(pdf, {
      startY,
      head: [[title, 'Amount']],
      body: rows,
      foot: [total],
      theme: 'grid',
      headStyles: { fillColor: brown },
      footStyles: { fillColor: [240, 235, 230], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 120 } },
    })
  table(130, 'Earnings', earnings, ['Gross pay', money(slip.gross)])
  const afterEarnings = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY
  table(afterEarnings + 16, 'Deductions', deductions, [
    'Total deductions',
    money(slip.leaveDeduction + slip.otherDeductions),
  ])
  const end = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  pdf.setFontSize(14).text(`Net pay: ${money(slip.net)}`, 40, end + 36)
  pdf
    .setFontSize(8)
    .setTextColor(120)
    .text('Prepared with City Reach. Figures from attendance and leave records.', 40, end + 56)
  pdf.save(`payslip_${slip.employeeName.replace(/\s+/g, '-')}_${slip.month}.pdf`)
}
