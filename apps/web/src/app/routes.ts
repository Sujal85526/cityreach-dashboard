import { isManagerRole, type Role } from '@cityreach/shared'
import {
  Bell,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  FolderLock,
  GraduationCap,
  KanbanSquare,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  MessageSquareHeart,
  Package,
  Settings,
  KeyRound,
  ShoppingCart,
  Thermometer,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}
export interface NavGroup {
  label: string
  items: NavItem[]
}

const MANAGER_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/calendar', label: 'Calendar', icon: CalendarRange },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/rota', label: 'Rota', icon: CalendarClock },
      { to: '/leave', label: 'Leave & pay', icon: CalendarDays },
      { to: '/recruitment', label: 'Recruitment', icon: UserPlus },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/tasks', label: 'Tasks', icon: KanbanSquare },
      { to: '/operations', label: 'Checklists & logs', icon: ClipboardCheck },
      { to: '/food-safety', label: 'Food safety', icon: Thermometer },
      { to: '/equipment', label: 'Equipment', icon: Wrench },
      { to: '/feedback', label: 'Customer feedback', icon: MessageSquareHeart },
    ],
  },
  {
    label: 'Stock',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Package },
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/purchasing', label: 'Purchasing', icon: ShoppingCart },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/finance', label: 'Sales & finance', icon: Wallet },
      { to: '/insights', label: 'Insights', icon: Lightbulb },
      { to: '/reports', label: 'Performance Reports', icon: BarChart3 },
      { to: '/documents', label: 'Documents', icon: FolderLock },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

/** Sidebar groups per role. Owners get the manager menu plus Branches. */
export const NAV: Record<Role, NavGroup[]> = {
  manager: MANAGER_NAV,
  owner: MANAGER_NAV.map((g) =>
    g.label === 'Business'
      ? {
          ...g,
          items: [
            ...g.items,
            { to: '/branches/all', label: 'All branches', icon: LayoutGrid },
            { to: '/branches', label: 'Branches', icon: Building2 },
          ],
        }
      : g,
  ),
  employee: [
    {
      label: 'My day',
      items: [
        { to: '/me', label: 'Clock in', icon: Clock },
        { to: '/me/tasks', label: 'My tasks', icon: ListChecks },
        { to: '/me/shop', label: 'Shop checklists & logs', icon: ClipboardCheck },
        { to: '/me/rota', label: 'My rota', icon: CalendarClock },
      ],
    },
    {
      label: 'Me',
      items: [
        { to: '/me/attendance', label: 'My attendance', icon: CalendarCheck },
        { to: '/me/leave', label: 'Leave & pay', icon: CalendarDays },
        { to: '/me/growth', label: 'Training & goals', icon: GraduationCap },
        { to: '/me/notifications', label: 'Notifications', icon: Bell },
        { to: '/me/security', label: 'Security', icon: KeyRound },
      ],
    },
  ],
}

export const homePathFor = (role: Role) => (isManagerRole(role) ? '/' : '/me')

/** Page title for the top bar; longest matching prefix wins. */
export function titleFor(pathname: string, role: Role): string {
  const match = NAV[role]
    .flatMap((g) => g.items)
    .filter(
      (item) => pathname === item.to || (item.to !== '/' && pathname.startsWith(`${item.to}/`)),
    )
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'City Reach'
}
