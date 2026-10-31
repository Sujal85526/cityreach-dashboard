import type { Branch } from '@cityreach/shared'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateBranch } from '../queries'
import { SettingsCard } from './SettingsCard'

export function TaskCategoriesForm({ branch }: { branch: Branch }) {
  const [categories, setCategories] = useState(branch.taskCategories)
  const [draft, setDraft] = useState('')
  const update = useUpdateBranch()
  const dirty = categories.join('|') !== branch.taskCategories.join('|')

  const add = () => {
    const name = draft.trim()
    if (!name) return
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase()))
      return toast.error(`"${name}" is already a category.`)
    setCategories([...categories, name])
    setDraft('')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (categories.length === 0) return toast.error('Keep at least one category.')
    update.mutate(
      { patch: { taskCategories: categories }, what: 'task categories' },
      {
        onSuccess: () => toast.success('Categories saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Task categories"
      description="Offered when creating a task. Removing one doesn't change existing tasks."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li
            key={c}
            className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-sm"
          >
            {c}
            <button
              type="button"
              onClick={() => setCategories(categories.filter((x) => x !== c))}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Remove ${c}`}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex max-w-sm gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New category"
          maxLength={30}
          aria-label="New category"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus /> Add
        </Button>
      </div>
    </SettingsCard>
  )
}
