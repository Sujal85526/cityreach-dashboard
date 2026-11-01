/**
 * Demo data for the operations, finance and HR modules (checklists, incidents, food safety,
 * equipment, purchasing, sales and expenses, recruitment, feedback, training and goals, shift
 * swaps), so every screen, the dashboard's "Needs your attention" and the calendar have something
 * to show. Everything is relative to today. Runs after the main seed.
 */
import {
  addDays,
  COLLECTIONS,
  DEFAULT_BRANCH_RULES,
  orderTotal,
  plannedShiftKey,
  SAMPLE_PEOPLE,
  temperatureOk,
  zonedDateTime,
} from '@cityreach/shared'
import type { SeedDb } from './adapter'

const MANAGER = { uid: 'amara', name: 'Amara Okafor' }
const TZ = DEFAULT_BRANCH_RULES.timeZone

const money = (n: number) => Math.round(n * 100) / 100

export function seedBusiness(
  db: SeedDb,
  branchId: string,
  today: string,
  names: Record<string, string>,
) {
  const now = new Date()
  const writer = db.bulkWriter()
  const day = (offset: number) => addDays(today, offset)
  const base = (by = MANAGER.uid, createdAt = now) => ({
    branchId,
    createdBy: by,
    createdByName: names[by] ?? MANAGER.name,
    createdAt,
    updatedAt: createdAt,
  })
  const put = (coll: string, id: string, data: Record<string, unknown>) =>
    writer.set(db.collection(coll).doc(id), data)
  const itemId = (name: string) => {
    const found = Object.entries(db.data[COLLECTIONS.inventoryItems] ?? {}).find(
      ([, d]) => d.name === name,
    )
    if (!found) throw new Error(`Seed refers to a missing stock item: ${name}`)
    return found[0]
  }
  const atTime = (offset: number, time: string) => zonedDateTime(day(offset), time, TZ)

  let state = 7
  const rand = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }

  // Owner of the branch (can open more branches); quarterly VAT; the daily jobs have run today.
  writer.update(db.collection(COLLECTIONS.branches).doc(branchId), {
    ownerId: MANAGER.uid,
    vat: { periodEnd: `${today.slice(0, 4)}-03`, months: 3 },
    automation: { performanceDate: today },
  })
  writer.update(db.collection(COLLECTIONS.users).doc(MANAGER.uid), { role: 'owner' })
  writer.update(db.collection(COLLECTIONS.users).doc('jamal'), { probationEndsOn: day(52) })

  // Two people whose salary has not been set yet: Insights warns that the real staff cost is higher.
  for (const uid of ['tomas', 'ella']) {
    writer.update(db.collection(COLLECTIONS.users).doc(uid), { salary: null, allowances: 0 })
    for (const id of Object.keys(db.data[COLLECTIONS.payslips] ?? {}))
      if (id.startsWith(`${uid}_`)) delete (db.data[COLLECTIONS.payslips] ?? {})[id]
  }

  // ---- Equipment and maintenance ----
  const equipment = [
    ['espresso', 'La Marzocco Linea', 'Espresso machine', 'LM-2210473', -400, -50, 90, 140, 'working', null, null],
    ['grinder', 'Mazzer Major grinder', 'Grinder', 'MZ-884102', -380, -20, 180, 200, 'working', null, null],
    ['fridge-1', 'Milk fridge', 'Fridge', 'FR-55120', -400, -60, 180, 330, 'working', 1, 5],
    ['fridge-2', 'Drinks display fridge', 'Fridge', 'FR-55188', -300, -45, 180, 420, 'working', 1, 5],
    ['freezer-1', 'Pastry freezer', 'Freezer', 'FZ-20931', -400, -100, 365, 330, 'working', -22, -16],
    ['oven', 'Convection oven', 'Oven', 'OV-77412', -350, -120, 180, 380, 'working', null, null],
    ['dishwasher', 'Glasswasher', 'Dishwasher', 'GW-30415', -350, -75, 180, 380, 'working', null, null],
  ] as const
  for (const [id, name, kind, serial, bought, last, every, warranty, status, tempMin, tempMax] of equipment)
    put(COLLECTIONS.equipment, id, {
      ...base(),
      name,
      kind,
      serial,
      purchasedOn: day(bought),
      warrantyUntil: day(warranty),
      serviceEveryDays: every,
      lastServiceOn: day(last),
      status,
      tempMin,
      tempMax,
    })
  const maintenance = [
    ['espresso', 'La Marzocco Linea', -50, 'Service', 280, 'Descaled, new group gaskets.'],
    ['grinder', 'Mazzer Major grinder', -20, 'Service', 95, 'Burrs replaced and recalibrated.'],
    ['dishwasher', 'Glasswasher', -75, 'Repair', 145, 'Replaced the drain pump.'],
    ['freezer-1', 'Pastry freezer', -100, 'Service', 120, 'Door seal replaced, defrosted.'],
    ['fridge-1', 'Milk fridge', -60, 'Service', 85, 'Cleaned the condenser, checked the thermostat.'],
  ] as const
  maintenance.forEach(([equipmentId, equipmentName, date, kind, cost, notes], i) =>
    put(COLLECTIONS.maintenance, `seed-maint-${i + 1}`, {
      ...base('daniel', atTime(date, '12:00')),
      equipmentId,
      equipmentName,
      date: day(date),
      kind,
      cost,
      notes,
    }),
  )

  // ---- Food safety: a morning reading per cold unit for a week (one slip, three days ago) ----
  const units = [
    ['fridge-1', 'Milk fridge', 1, 5, 3.4],
    ['fridge-2', 'Drinks display fridge', 1, 5, 3.9],
    ['freezer-1', 'Pastry freezer', -22, -16, -19],
  ] as const
  const openers = ['liam', 'jamal', 'maya', 'priya']
  for (let back = 6; back >= 0; back--)
    units.forEach(([unit, unitName, min, max, typical], u) => {
      const slip = unit === 'fridge-2' && back === 3
      const reading = slip ? 6.8 : Math.round((typical + (rand() - 0.5) * 1.6) * 10) / 10
      put(COLLECTIONS.temperatureLogs, `seed-temp-${unit}-${day(-back)}`, {
        ...base(openers[(back + u) % openers.length], atTime(-back, '07:25')),
        date: day(-back),
        equipmentId: unit,
        equipmentName: unitName,
        reading,
        min,
        max,
        ok: temperatureOk(reading, min, max),
        note: slip ? 'Door left ajar overnight. Rechecked two hours later: 3.2 °C.' : '',
      })
    })
  put(COLLECTIONS.inspections, 'seed-insp-1', {
    ...base('daniel', atTime(-70, '15:00')),
    date: day(-70),
    inspector: 'Manchester City Council: Environmental Health',
    kind: 'Authority',
    result: 'Pass',
    score: 95,
    findings: 'Food hygiene rating visit. Rating of 5 (very good). Allergen records well kept.',
    correctiveActions: '',
  })
  put(COLLECTIONS.inspections, 'seed-insp-2', {
    ...base('daniel', atTime(-21, '16:00')),
    date: day(-21),
    inspector: 'Daniel Brooks',
    kind: 'Internal',
    result: 'Minor issues',
    score: 88,
    findings: 'Two milk jugs without date labels; sanitiser bottle empty at the back counter.',
    correctiveActions: 'Labels added and staff reminded at the briefing. Sanitiser refilled.',
  })

  // ---- Daily operations: opening and closing checklists every day this week ----
  const checklists = [
    [
      'opening',
      'Opening',
      'Opening',
      ['Turn on espresso machine', 'Check fridge temperatures', 'Set up pastry display', 'Count the float'],
      '07:10',
    ],
    [
      'closing',
      'Closing',
      'Closing',
      ['Clean the steam wands', 'Empty and clean the grinder hopper', 'Mop the floor', 'Cash up and log the takings'],
      '22:20',
    ],
    [
      'cleaning',
      'Weekly deep clean',
      'Cleaning',
      ['Descale the kettles', 'Clean behind the fridges', 'Wash the front windows', 'Wipe down the shelves'],
      '23:30',
    ],
  ] as const
  for (const [id, name, kind, items] of checklists)
    put(COLLECTIONS.checklistTemplates, id, { ...base(), name, kind, items: [...items] })
  const closers = ['sofia', 'noah', 'ella']
  for (let back = 6; back >= 0; back--)
    for (const [id, name, , items, time] of checklists.slice(0, 2)) {
      if (id === 'closing' && back === 0) continue
      const by = id === 'opening' ? (openers[back % openers.length] ?? 'liam') : (closers[back % closers.length] ?? 'sofia')
      const done = items.map((text, i) => {
        const at = new Date(atTime(-back, time).getTime() + i * 6 * 60_000)
        return { text, done: at <= now, by: at <= now ? names[by] : null, at: at <= now ? at : null }
      })
      const complete = done.every((d) => d.done)
      put(COLLECTIONS.checklistRuns, `${id}_${day(-back)}`, {
        ...base(by, atTime(-back, time)),
        templateId: id,
        templateName: name,
        date: day(-back),
        items: done,
        completedAt: complete ? done[done.length - 1]?.at : null,
      })
    }
  const incidents = [
    [-4, 'Food safety', 'low', 'Customer reported a missing allergen label on a muffin.', 'Checked the label box, reprinted and replaced all labels.', 'sofia'],
    [-9, 'Equipment', 'medium', 'Glasswasher leaking a little water onto the floor.', 'Wet-floor sign out; engineer replaced the door seal the same day.', 'noah'],
    [-16, 'Injury', 'low', 'Minor burn from the steam wand.', 'First aid given; added to the accident book.', 'jamal'],
    [-24, 'Customer complaint', 'low', 'Customer said their latte was cold.', 'Remade the drink and offered a pastry.', 'liam'],
  ] as const
  incidents.forEach(([date, type, severity, description, actionTaken, by], i) =>
    put(COLLECTIONS.incidents, `seed-incident-${i + 1}`, {
      ...base(by, atTime(date, '14:00')),
      date: day(date),
      type,
      severity,
      description,
      actionTaken,
      status: 'closed',
    }),
  )
  const handovers = [
    [-1, 'Morning', 'Quiet start, busy lunch. Oat milk running low, order is on its way.', 640],
    [-2, 'Evening', 'Cleaned the grinder, restocked cups. One card terminal restart at 6pm.', 585],
    [-3, 'Morning', 'Delivery from Albion Bakehouse arrived early. All counted.', 612],
    [-4, 'Evening', 'Busy Saturday crowd; sold out of blueberry muffins by 4pm.', 720],
    [-5, 'Morning', 'Descaled the steam wands. Fridge readings all fine.', 598],
  ] as const
  handovers.forEach(([date, shiftName, notes, cashCount], i) =>
    put(COLLECTIONS.handovers, `seed-handover-${i + 1}`, {
      ...base(shiftName === 'Morning' ? 'liam' : 'sofia', atTime(date, shiftName === 'Morning' ? '15:05' : '23:05')),
      date: day(date),
      shiftName,
      notes,
      cashCount,
    }),
  )

  // ---- Purchasing: a draft, two on order, one received and awaiting payment, two paid ----
  type Line = { name: string; unit: string; quantity: number; unitPrice: number }
  const order = (
    id: string,
    number: string,
    supplierKey: string,
    supplierName: string,
    status: string,
    lines: Line[],
    dates: Record<string, string | null>,
    invoiceNumber = '',
  ) => {
    const withIds = lines.map((l) => ({
      itemId: itemId(l.name),
      itemName: l.name,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }))
    put(COLLECTIONS.purchaseOrders, id, {
      ...base('amara', atTime(-(Number(dates.createdBack ?? 0)), '11:00')),
      number,
      supplierId: supplierKey,
      supplierName,
      status,
      lines: withIds,
      total: orderTotal(withIds),
      invoiceNumber,
      note: '',
      orderedOn: null,
      expectedOn: null,
      receivedOn: null,
      paymentDueOn: null,
      paidOn: null,
      ...Object.fromEntries(Object.entries(dates).filter(([k]) => k !== 'createdBack')),
    })
  }
  order(
    'seed-po-1', 'PO-0001', 'sweetline', 'Sweetline Syrups', 'draft',
    [
      { name: 'Vanilla Syrup', unit: 'btl', quantity: 12, unitPrice: 6.4 },
      { name: 'Caramel Syrup', unit: 'btl', quantity: 6, unitPrice: 6.4 },
    ],
    { createdBack: '0' },
  )
  order(
    'seed-po-2', 'PO-0002', 'green-valley', 'Green Valley Dairy', 'ordered',
    [
      { name: 'Oat Milk', unit: 'L', quantity: 30, unitPrice: 1.85 },
      { name: 'Whole Milk', unit: 'L', quantity: 40, unitPrice: 1.2 },
    ],
    { createdBack: '1', orderedOn: day(-1), expectedOn: day(1) },
  )
  order(
    'seed-po-3', 'PO-0003', 'packpro', 'PackPro Supplies', 'ordered',
    [{ name: '12oz Paper Cups', unit: 'pcs', quantity: 1000, unitPrice: 0.045 }],
    { createdBack: '0', orderedOn: today, expectedOn: day(3) },
  )
  order(
    'seed-po-4', 'PO-0004', 'northern-roast', 'Northern Roast Co.', 'received',
    [
      { name: 'Espresso Beans — House Blend', unit: 'kg', quantity: 20, unitPrice: 14.8 },
      { name: 'English Breakfast Tea', unit: 'box', quantity: 6, unitPrice: 5.2 },
    ],
    { createdBack: '9', orderedOn: day(-9), expectedOn: day(-6), receivedOn: day(-6), paymentDueOn: day(4) },
    'NR-20841',
  )
  order(
    'seed-po-5', 'PO-0005', 'albion-bakehouse', 'Albion Bakehouse', 'received',
    [
      { name: 'Butter Croissants', unit: 'pcs', quantity: 60, unitPrice: 0.62 },
      { name: 'Sourdough Loaves', unit: 'pcs', quantity: 20, unitPrice: 2.1 },
    ],
    { createdBack: '20', orderedOn: day(-20), expectedOn: day(-18), receivedOn: day(-18), paymentDueOn: day(-4), paidOn: day(-6) },
    'AB-4471',
  )
  order(
    'seed-po-6', 'PO-0006', 'green-valley', 'Green Valley Dairy', 'received',
    [{ name: 'Whole Milk', unit: 'L', quantity: 60, unitPrice: 1.2 }],
    { createdBack: '33', orderedOn: day(-33), expectedOn: day(-31), receivedOn: day(-31), paymentDueOn: day(-17), paidOn: day(-19) },
    'GV-10388',
  )

  // ---- Finance: six months of takings (weekend peak, upward trend, a seasonal wobble) ----
  const weekdayFactor = [1.05, 0.82, 0.86, 0.9, 0.95, 1.12, 1.35]
  const closing = ['sofia', 'liam', 'noah', 'ella']
  for (let back = 190; back >= 0; back--) {
    const date = day(-back)
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    const trend = (1 + (0.3 * (190 - back)) / 190) * (1 + 0.07 * Math.sin(back / 24))
    const total = Math.round(1250 * (weekdayFactor[weekday] ?? 1) * trend * (0.92 + rand() * 0.16))
    const card = Math.round(total * (0.54 + rand() * 0.04))
    const online = Math.round(total * (0.14 + rand() * 0.04))
    put(COLLECTIONS.salesDays, `${branchId}_${date}`, {
      ...base(closing[back % closing.length], atTime(-back, '22:45')),
      date,
      cash: total - card - online,
      card,
      online,
      note: back === 4 ? 'Street festival nearby: extra footfall.' : '',
    })
  }

  // Expenses over the last six calendar months (amounts include VAT where the supplier charges it).
  const monthStarts = [0, 1, 2, 3, 4, 5].map((m) => {
    let d = `${today.slice(0, 8)}01`
    for (let i = 0; i < m; i++) d = addDays(d, -1).slice(0, 8) + '01'
    return d.slice(0, 7)
  })
  const expenseTemplates = [
    ['Rent', 'Shop rent (monthly)', 4500, false, 'Bank transfer', '26'],
    ['Utilities', 'Electricity and gas', 640, true, 'Bank transfer', '05'],
    ['Utilities', 'Water and drainage', 118, false, 'Bank transfer', '09'],
    ['Utilities', 'Broadband and card terminal', 74, true, 'Bank transfer', '12'],
    ['Supplies', 'Weekly stock top-up', 1280, false, 'Card', '04'],
    ['Supplies', 'Weekly stock top-up', 1345, false, 'Card', '11'],
    ['Supplies', 'Weekly stock top-up', 1210, false, 'Card', '18'],
    ['Supplies', 'Weekly stock top-up', 1390, false, 'Card', '25'],
    ['Supplies', 'Cleaning supplies', 86, true, 'Card', '08'],
    ['Maintenance', 'Equipment servicing and repairs', 145, true, 'Card', '14'],
    ['Marketing', 'Instagram and Google ads', 180, true, 'Card', '15'],
    ['Licences & fees', 'Music licence', 185, false, 'Bank transfer', '20'],
    ['Other', 'Accountancy fee', 240, true, 'Bank transfer', '22'],
    ['Other', 'Public liability insurance', 96, false, 'Bank transfer', '27'],
  ] as const
  let expenseNo = 0
  for (const month of monthStarts)
    for (const [category, description, amount, vatable, paymentMethod, dd] of expenseTemplates) {
      const date = `${month}-${dd}`
      if (date > today || date < day(-190)) continue
      expenseNo++
      const wobble = category === 'Supplies' || category === 'Utilities' ? 0.95 + rand() * 0.1 : 1
      const total = Math.round(amount * wobble)
      put(COLLECTIONS.expenses, `seed-expense-${expenseNo}`, {
        ...base('amara', zonedDateTime(date, '10:30', TZ)),
        date,
        category,
        description,
        amount: total,
        vat: vatable ? money(total / 6) : 0,
        paymentMethod,
      })
    }

  // ---- People: recruitment, training, goals ----
  const candidates = [
    ['seed-cand-1', 'Rania Saeed', 'Barista', 'interview', 'Indeed', day(1), '+44 7700 900 201', 'Two years at a roastery; weekends only.'],
    ['seed-cand-2', 'Callum Ward', 'Barista', 'interview', 'Referral', day(3), '+44 7700 900 202', 'Referred by Liam; available immediately.'],
    ['seed-cand-3', 'Lina Haddad', 'Cashier', 'offer', 'Company website', day(-4), '+44 7700 900 203', 'Strong interview; offer sent, waiting to hear back.'],
    ['seed-cand-4', 'Ben Okoye', 'Kitchen Assistant', 'applied', 'Indeed', null, '+44 7700 900 204', ''],
    ['seed-cand-5', 'Hannah Pryce', 'Barista', 'applied', 'Instagram', null, '+44 7700 900 205', 'Student, wants 16 hours a week.'],
    ['seed-cand-6', 'Dev Sharma', 'Cashier', 'rejected', 'Walk-in', day(-12), '+44 7700 900 206', 'Not available for weekend shifts.'],
  ] as const
  candidates.forEach(([id, name, position, stage, source, interviewOn, phone, notes]) =>
    put(COLLECTIONS.candidates, id, {
      ...base('daniel', atTime(-14, '10:00')),
      name,
      phone,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      position,
      stage,
      source,
      interviewOn,
      notes,
      cvDocumentId: null,
    }),
  )

  const training = [
    ['maya', 'Food hygiene level 2', 'Highfield Awarding Body', -150, 215],
    ['liam', 'First aid at work', 'St John Ambulance', -335, 28],
    ['sofia', 'Barista skills level 2', 'Northern Roast Academy', -60, null],
    ['priya', 'Allergen awareness', 'Food Standards Agency (online)', -200, 165],
    ['noah', 'Food hygiene level 2', 'Highfield Awarding Body', -120, 245],
    ['jamal', 'Manual handling', 'In-house', -90, null],
  ] as const
  training.forEach(([uid, title, provider, date, expires], i) =>
    put(COLLECTIONS.training, `seed-training-${i + 1}`, {
      ...base('daniel', atTime(date, '16:00')),
      employeeId: uid,
      employeeName: names[uid],
      title,
      provider,
      date: day(date),
      expiresOn: expires === null ? null : day(expires),
      notes: '',
      remindedFor: expires !== null && expires <= 30 ? day(expires) : null,
    }),
  )
  const goals = [
    ['maya', 'Learn latte art (rosetta)', 30, 'in_progress', 55],
    ['liam', 'Complete the assistant manager course', 120, 'in_progress', 30],
    ['sofia', 'Train two new baristas', 45, 'in_progress', 70],
    ['noah', 'Arrive on time for every shift for a month', 25, 'in_progress', 60],
    ['ella', 'Master the end-of-day cash-up', -10, 'achieved', 100],
    ['jamal', 'Learn the full espresso menu', 60, 'not_started', 0],
  ] as const
  goals.forEach(([uid, title, due, status, progress], i) =>
    put(COLLECTIONS.goals, `seed-goal-${i + 1}`, {
      ...base('daniel', atTime(-30, '10:00')),
      employeeId: uid,
      employeeName: names[uid],
      title,
      dueOn: day(due),
      status,
      progress,
    }),
  )

  // ---- Customer feedback ----
  const feedback = [
    [-1, 'In store', 5, 'Service', 'Liam was lovely and the flat white was perfect.', 'resolved', 'Thanked the customer.'],
    [-2, 'Google', 5, 'Product', 'Best flat white in Manchester, and the sourdough is fantastic.', 'resolved', ''],
    [-3, 'Delivery app', 4, 'Product', 'Arrived warm and well packed.', 'resolved', ''],
    [-5, 'Google', 3, 'Service', 'Lovely drinks but a long wait at the till on Saturday.', 'open', ''],
    [-6, 'In store', 5, 'Cleanliness', 'Spotless and a really friendly team.', 'resolved', ''],
    [-8, 'Instagram', 4, 'Product', 'Loved the new seasonal menu. More vegan options please!', 'resolved', 'Passed to the manager for the next menu.'],
    [-10, 'Google', 2, 'Price', 'Tasty, but quite pricey for the size.', 'resolved', 'Replied explaining the portion size and offered a loyalty card.'],
    [-12, 'In store', 5, 'Service', 'Sofia remembered my order. Great atmosphere.', 'resolved', ''],
    [-15, 'Phone', 4, 'Other', 'Easy to book a table for a group; thank you.', 'resolved', ''],
    [-19, 'Delivery app', 5, 'Product', 'Hot, on time and delicious.', 'resolved', ''],
  ] as const
  feedback.forEach(([date, channel, rating, topic, comment, status, resolution], i) =>
    put(COLLECTIONS.feedback, `seed-feedback-${i + 1}`, {
      ...base('daniel', atTime(date, '13:00')),
      date: day(date),
      channel,
      rating,
      topic,
      comment,
      status,
      resolution,
    }),
  )

  // ---- Shift swap waiting for approval: Ella (evening) asks Jamal (morning) to swap a day ----
  const ella = SAMPLE_PEOPLE.find((p) => p.key === 'ella')
  const jamal = SAMPLE_PEOPLE.find((p) => p.key === 'jamal')
  if (ella && jamal) {
    let swapDate = day(4)
    for (let d = 4; d <= 12; d++) {
      const date = day(d)
      if (plannedShiftKey(ella, date, today) && plannedShiftKey(jamal, date, today)) {
        swapDate = date
        break
      }
    }
    put(COLLECTIONS.swapRequests, 'seed-swap-1', {
      ...base('ella', new Date(now.getTime() - 3.5 * 3_600_000)),
      date: swapDate,
      fromId: 'ella',
      fromName: names.ella,
      toId: 'jamal',
      toName: names.jamal,
      reason: 'Dentist appointment in the evening',
      status: 'pending',
      decidedBy: null,
    })
  }

  writer.close()
}
