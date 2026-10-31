/**
 * Downloads the first screen of each role while the login form is open, so after "Sign in"
 * only the data has to load (the page code is already in the browser cache).
 */
export function preloadHomePages() {
  void import('@/features/dashboard/pages/DashboardPage')
  void import('@/features/attendance/pages/ClockPage')
}
