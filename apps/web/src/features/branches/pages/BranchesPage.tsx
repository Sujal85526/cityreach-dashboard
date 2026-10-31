import { branchInfoSchema, type BranchInfo } from '@dm/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Building2, Crown, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { TonePill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/session'
import { useBranch } from '@/features/settings/queries'
import { errorMessage } from '@/lib/errors'
import { claimOwnership, listMyBranches, openBranch, switchBranch } from '../api'

/** After a role or branch change the whole app reloads, so every screen shows the new branch. */
const reload = () => window.location.reload()

/**
 * Owner: every branch they own, switch between them, open a new one. A manager of a branch with
 * no owner can claim it (becoming the owner) to unlock this.
 */
export function BranchesPage() {
  const actor = useCurrentUser()
  const current = useBranch().data
  const isOwner = actor.access.role === 'owner'
  const mine = useQuery({
    queryKey: ['branches', 'mine', actor.uid],
    queryFn: () => listMyBranches(actor.uid),
    enabled: isOwner,
  })
  const switchTo = useMutation({
    mutationFn: (id: string) => switchBranch(id, actor),
    onSuccess: reload,
  })
  const claim = useMutation({ mutationFn: () => claimOwnership(actor), onSuccess: reload })
  const open = useMutation({
    mutationFn: (info: BranchInfo) => openBranch(info, actor),
    onSuccess: () => {
      toast.success('Branch opened. Switch to it to add its staff and settings.')
      setForm((f) => ({ ...f, name: '', address: '', phone: '' }))
      void mine.refetch()
    },
  })
  const [form, setForm] = useState<BranchInfo>({
    name: '',
    address: '',
    phone: '',
    timeZone: current?.rules.timeZone ?? 'Asia/Dubai',
  })

  if (!current) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!isOwner)
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="size-5" /> Run several branches
          </CardTitle>
          <CardDescription>
            {current.ownerId
              ? 'This branch already has an owner. Ask them to switch you, or to open new branches.'
              : 'Become the owner of this branch to open more branches and switch between them. Managers keep running their own branch.'}
          </CardDescription>
        </CardHeader>
        {!current.ownerId && (
          <CardContent>
            <Button
              onClick={() =>
                claim.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })
              }
              disabled={claim.isPending}
            >
              {claim.isPending && <Loader2 className="animate-spin" />} Become the owner
            </Button>
          </CardContent>
        )}
      </Card>
    )
  if (mine.error) return <ErrorState error={mine.error} />

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const check = branchInfoSchema.safeParse(form)
    if (!check.success) return toast.error('Give the branch a name.')
    open.mutate(check.data, { onError: (err) => toast.error(errorMessage(err)) })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Your branches</CardTitle>
          <CardDescription>Everything in the app shows the open branch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!mine.data ? (
            <Skeleton className="h-24 w-full" />
          ) : mine.data.length === 0 ? (
            <EmptyState icon={Building2} title="No branches" />
          ) : (
            mine.data.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.address || b.rules.timeZone}
                  </div>
                </div>
                {b.id === actor.access.branchId ? (
                  <TonePill tone="success">Open now</TonePill>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={switchTo.isPending}
                    onClick={() =>
                      switchTo.mutate(b.id, { onError: (e) => toast.error(errorMessage(e)) })
                    }
                  >
                    Switch to it
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <form onSubmit={submit} noValidate>
          <CardHeader>
            <CardTitle>Open a new branch</CardTitle>
            <CardDescription>
              It starts with the default settings; switch to it to add staff, shifts and stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['name', 'address', 'phone'] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`b-${k}`} className="capitalize">
                  {k}
                </Label>
                <Input
                  id={`b-${k}`}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  placeholder={k === 'name' ? 'e.g. Al Qana pop-up' : undefined}
                />
              </div>
            ))}
            <Button type="submit" disabled={open.isPending}>
              {open.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Open branch
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
