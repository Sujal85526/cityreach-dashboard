import {
  Bell,
  Building2,
  CalendarDays,
  Clock,
  Gauge,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tags,
  type LucideIcon,
} from 'lucide-react'

export interface SettingsSection {
  slug: string
  title: string
  description: string
  icon: LucideIcon
  /** Not part of v1 (docs/PRODUCT.md "Out of scope"); shown greyed out like the prototype. */
  later?: boolean
}

/** Cards on /settings, in prototype order. Theme is handled inline on the page. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    slug: 'shop',
    title: 'Business information',
    description: 'Name, address, phone and timezone',
    icon: Store,
  },
  {
    slug: 'hours',
    title: 'Business hours & shifts',
    description: 'Opening hours and the shifts staff work',
    icon: Clock,
  },
  {
    slug: 'location',
    title: 'Shop location',
    description: 'Where staff should be when they clock in',
    icon: MapPin,
  },
  {
    slug: 'rules',
    title: 'Attendance & stock rules',
    description: 'Grace periods, absent threshold, critical stock level',
    icon: SlidersHorizontal,
  },
  {
    slug: 'leave',
    title: 'Leave types',
    description: 'What staff can request and days per year',
    icon: CalendarDays,
  },
  {
    slug: 'tasks',
    title: 'Task categories',
    description: 'Categories offered when creating tasks',
    icon: Tags,
  },
  {
    slug: 'notifications',
    title: 'Notification preferences',
    description: 'Which automatic alerts you receive',
    icon: Bell,
  },
  {
    slug: 'performance',
    title: 'Performance weights',
    description: 'How the score out of 100 is calculated',
    icon: Gauge,
  },
  {
    slug: 'branches',
    title: 'Branches',
    description: 'Run several locations (owner)',
    icon: Building2,
  },
  {
    slug: 'permissions',
    title: 'User permissions',
    description: 'Custom roles and per-feature access',
    icon: ShieldCheck,
    later: true,
  },
]
