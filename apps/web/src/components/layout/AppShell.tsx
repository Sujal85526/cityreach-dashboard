import { isManagerRole } from '@cityreach/shared'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { AssistantWidget } from '@/features/assistant/components/AssistantWidget'
import { useCurrentUser } from '@/features/auth/session'
import { useAutomation } from '@/features/automation/useAutomation'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { cn } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Fixed sidebar from 1024 px (laptops), collapsible to an icon rail; slide-in sheet on phones and tablets so tables get the full width. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebar = useSidebarCollapsed()
  const isManager = isManagerRole(useCurrentUser().access.role)
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 overflow-hidden transition-[width] duration-200 lg:block',
          sidebar.collapsed ? 'w-16' : 'w-64',
        )}
      >
        <Sidebar collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 border-none p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <Sidebar onToggle={() => setMenuOpen(false)} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {isManager && <ManagerAutomation />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        {/* Bottom padding keeps the assistant button off the last row. */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 pb-20 md:p-8 md:pb-20">
          {/* Re-keyed per page so each route fades in; reduced-motion users get no animation. */}
          <div key={pathname} className="animate-page-in space-y-6 md:space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AssistantWidget />
    </div>
  )
}

/** Rule-based background checks run only in a manager's session (free-plan automation). */
function ManagerAutomation() {
  useAutomation()
  return null
}
