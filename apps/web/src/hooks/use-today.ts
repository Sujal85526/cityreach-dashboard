import { toDateKey } from '@dm/shared'
import { useTimeZone } from '@/features/settings/queries'

/** Today's local date ("YYYY-MM-DD") in the shop's timezone. */
export const useToday = () => toDateKey(new Date(), useTimeZone())
