import { isManagerRole, type Notification } from '@cityreach/shared'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentUser } from '@/features/auth/session'
import { linkFor } from '../api'
import { useMarkRead, useNotifications, useUnreadCount } from '../queries'
import { NotificationItem } from './NotificationItem'

/** Top-bar bell: live unread badge and the five latest notifications. */
export function NotificationBell() {
  const user = useCurrentUser()
  const unread = useUnreadCount().data ?? 0
  const list = useNotifications().data ?? []
  const markRead = useMarkRead()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const page = isManagerRole(user.access.role) ? '/notifications' : '/me/notifications'

  const openItem = (n: Notification) => {
    if (n.readAt === null) markRead.mutate([n.id])
    setOpen(false)
    navigate(linkFor(n, user.access.role))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                markRead.mutate(list.filter((n) => n.readAt === null).map((n) => n.id))
              }
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            list
              .slice(0, 5)
              .map((n) => <NotificationItem key={n.id} n={n} compact onClick={() => openItem(n)} />)
          )}
        </div>
        <div className="border-t p-2 text-center">
          <Link
            to={page}
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
