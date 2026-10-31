import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { NAV } from '@/app/routes'
import { LogoMark, Wordmark } from '@/components/brand/Logo'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentUser } from '@/features/auth/session'
import { cn } from '@/lib/utils'
import { LogoutDialog } from './LogoutDialog'

interface SidebarProps {
  /** Icon-only rail (desktop); labels move into tooltips. */
  collapsed?: boolean
  /** Desktop: fold/unfold the rail. Mobile sheet: close it. */
  onToggle?: () => void
  onNavigate?: () => void
}

/** Brand-green sidebar with the cream wordmark. Fixed on desktop (collapsible), inside a sheet on mobile. */
export function Sidebar({ collapsed = false, onToggle, onNavigate }: SidebarProps) {
  const user = useCurrentUser()
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div
        className={cn('flex items-center gap-3 pt-5 pb-5', collapsed ? 'flex-col px-2' : 'px-4')}
      >
        {/* The logo lockup as supplied: cream wordmark on a brand-green plate. */}
        {collapsed ? (
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-cream">
            <LogoMark className="size-5" />
          </span>
        ) : (
          <span className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-brand-cream">
            <Wordmark className="h-3 w-full max-w-36" />
          </span>
        )}
        {onToggle && (
          <Hint label="Expand sidebar" show={collapsed}>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-muted hover:text-foreground"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? undefined : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden />
              )}
            </button>
          </Hint>
        )}
      </div>

      <nav
        className={cn(
          'flex-1 space-y-4 overflow-y-auto py-1 [scrollbar-width:thin]',
          collapsed ? 'px-2' : 'px-3',
        )}
        aria-label="Main"
      >
        {NAV[user.access.role].map((group) => (
          <div key={group.label} className="space-y-0.5">
            {collapsed ? (
              <div className="mx-2 my-1 border-t border-sidebar-border" aria-hidden />
            ) : (
              <p className="px-3 pt-1 pb-1 text-[11px] font-medium tracking-[0.12em] text-sidebar-muted uppercase">
                {group.label}
              </p>
            )}
            {group.items.map(({ to, label, icon: Icon }) => (
              <Hint key={to} label={label} show={collapsed}>
                <NavLink
                  to={to}
                  end={to === '/' || to === '/me'}
                  onClick={onNavigate}
                  aria-label={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 rounded-lg py-2 text-sm whitespace-nowrap transition-colors duration-200',
                      collapsed ? 'justify-center px-0' : 'px-3',
                      isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r-full bg-primary"
                          aria-hidden
                        />
                      )}
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {!collapsed && label}
                    </>
                  )}
                </NavLink>
              </Hint>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg py-2',
            collapsed ? 'flex-col px-0' : 'px-2',
          )}
        >
          <EmployeeAvatar name={user.name} id={user.uid} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
              <div className="truncate text-xs text-sidebar-muted capitalize">
                {user.access.role}
              </div>
            </div>
          )}
          <Hint label="Switch role" show={collapsed}>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="rounded-lg p-2 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Switch role"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </Hint>
        </div>
      </div>
      <LogoutDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
    </div>
  )
}

/** Tooltip to the right of a rail icon; plain child when the sidebar is expanded. */
function Hint({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  if (!show) return children
  return (
    <Tooltip>
      {/* A wrapper, because Slot would flatten NavLink's className function into a string. */}
      <TooltipTrigger asChild>
        <div>{children}</div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
