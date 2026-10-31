/**
 * Emulator seed for the operations, finance and HR modules (rota, checklists, incidents, food
 * safety, equipment, purchasing, finance, recruitment, feedback, training & goals), so every
 * screen, the dashboard's "Needs your attention" and the calendar have something to show.
 * Runs after the main seed; emulator only.
 */
import { addDays, COLLECTIONS, orderTotal, temperatureOk } from '@cityreach/shared'
import type { Firestore } from 'firebase-admin/firestore'

const MANAGER = { uid: 'hana', name: 'Hana Malek' }

export async function seedBusiness(
  db: Firestore,
  branchId: string,
  today: string,
  names: Record<string, string>,
) {
  const now = new Date()
  const writer = db.bulkWriter()
  const base = (by = MANAGER.uid) => ({
    branchId,
    createdBy: by,
    createdByName: names[by] ?? MANAGER.name,
    createdAt: now,
    updatedAt: now,
  })
  const put = (coll: string, id: string, data: Record<string, unknown>) =>
    void writer.set(db.collection(coll).doc(id), data)
  const day = (offset: number) => addDays(today, offset)

  // Owner of the branch (can open more branches); quarterly VAT; probation ending soon.
  void writer.update(db.collection(COLLECTIONS.branches).doc(branchId), {
    ownerId: MANAGER.uid,
    vat: { periodEnd: '2026-09-30', months: 3 },
  })
  void writer.update(db.collection(COLLECTIONS.users).doc(MANAGER.uid), { role: 'owner' })
  void writer.update(db.collection(COLLECTIONS.users).doc('youssef'), {
    probationEndsOn: day(10),
  })

  // ---- Equipment and maintenance ----
  const equipment = [
    ['espresso', 'La Marzocco Linea', 'Espresso machine', day(-86), 90, 'working', null, null],
    ['grinder', 'Mazzer grinder', 'Grinder', day(-20), 180, 'working', null, null],
    ['fridge-1', 'Milk fridge', 'Fridge', day(-60), 180, 'working', 1, 5],
    ['freezer-1', 'Freezer', 'Freezer', day(-60), 365, 'working', -22, -16],
    ['dishwasher', 'Dishwasher', 'Dishwasher', day(-200), 180, 'needs_repair', null, null],
  ] as const
  for (const [id, name, kind, lastServiceOn, every, status, tempMin, tempMax] of equipment)
    put(COLLECTIONS.equipment, id, {
      ...base(),
      name,
      kind,
      serial: '',
      purchasedOn: '2025-03-01',
      warrantyUntil: id === 'espresso' ? day(25) : '2027-03-01',
      serviceEveryDays: every,
      lastServiceOn,
      status,
      tempMin,
      tempMax,
    })
  put(COLLECTIONS.maintenance, 'seed-maint-1', {
    ...base(),
    equipmentId: 'espresso',
    equipmentName: 'La Marzocco Linea',
    date: day(-86),
    kind: 'Service',
    cost: 450,
    notes: 'Descaled, new gaskets',
  })

  // ---- Food safety: temperature checks (one out of range today) and an inspection ----
  const reading = (
    id: string,
    unit: 'fridge-1' | 'freezer-1',
    date: string,
    value: number,
    by: string,
  ) => {
    const [min, max] = unit === 'fridge-1' ? [1, 5] : [-22, -16]
    put(COLLECTIONS.temperatureLogs, id, {
      ...base(by),
      date,
      equipmentId: unit,
      equipmentName: unit === 'fridge-1' ? 'Milk fridge' : 'Freezer',
      reading: value,
      min,
      max,
      ok: temperatureOk(value, min, max),
      note: '',
    })
  }
  reading('seed-temp-1', 'fridge-1', day(-1), 3.5, 'sara')
  reading('seed-temp-2', 'freezer-1', day(-1), -18, 'sara')
  reading('seed-temp-3', 'fridge-1', today, 7.2, 'ahmed')
  put(COLLECTIONS.inspections, 'seed-insp-1', {
    ...base(),
    date: day(-40),
    inspector: 'Dubai Municipality',
    kind: 'Authority',
    result: 'Minor issues',
    score: 88,
    findings: 'Missing date labels on two milk jugs.',
    correctiveActions: 'Labels added; staff reminded at briefing.',
  })

  // ---- Daily operations ----
  const checklists = [
    [
      'opening',
      'Opening',
      'Opening',
      [
        'Turn on espresso machine',
        'Check fridge temperatures',
        'Set up pastry display',
        'Count the float',
      ],
    ],
    [
      'closing',
      'Closing',
      'Closing',
      [
        'Clean the steam wands',
        'Empty and clean the grinder hopper',
        'Mop the floor',
        'Cash up and log the takings',
      ],
    ],
  ] as const
  for (const [id, name, kind, items] of checklists)
    put(COLLECTIONS.checklistTemplates, id, { ...base(), name, kind, items: [...items] })
  put(COLLECTIONS.checklistRuns, `opening_${today}`, {
    ...base('sara'),
    templateId: 'opening',
    templateName: 'Opening',
    date: today,
    items: checklists[0][3].map((text, i) => ({
      text,
      done: i < 2,
      by: i < 2 ? names.sara : null,
      at: i < 2 ? now : null,
    })),
    completedAt: null,
  })
  put(COLLECTIONS.incidents, 'seed-incident-1', {
    ...base('omar'),
    date: day(-1),
    type: 'Equipment',
    severity: 'medium',
    description: 'Dishwasher leaking water onto the floor.',
    actionTaken: 'Put a wet-floor sign, called the technician.',
    status: 'open',
  })
  put(COLLECTIONS.incidents, 'seed-incident-2', {
    ...base('sara'),
    date: day(-6),
    type: 'Customer complaint',
    severity: 'low',
    description: 'Customer said the latte was cold.',
    actionTaken: 'Remade the drink.',
    status: 'closed',
  })
  put(COLLECTIONS.handovers, 'seed-handover-1', {
    ...base('sara'),
    date: day(-1),
    shiftName: 'Morning',
    notes: 'Low on oat milk; delivery expected tomorrow. Dishwasher leaking.',
    cashCount: 640,
  })

  // ---- Purchasing: one awaiting delivery, one received and unpaid, one paid ----
  const order = (
    id: string,
    number: string,
    supplierId: string,
    supplierName: string,
    status: string,
    lines: {
      itemId: string
      itemName: string
      unit: string
      quantity: number
      unitPrice: number
    }[],
    dates: Record<string, string | null>,
  ) =>
    put(COLLECTIONS.purchaseOrders, id, {
      ...base(),
      number,
      supplierId,
      supplierName,
      status,
      lines,
      total: orderTotal(lines),
      invoiceNumber: '',
      note: '',
      orderedOn: null,
      expectedOn: null,
      receivedOn: null,
      paymentDueOn: null,
      paidOn: null,
      ...dates,
    })
  order(
    'seed-po-1',
    'PO-0001',
    'green-valley',
    'Green Valley',
    'ordered',
    [
      { itemId: 'item-1', itemName: 'Whole Milk', unit: 'L', quantity: 40, unitPrice: 6.5 },
      { itemId: 'item-2', itemName: 'Oat Milk', unit: 'L', quantity: 20, unitPrice: 11 },
    ],
    { orderedOn: day(-1), expectedOn: day(1) },
  )
  order(
    'seed-po-2',
    'PO-0002',
    'packpro',
    'PackPro',
    'received',
    [
      {
        itemId: 'item-5',
        itemName: '12oz Paper Cups',
        unit: 'pcs',
        quantity: 1000,
        unitPrice: 0.35,
      },
    ],
    { orderedOn: day(-12), expectedOn: day(-9), receivedOn: day(-9), paymentDueOn: day(3) },
  )
  order(
    'seed-po-3',
    'PO-0003',
    'andes-roasters',
    'Andes Roasters',
    'received',
    [
      {
        itemId: 'item-3',
        itemName: 'Espresso Beans — House Blend',
        unit: 'kg',
        quantity: 20,
        unitPrice: 78,
      },
    ],
    {
      orderedOn: day(-30),
      expectedOn: day(-27),
      receivedOn: day(-27),
      paymentDueOn: day(-3),
      paidOn: day(-4),
    },
  )

  // ---- Finance: this month's takings and expenses ----
  const month = today.slice(0, 7)
  for (let d = `${month}-01`; d < today; d = addDays(d, 1)) {
    const n = Number(d.slice(8))
    put(COLLECTIONS.salesDays, `${branchId}_${d}`, {
      ...base('sara'),
      date: d,
      cash: 900 + ((n * 37) % 300),
      card: 1800 + ((n * 53) % 600),
      online: 300 + ((n * 29) % 200),
      note: '',
    })
  }
  const expenses = [
    ['Rent', 'Shop rent (monthly)', 15000, 0, 'Bank transfer', '01'],
    ['Utilities', 'DEWA electricity & water', 2100, 100, 'Bank transfer', '05'],
    ['Supplies', 'Cleaning supplies', 380, 18.1, 'Card', '08'],
    ['Marketing', 'Instagram ads', 600, 28.57, 'Card', '12'],
  ] as const
  expenses.forEach(([category, description, amount, vat, paymentMethod, dd], i) => {
    const date = `${month}-${dd}`
    if (date <= today)
      put(COLLECTIONS.expenses, `seed-expense-${i + 1}`, {
        ...base(),
        date,
        category,
        description,
        amount,
        vat,
        paymentMethod,
      })
  })

  // ---- People: candidates, training, goals, feedback ----
  const candidate = (id: string, name: string, stage: string, interviewOn: string | null) =>
    put(COLLECTIONS.candidates, id, {
      ...base(),
      name,
      phone: '+971 50 000 0000',
      email: '',
      position: 'Barista',
      stage,
      source: 'Instagram',
      interviewOn,
      notes: '',
      cvDocumentId: null,
    })
  candidate('seed-cand-1', 'Rania Saeed', 'interview', today)
  candidate('seed-cand-2', 'Bilal Ahmed', 'applied', null)
  candidate('seed-cand-3', 'Lina Haddad', 'offer', day(-5))

  put(COLLECTIONS.training, 'seed-training-1', {
    ...base(),
    employeeId: 'ahmed',
    employeeName: names.ahmed,
    title: 'Food safety level 2',
    provider: 'Dubai Municipality',
    date: '2025-11-10',
    expiresOn: day(20),
    notes: '',
    remindedFor: null,
  })
  put(COLLECTIONS.goals, 'seed-goal-1', {
    ...base(),
    employeeId: 'ahmed',
    employeeName: names.ahmed,
    title: 'Learn latte art (rosetta)',
    dueOn: day(30),
    status: 'in_progress',
    progress: 40,
  })

  const feedback = [
    [
      'In store',
      5,
      'Service',
      'Sara was lovely, great flat white!',
      'resolved',
      'Thanked the customer',
    ],
    ['Google', 2, 'Price', 'Too expensive for the size.', 'open', ''],
    ['Delivery app', 4, 'Product', 'Good coffee, arrived warm.', 'resolved', ''],
  ] as const
  feedback.forEach(([channel, rating, topic, comment, status, resolution], i) =>
    put(COLLECTIONS.feedback, `seed-feedback-${i + 1}`, {
      ...base(),
      date: day(-i * 2),
      channel,
      rating,
      topic,
      comment,
      status,
      resolution,
    }),
  )

  // ---- Rota: Omar off tomorrow, Ahmed on evening; a swap waiting for approval ----
  const rota = (uid: string, date: string, shiftId: string | null) =>
    put(COLLECTIONS.rota, `${uid}_${date}`, {
      branchId,
      employeeId: uid,
      employeeName: names[uid],
      date,
      shiftId,
      updatedAt: now,
    })
  rota('omar', day(1), null)
  rota('ahmed', day(1), 'evening')
  put(COLLECTIONS.swapRequests, 'seed-swap-1', {
    ...base('mariam'),
    date: day(2),
    fromId: 'mariam',
    fromName: names.mariam,
    toId: 'nour',
    toName: names.nour,
    reason: 'Dentist appointment',
    status: 'pending',
    decidedBy: null,
  })

  await writer.close()
}
