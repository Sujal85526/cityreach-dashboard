import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Soft backgrounds from the chart palette so avatars stay on-theme in light and dark mode.
const COLORS = [
  'bg-chart-1 text-primary-foreground',
  'bg-chart-2 text-foreground',
  'bg-chart-3 text-foreground',
  'bg-chart-4 text-primary-foreground',
  'bg-primary text-primary-foreground',
]

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/** Stable colour per person, from their id or name. */
function colorFor(key: string) {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

interface EmployeeAvatarProps {
  name: string
  id?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-14 text-base' }

export function EmployeeAvatar({ name, id, size = 'md', className }: EmployeeAvatarProps) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      <AvatarFallback className={cn('font-semibold', colorFor(id ?? name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
