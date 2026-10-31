import {
  EXPENSE_CATEGORIES,
  expenseSchema,
  PAYMENT_METHODS,
  salesDaySchema,
  salesTotal,
  type Expense,
  type SalesDay,
} from '@dm/shared'
import { Receipt, Wallet } from 'lucide-react'
import { TonePill } from '@/components/common/StatusPill'
import type { RecordModule } from '@/features/records/components/RecordList'
import { formatDay, formatMoney } from '@/lib/format'

const amount = (v: unknown) => formatMoney(Number(v ?? 0))

/** Expenses: rent, utilities, supplies… with the VAT included (for the VAT return). */
export const expensesModule = (today: string): RecordModule<Expense> => ({
  coll: 'expenses',
  noun: 'expense',
  title: 'Expenses',
  description: 'Everything the shop pays for, with the VAT included.',
  icon: Receipt,
  schema: expenseSchema.pick({
    date: true,
    category: true,
    description: true,
    amount: true,
    vat: true,
    paymentMethod: true,
  }),
  fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      wide: true,
      placeholder: 'e.g. October rent',
    },
    { key: 'amount', label: 'Amount (AED, incl. VAT)', type: 'money', min: 0 },
    {
      key: 'vat',
      label: 'VAT included (AED)',
      type: 'money',
      min: 0,
      hint: '5 % of the amount before VAT; 0 if none.',
    },
    { key: 'paymentMethod', label: 'Paid by', type: 'select', options: PAYMENT_METHODS },
  ],
  defaults: () => ({ date: today, category: 'Supplies', vat: '0', paymentMethod: 'Card' }),
  columns: [
    { key: 'date', header: 'Date', cell: (r) => formatDay(r.date) },
    {
      key: 'what',
      header: 'Expense',
      className: 'whitespace-normal',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.description || r.category}</div>
          <div className="text-xs text-muted-foreground">{r.paymentMethod}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      className: 'hidden sm:table-cell',
      cell: (r) => <TonePill tone="neutral">{r.category}</TonePill>,
    },
    { key: 'amount', header: 'Amount', cell: (r) => amount(r.amount) },
    { key: 'vat', header: 'VAT', className: 'hidden md:table-cell', cell: (r) => amount(r.vat) },
  ],
  searchText: (r) => `${r.description} ${r.category}`,
  describe: (d) => `${String(d.category)} ${amount(d.amount)}`,
})

/** One row per day: takings by cash, card and delivery apps (entered at closing). */
export const salesModule = (today: string): RecordModule<SalesDay> => ({
  coll: 'salesDays',
  noun: 'day of sales',
  title: 'Daily sales',
  description: "Enter the day's takings at closing (from the till / card machine / delivery apps).",
  icon: Wallet,
  schema: salesDaySchema.pick({ date: true, cash: true, card: true, online: true, note: true }),
  fields: [
    { key: 'date', label: 'Date', type: 'date', wide: true },
    { key: 'cash', label: 'Cash (AED)', type: 'money', min: 0 },
    { key: 'card', label: 'Card (AED)', type: 'money', min: 0 },
    { key: 'online', label: 'Delivery apps / online (AED)', type: 'money', min: 0 },
    { key: 'note', label: 'Note', type: 'text', optional: true },
  ],
  defaults: () => ({ date: today, cash: '0', card: '0', online: '0' }),
  idFor: (d, branchId) => `${branchId}_${String(d.date)}`,
  columns: [
    { key: 'date', header: 'Date', cell: (r) => formatDay(r.date) },
    { key: 'cash', header: 'Cash', className: 'hidden sm:table-cell', cell: (r) => amount(r.cash) },
    { key: 'card', header: 'Card', className: 'hidden sm:table-cell', cell: (r) => amount(r.card) },
    {
      key: 'online',
      header: 'Online',
      className: 'hidden md:table-cell',
      cell: (r) => amount(r.online),
    },
    {
      key: 'total',
      header: 'Total',
      cell: (r) => <span className="font-medium">{formatMoney(salesTotal(r))}</span>,
    },
  ],
  searchText: (r) => `${r.date} ${r.note}`,
  describe: (d) =>
    `${String(d.date)} ${formatMoney(salesTotal(d as Pick<SalesDay, 'cash' | 'card' | 'online'>))}`,
})
