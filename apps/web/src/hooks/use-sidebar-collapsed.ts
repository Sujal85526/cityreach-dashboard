import { useCallback, useState } from 'react'

const STORAGE_KEY = 'cityreach-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false // Storage unavailable (private mode): start expanded.
  }
}

/** Desktop sidebar folded to an icon rail or expanded; remembered per browser. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Not critical: the choice just won't be remembered.
      }
      return next
    })
  }, [])

  return { collapsed, toggle }
}
