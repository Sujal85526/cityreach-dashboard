import type { Notification } from '@cityreach/shared'
import { BellOff } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentUser } from '@/features/auth/session'
import { linkFor, NOTIFICATION_PAGE } from '../api'
import { NotificationItem } from '../components/NotificationItem'
import { useMarkRead, useNotifications } from '../queries'

/** All notifications (manager: branch alerts; employee: their own), live. */
export function NotificationsPage() {
  const user = useCurrentUser()
  const list = useNotifications()
  const markRead = useMarkRead()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  if (list.error) return <ErrorState error={list.error} />
  const all = list.data ?? []
  const unread = all.filter((n) => n.readAt === null)
  const shown = tab === 'unread' ? unread : all
  // No counts until the first snapshot arrives, so the header never claims "0 unread" while loading.
  const count = (n: number) => (list.isPending ? '' : ` (${n})`)

  const open = (n: Notification) => {
    if (n.readAt === null) markRead.mutate([n.id])
    navigate(linkFor(n, user.access.role))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="All notifications"
        description={`${list.isPending ? 'Loading' : `${unread.length} unread`} · created automatically by the rules (latest ${NOTIFICATION_PAGE})`}
        actions={
          <Button
            variant="outline"
            disabled={unread.length === 0 || markRead.isPending}
            onClick={() => markRead.mutate(unread.map((n) => n.id))}
          >
            Mark all as read
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All{count(all.length)}</TabsTrigger>
          <TabsTrigger value="unread">Unread{count(unread.length)}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="space-y-1 p-2">
          {list.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            />
          ) : (
            shown.map((n) => <NotificationItem key={n.id} n={n} onClick={() => open(n)} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
