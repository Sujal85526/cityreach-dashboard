import { isManagerRole } from '@dm/shared'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
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
        <main className="flex-1 space-y-6 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Rule-based background checks run only in a manager's session (free-plan automation). */
function ManagerAutomation() {
  useAutomation()
  return null
}
