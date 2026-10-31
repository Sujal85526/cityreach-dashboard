import type { EmployeeNote, NoteKind, User } from '@dm/shared'
import { Award, Loader2, StickyNote, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import { useAddEmployeeNote } from '../queries'

const KINDS: Record<
  NoteKind,
  { title: string; icon: LucideIcon; tone: string; placeholder: string }
> = {
  notes: {
    title: 'Manager notes',
    icon: StickyNote,
    tone: 'text-info',
    placeholder: 'Add a note…',
  },
  warnings: {
    title: 'Warnings',
    icon: TriangleAlert,
    tone: 'text-danger',
    placeholder: 'Reason for the warning…',
  },
  achievements: {
    title: 'Achievements',
    icon: Award,
    tone: 'text-success',
    placeholder: 'What did they do well?',
  },
}

/** Notes, warnings and achievements on the profile; newest first, manager can add. */
export function NotesPanel({ employee, kind }: { employee: User; kind: NoteKind }) {
  const { title, icon: Icon, tone, placeholder } = KINDS[kind]
  const add = useAddEmployeeNote()
  const [text, setText] = useState('')
  const items: EmployeeNote[] = [...employee[kind]].sort((a, b) => b.at.getTime() - a.at.getTime())

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    add.mutate(
      { employee, kind, text },
      { onSuccess: () => setText(''), onError: (err) => toast.error(errorMessage(err)) },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`size-4 ${tone}`} aria-hidden /> {title}
          <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            rows={2}
            aria-label={`New ${title.toLowerCase()}`}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!text.trim() || add.isPending}
          >
            {add.isPending && <Loader2 className="animate-spin" />} Add
          </Button>
        </form>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id} className="border-l-2 pl-3 text-sm">
                <p>{n.text}</p>
                <p className="text-xs text-muted-foreground">
                  {n.by} · {formatDate(n.at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
