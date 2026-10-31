import { isManagerRole } from '@cityreach/shared'
import { ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { titleFor } from '@/app/routes'
import { useProfile } from '@/features/auth/queries'
import { useCurrentUser } from '@/features/auth/session'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useTheme } from '@/hooks/use-theme'
import { LogoutDialog } from './LogoutDialog'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useCurrentUser()
  const { data: profile } = useProfile(user.uid)
  const { theme, toggle } = useTheme()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const { pathname } = useLocation()
  const title = titleFor(pathname, user.access.role)

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open menu"
      >
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="hidden text-xs text-muted-foreground sm:block">Digital Manager / {title}</p>
        <h1 className="truncate text-xl font-semibold">{title}</h1>
      </div>

      {isManagerRole(user.access.role) && (
        <label className="hidden h-9 w-72 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground lg:flex">
          <Search className="size-4" aria-hidden />
          <input
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Search employees, tasks, items…"
            aria-label="Search"
          />
        </label>
      )}

      <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle dark mode">
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border bg-card py-1 pr-2 pl-1 text-left"
            aria-label="Account menu"
          >
            <EmployeeAvatar name={user.name} id={user.uid} size="sm" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="block text-xs text-muted-foreground">
                {profile?.position ?? '…'}
              </span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmLogout(true)}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
    </header>
  )
}
