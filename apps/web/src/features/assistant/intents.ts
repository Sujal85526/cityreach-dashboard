/**
 * Understands what someone typed. No AI: it corrects small typos, then scores each topic by the
 * words it contains. Personal words ("my", "I") lean towards the person's own data, otherwise a
 * manager's question is about the shop.
 */
export type When = 'today' | 'tomorrow' | 'yesterday' | 'week' | 'month'

export const STAFF_INTENTS = [
  'myTasks',
  'myShift',
  'myAttendance',
  'myLeave',
  'myPay',
  'myGrowth',
  'howClockIn',
  'howLeave',
  'howSwap',
  'howPassword',
] as const
export const MANAGER_INTENTS = [
  'attention',
  'teamToday',
  'teamTasks',
  'lowStock',
  'reorder',
  'leaveToReview',
  'sales',
  'profit',
  'labour',
  'waste',
  'bestDay',
  'branches',
] as const
export type Intent =
  (typeof STAFF_INTENTS)[number] | (typeof MANAGER_INTENTS)[number] | 'greeting' | 'thanks' | 'help'

interface Rule {
  intent: Intent
  words: [RegExp, number][]
}

const RULES: Rule[] = [
  {
    intent: 'greeting',
    words: [[/^(hi|hello|hey|salam|salaam|good (morning|afternoon|evening))\b/, 3]],
  },
  { intent: 'thanks', words: [[/\b(thanks|thank you|thx|shukran)\b/, 3]] },
  {
    intent: 'help',
    words: [
      [/\b(help|what can you do|what do you do|who are you)\b/, 3],
      [/\b(options|commands)\b/, 2],
    ],
  },
  // How-to questions come first: "how do I request leave" is not "how much leave do I have".
  { intent: 'howClockIn', words: [[/\bhow\b.*\b(clock|check|sign)\b/, 6]] },
  {
    intent: 'howLeave',
    words: [[/\bhow\b.*\b(request|apply|ask|take|book)\b.*\b(leave|holiday|vacation|off)\b/, 6]],
  },
  {
    intent: 'howSwap',
    words: [
      [/\bhow\b.*\bswap\b/, 6],
      [/\bswap\b/, 2],
    ],
  },
  { intent: 'howPassword', words: [[/\bpassword\b/, 5]] },
  {
    intent: 'myTasks',
    words: [
      [/\b(task|tasks|todo|to do|work to do|assigned)\b/, 3],
      [/\b(what|anything) (should|do|must) i do\b/, 4],
    ],
  },
  {
    intent: 'myShift',
    words: [
      [/\b(shift|shifts|rota|schedule|timing|timings|roster)\b/, 3],
      [/\bwhen\b.*\b(work|start|next)\b/, 3],
      [/\b(am i|do i) work(ing)?\b/, 4],
      [/\bday off\b/, 3],
    ],
  },
  {
    intent: 'myAttendance',
    words: [
      [/\b(attendance|clock(ed)?|punch(ed)?|check(ed)? in|hours)\b/, 3],
      [/\b(was|am|have) i (been )?late\b/, 5],
    ],
  },
  {
    intent: 'myLeave',
    words: [
      [/\b(leave|leaves|holiday|holidays|vacation|sick days?)\b/, 3],
      [/\b(balance|left|remaining)\b/, 1],
    ],
  },
  { intent: 'myPay', words: [[/\b(pay|paid|payslip|payslips|salary|wage|wages)\b/, 3]] },
  {
    intent: 'myGrowth',
    words: [[/\b(goal|goals|training|course|courses|certificate|certificates)\b/, 3]],
  },
  {
    intent: 'attention',
    words: [
      [/\b(attention|urgent|problems?|issues?|important)\b/, 4],
      [/\b(summary|overview|how is the shop|how are things)\b/, 3],
    ],
  },
  {
    intent: 'teamToday',
    words: [
      [/\b(absent|absence|absences|missing)\b/, 4],
      [/\bwho\b.*\b(late|working|in|here|present|off|on leave|clocked)\b/, 5],
      [/\b(present|staff today|team today|attendance)\b/, 3],
      [/\b(late)\b/, 2],
    ],
  },
  {
    intent: 'teamTasks',
    words: [
      [/\b(task|tasks|overdue|pending work)\b/, 3],
      [/\boverdue\b/, 2],
    ],
  },
  {
    intent: 'lowStock',
    words: [
      [/\b(stock|inventory|running low|run out|running out)\b/, 3],
      [/\blow\b/, 1],
    ],
  },
  { intent: 'reorder', words: [[/\b(reorder|re-order|order|buy|purchase|should i get)\b/, 4]] },
  {
    intent: 'leaveToReview',
    words: [
      [/\b(leave|leaves|holiday|vacation)\b/, 2],
      [/\b(requests?|approve|approval|review|pending|waiting)\b/, 3],
    ],
  },
  { intent: 'sales', words: [[/\b(sales|sale|takings|revenue|sold|earn|earned|income)\b/, 4]] },
  { intent: 'profit', words: [[/\b(profit|margin|loss|money|making)\b/, 4]] },
  {
    intent: 'labour',
    words: [
      [/\b(labou?r|staff cost|staff costs|payroll|wage bill)\b/, 5],
      [/\b(salary|salaries)\b/, 2],
    ],
  },
  { intent: 'waste', words: [[/\b(waste|wasted|wastage|expired|thrown)\b/, 5]] },
  {
    intent: 'bestDay',
    words: [
      [/\b(best|worst|busiest|quietest|slowest)\b/, 4],
      [/\b(day|days|weekday)\b/, 1],
    ],
  },
  { intent: 'branches', words: [[/\b(branch|branches|all shops|other shop)\b/, 5]] },
]

const PERSONAL = /\b(my|mine|me|i|am i|do i)\b/

const STAFF_SET = new Set<string>(STAFF_INTENTS)
const MANAGER_SET = new Set<string>(MANAGER_INTENTS)

/** Words people mistype, corrected when one letter off. Short words are left alone. */
const VOCABULARY = [
  'absent',
  'attendance',
  'attention',
  'balance',
  'branch',
  'branches',
  'certificate',
  'clocked',
  'goals',
  'holiday',
  'inventory',
  'labour',
  'leave',
  'leaves',
  'month',
  'overdue',
  'password',
  'payslip',
  'payslips',
  'present',
  'profit',
  'reorder',
  'request',
  'requests',
  'salary',
  'sales',
  'schedule',
  'shift',
  'shifts',
  'staff',
  'stock',
  'summary',
  'swap',
  'task',
  'tasks',
  'today',
  'tomorrow',
  'training',
  'vacation',
  'waste',
  'week',
  'yesterday',
]

const oneEditApart = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    // A swapped pair ("taks", "todya") counts as one edit.
    if (a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2
      j += 2
    } else if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

const correctWord = (word: string) =>
  word.length < 4 || VOCABULARY.includes(word)
    ? word
    : (VOCABULARY.find((v) => oneEditApart(word, v)) ?? word)

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(correctWord)
    .join(' ')
}

export function whenOf(text: string): When | null {
  if (/\b(tomorrow|tmrw|tmr)\b/.test(text)) return 'tomorrow'
  if (/\byesterday\b/.test(text)) return 'yesterday'
  if (/\b(today|tonight|now|right now)\b/.test(text)) return 'today'
  if (/\b(this week|week|weekly|next few days)\b/.test(text)) return 'week'
  if (/\b(this month|month|monthly|so far)\b/.test(text)) return 'month'
  return null
}

/** "and tomorrow?", "what about this week": only a time, so it continues the last question. */
const isFollowUp = (text: string) =>
  /^((and|what about|how about|for|same for|ok|okay)\s+)*(today|tomorrow|tmrw|tmr|yesterday|now|this week|week|this month|month)$/.test(
    text,
  )

export interface Understood {
  intent: Intent | null
  when: When | null
  /** Asked for something only managers can see. */
  refused: boolean
}

export function understand(
  text: string,
  isManager: boolean,
  previous: Intent | null = null,
): Understood {
  const clean = normalise(text)
  const when = whenOf(clean)
  if (previous && isFollowUp(clean)) return { intent: previous, when, refused: false }

  const personal = PERSONAL.test(clean)
  let best: { intent: Intent; score: number } | null = null
  let refusedBest = 0
  for (const rule of RULES) {
    let score = rule.words.reduce((sum, [word, points]) => sum + (word.test(clean) ? points : 0), 0)
    if (score === 0) continue
    if (MANAGER_SET.has(rule.intent) && !isManager) {
      refusedBest = Math.max(refusedBest, score)
      continue
    }
    // The same words can mean the person or the shop: "tasks" for staff is their tasks.
    if (STAFF_SET.has(rule.intent) && personal) score += 2
    if (MANAGER_SET.has(rule.intent) && !personal) score += 2
    if (!best || score > best.score) best = { intent: rule.intent, score }
  }
  // Only refuse when the question is clearly a manager's, not when staff words also match.
  if (!isManager && refusedBest > (best?.score ?? 0)) return { intent: null, when, refused: true }
  return { intent: best?.intent ?? null, when, refused: false }
}
