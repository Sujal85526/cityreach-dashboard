import { isManagerRole } from '@cityreach/shared'
import { Loader2, RotateCcw, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { TonePill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/features/auth/session'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Answer } from '../answers'
import { understand, type Intent } from '../intents'
import { MANAGERS_ONLY } from '../api'
import { useAsk } from '../queries'

const STAFF_SUGGESTIONS = [
  'What are my tasks today?',
  'When is my next shift?',
  'Did I clock in today?',
  'How much leave do I have?',
  'Show my latest payslip',
]
const MANAGER_SUGGESTIONS = [
  'What needs my attention?',
  'Who is absent today?',
  'Any overdue tasks?',
  'What should I reorder?',
  'How are sales this month?',
  'What is our staff cost?',
]

type Message =
  | { id: number; from: 'me'; text: string }
  | { id: number; from: 'bot'; answer: Answer }
  | { id: number; from: 'bot'; thinking: true }

/** The chat itself: full screen on a phone, a card in the corner from tablet width. */
export function AssistantPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const isManager = isManagerRole(user.access.role)
  const suggestions = isManager ? MANAGER_SUGGESTIONS : STAFF_SUGGESTIONS
  const ask = useAsk()

  const firstName = user.name.split(' ')[0] ?? ''
  const welcome: Message = {
    id: 0,
    from: 'bot',
    answer: {
      text: `Hi ${firstName}! I answer from your shop's records. Ask me something, or pick one below.`,
    },
  }
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [draft, setDraft] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const previous = useRef<Intent | null>(null)
  const nextId = useRef(1)
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [messages, isOpen])
  useEffect(() => {
    if (isOpen) input.current?.focus()
  }, [isOpen])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || isBusy) return
    setDraft('')
    setIsBusy(true)
    const thinkingId = nextId.current + 1
    nextId.current += 2
    setMessages((m) => [
      ...m,
      { id: thinkingId - 1, from: 'me', text: question },
      { id: thinkingId, from: 'bot', thinking: true },
    ])
    const reply = (answer: Answer) =>
      setMessages((m) =>
        m.map((message) =>
          message.id === thinkingId ? { id: thinkingId, from: 'bot', answer } : message,
        ),
      )
    try {
      const { intent, when, refused } = understand(question, isManager, previous.current)
      if (refused)
        reply({
          text: MANAGERS_ONLY,
        })
      else if (!intent)
        reply({
          text: "Sorry, I didn't understand that. I answer questions about your work here. Try one of the suggestions below.",
        })
      else {
        previous.current = intent
        reply(await ask(intent, when))
      }
    } catch (error) {
      reply({ text: `I couldn't look that up: ${errorMessage(error)}` })
    } finally {
      setIsBusy(false)
      input.current?.focus()
    }
  }

  const reset = () => {
    previous.current = null
    setMessages([welcome])
  }

  return (
    <section
      role="dialog"
      aria-label="Assistant"
      hidden={!isOpen}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className={cn(
        'fixed inset-0 z-40 flex-col bg-card sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[32rem] sm:max-h-[calc(100svh-2rem)] sm:w-96 sm:rounded-xl sm:border sm:shadow-xl',
        isOpen ? 'flex' : 'hidden',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Assistant</h2>
          <p className="truncate text-xs text-muted-foreground">Answers from your shop's records</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Start again"
            className="size-11 sm:size-9"
            onClick={reset}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close assistant"
            className="size-11 sm:size-9"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message) =>
          message.from === 'me' ? (
            <p
              key={message.id}
              className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {message.text}
            </p>
          ) : 'thinking' in message ? (
            <p
              key={message.id}
              className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" /> Looking that up…
            </p>
          ) : (
            <BotMessage
              key={message.id}
              answer={message.answer}
              onNavigate={() => window.innerWidth < 640 && onClose()}
            />
          ),
        )}
        <div ref={bottom} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={isBusy}
            onClick={() => void send(s)}
            className="min-h-9 shrink-0 rounded-full border px-3 text-xs whitespace-nowrap hover:bg-muted disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send(draft)
        }}
      >
        <Input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask me something…"
          aria-label="Your question"
          maxLength={200}
          autoComplete="off"
          className="h-11"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          className="size-11 shrink-0"
          disabled={isBusy || !draft.trim()}
        >
          <Send className="size-4" />
        </Button>
      </form>
    </section>
  )
}

function BotMessage({ answer, onNavigate }: { answer: Answer; onNavigate: () => void }) {
  return (
    <div className="w-fit max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
      <p>{answer.text}</p>
      {answer.lines && answer.lines.length > 0 && (
        <ul className="space-y-1.5">
          {answer.lines.map((line) => (
            <li
              key={`${line.text}-${line.note ?? ''}`}
              className="rounded-lg bg-card px-2.5 py-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <span className="font-medium">{line.text}</span>
                {line.tone && line.tone !== 'neutral' && (
                  <TonePill tone={line.tone}>{TONE_WORD[line.tone]}</TonePill>
                )}
              </div>
              {line.note && <p className="text-xs text-muted-foreground">{line.note}</p>}
            </li>
          ))}
        </ul>
      )}
      {answer.link && (
        <Link
          to={answer.link.to}
          onClick={onNavigate}
          className="inline-block font-medium underline underline-offset-2"
        >
          {answer.link.label}
        </Link>
      )}
    </div>
  )
}

const TONE_WORD = { danger: 'Urgent', warning: 'Watch', info: 'To do', success: 'OK' } as const
