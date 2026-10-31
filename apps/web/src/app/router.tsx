import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/features/auth/pages/LandingPage'
import { BranchGate } from '@/features/settings/components/BranchGate'
import { FullScreenLoader, RequireRole } from './guards'

/**
 * Each page is its own download, fetched the first time it's opened. An employee clocking in
 * on a phone never downloads the charts, PDF library or manager screens.
 */
const page = (load: () => Promise<React.ComponentType>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: await load() }),
})

export const router = createBrowserRouter([
  { path: '/login', element: <LandingPage /> },
  {
    element: <RequireRole role="manager" />,
    children: [
      {
        element: <BranchGate />,
        children: [
          {
            element: <AppShell />,
            hydrateFallbackElement: <FullScreenLoader />,
            children: [
              {
                index: true,
                ...page(() =>
                  import('@/features/dashboard/pages/DashboardPage').then((m) => m.DashboardPage),
                ),
              },
              {
                path: 'employees',
                ...page(() =>
                  import('@/features/employees/pages/EmployeesPage').then((m) => m.EmployeesPage),
                ),
              },
              {
                path: 'employees/:uid',
                ...page(() =>
                  import('@/features/employees/pages/EmployeeProfilePage').then(
                    (m) => m.EmployeeProfilePage,
                  ),
                ),
              },
              {
                path: 'attendance',
                ...page(() =>
                  import('@/features/attendance/pages/AttendancePage').then(
                    (m) => m.AttendancePage,
                  ),
                ),
              },
              {
                path: 'leave',
                ...page(() => import('@/features/leave/pages/LeavePage').then((m) => m.LeavePage)),
              },
              {
                path: 'calendar',
                ...page(() =>
                  import('@/features/calendar/pages/CalendarPage').then((m) => m.CalendarPage),
                ),
              },
              {
                path: 'tasks',
                ...page(() => import('@/features/tasks/pages/TasksPage').then((m) => m.TasksPage)),
              },
              {
                path: 'inventory',
                ...page(() =>
                  import('@/features/inventory/pages/InventoryPage').then((m) => m.InventoryPage),
                ),
              },
              {
                path: 'suppliers',
                ...page(() =>
                  import('@/features/suppliers/pages/SuppliersPage').then((m) => m.SuppliersPage),
                ),
              },
              {
                path: 'reports',
                ...page(() =>
                  import('@/features/reports/pages/ReportsPage').then((m) => m.ReportsPage),
                ),
              },
              {
                path: 'rota',
                ...page(() => import('@/features/rota/pages/RotaPage').then((m) => m.RotaPage)),
              },
              {
                path: 'recruitment',
                ...page(() =>
                  import('@/features/people/pages/RecruitmentPage').then((m) => m.RecruitmentPage),
                ),
              },
              {
                path: 'operations',
                ...page(() =>
                  import('@/features/operations/pages/OperationsPage').then(
                    (m) => m.OperationsPage,
                  ),
                ),
              },
              {
                path: 'food-safety',
                ...page(() =>
                  import('@/features/food-safety/pages/FoodSafetyPage').then(
                    (m) => m.FoodSafetyPage,
                  ),
                ),
              },
              {
                path: 'equipment',
                ...page(() =>
                  import('@/features/equipment/pages/EquipmentPage').then((m) => m.EquipmentPage),
                ),
              },
              {
                path: 'feedback',
                ...page(() =>
                  import('@/features/feedback/pages/FeedbackPage').then((m) => m.FeedbackPage),
                ),
              },
              {
                path: 'purchasing',
                ...page(() =>
                  import('@/features/purchasing/pages/PurchasingPage').then(
                    (m) => m.PurchasingPage,
                  ),
                ),
              },
              {
                path: 'finance',
                ...page(() =>
                  import('@/features/finance/pages/FinancePage').then((m) => m.FinancePage),
                ),
              },
              {
                path: 'insights',
                ...page(() =>
                  import('@/features/insights/pages/InsightsPage').then((m) => m.InsightsPage),
                ),
              },
              {
                path: 'branches/all',
                ...page(() =>
                  import('@/features/branches/pages/AllBranchesPage').then(
                    (m) => m.AllBranchesPage,
                  ),
                ),
              },
              {
                path: 'branches',
                ...page(() =>
                  import('@/features/branches/pages/BranchesPage').then((m) => m.BranchesPage),
                ),
              },
              {
                path: 'documents',
                ...page(() =>
                  import('@/features/documents/pages/DocumentsPage').then((m) => m.DocumentsPage),
                ),
              },
              {
                path: 'notifications',
                ...page(() =>
                  import('@/features/notifications/pages/NotificationsPage').then(
                    (m) => m.NotificationsPage,
                  ),
                ),
              },
              {
                path: 'settings',
                ...page(() =>
                  import('@/features/settings/pages/SettingsPage').then((m) => m.SettingsPage),
                ),
              },
              {
                path: 'settings/:section',
                ...page(() =>
                  import('@/features/settings/pages/SettingsSectionPage').then(
                    (m) => m.SettingsSectionPage,
                  ),
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/me',
    element: <RequireRole role="employee" />,
    children: [
      {
        element: <AppShell />,
        hydrateFallbackElement: <FullScreenLoader />,
        children: [
          {
            index: true,
            ...page(() => import('@/features/attendance/pages/ClockPage').then((m) => m.ClockPage)),
          },
          {
            path: 'tasks',
            ...page(() => import('@/features/tasks/pages/MyTasksPage').then((m) => m.MyTasksPage)),
          },
          {
            path: 'attendance',
            ...page(() =>
              import('@/features/attendance/pages/MyAttendancePage').then(
                (m) => m.MyAttendancePage,
              ),
            ),
          },
          {
            path: 'leave',
            ...page(() => import('@/features/leave/pages/MyLeavePage').then((m) => m.MyLeavePage)),
          },
          {
            path: 'shop',
            ...page(() => import('@/features/operations/pages/ShopPage').then((m) => m.ShopPage)),
          },
          {
            path: 'rota',
            ...page(() => import('@/features/rota/pages/MyRotaPage').then((m) => m.MyRotaPage)),
          },
          {
            path: 'growth',
            ...page(() =>
              import('@/features/people/pages/MyGrowthPage').then((m) => m.MyGrowthPage),
            ),
          },
          {
            path: 'notifications',
            ...page(() =>
              import('@/features/notifications/pages/NotificationsPage').then(
                (m) => m.NotificationsPage,
              ),
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
