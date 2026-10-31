import { describe, expect, it } from 'vitest'
import { normalise, understand, whenOf } from './intents'

const asEmployee = (text: string) => understand(text, false).intent
const asManager = (text: string) => understand(text, true).intent

describe('employee questions', () => {
  it.each([
    ['What are my tasks for today?', 'myTasks'],
    ['what should i do today', 'myTasks'],
    ['When is my next shift?', 'myShift'],
    ['am i working tomorrow', 'myShift'],
    ['Did I clock in?', 'myAttendance'],
    ['was i late this month', 'myAttendance'],
    ['How much leave do I have left?', 'myLeave'],
    ['show my latest payslip', 'myPay'],
    ['what is my salary', 'myPay'],
    ['what are my goals', 'myGrowth'],
    ['how do i clock in', 'howClockIn'],
    ['how do I request leave?', 'howLeave'],
    ['how can i swap a shift', 'howSwap'],
    ['I forgot my password', 'howPassword'],
    ['hello', 'greeting'],
    ['thank you', 'thanks'],
    ['what can you do', 'help'],
  ])('%s → %s', (text, intent) => {
    expect(asEmployee(text)).toBe(intent)
  })

  it('refuses questions only managers can ask, instead of guessing', () => {
    expect(understand('how much profit did we make', false)).toMatchObject({ refused: true })
    expect(understand('who is absent today', false)).toMatchObject({ refused: true })
    expect(understand('what should we reorder', false)).toMatchObject({ refused: true })
  })

  it('refuses staff asking how much the shop sold', () => {
    expect(understand('how much did we sell this week', false)).toMatchObject({
      intent: null,
      refused: true,
    })
  })

  it('admits it does not know', () => {
    expect(understand('tell me a joke about penguins', false)).toMatchObject({
      intent: null,
      refused: false,
    })
  })
})

describe('manager questions', () => {
  it.each([
    ['What needs my attention?', 'attention'],
    ['who is absent today', 'teamToday'],
    ['Who is working right now', 'teamToday'],
    ['any overdue tasks', 'teamTasks'],
    ['what is low on stock', 'lowStock'],
    ['what should I reorder', 'reorder'],
    ['any leave requests to approve', 'leaveToReview'],
    ['How were sales this month?', 'sales'],
    ['how much profit did we make', 'profit'],
    ['what is our staff cost', 'labour'],
    ['how much waste this month', 'waste'],
    ['what is our best day', 'bestDay'],
    ['how are all my branches', 'branches'],
    ['how much did we sell this week', 'sales'],
  ])('%s → %s', (text, intent) => {
    expect(asManager(text)).toBe(intent)
  })

  it("tells a manager's own tasks from the team's", () => {
    expect(asManager('what are my tasks')).toBe('myTasks')
    expect(asManager('what tasks are open')).toBe('teamTasks')
  })
})

describe('typing and context', () => {
  it('corrects small typos', () => {
    expect(normalise('waht are my taks todya')).toContain('tasks'.slice(0, 4))
    expect(asEmployee('my taks todya')).toBe('myTasks')
    expect(asManager('who is absnt tomorow')).toBe('teamToday')
    expect(asManager('hows sals')).toBe('sales')
  })

  it('finds the time in a question', () => {
    expect(whenOf('tasks for tomorrow')).toBe('tomorrow')
    expect(whenOf('sales this week')).toBe('week')
    expect(whenOf('my leave')).toBeNull()
  })

  it('continues the last question when only a time is given', () => {
    expect(understand('and tomorrow?', false, 'myShift')).toMatchObject({
      intent: 'myShift',
      when: 'tomorrow',
    })
    expect(understand('what about this week', true, 'sales')).toMatchObject({
      intent: 'sales',
      when: 'week',
    })
  })

  it('does not treat a full new question as a follow-up', () => {
    expect(understand('my leave this month', false, 'myShift').intent).toBe('myLeave')
  })
})
