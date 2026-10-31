import { ChevronRight, Moon } from 'lucide-react'
import { Link } from 'react-router'
import { TonePill } from '@/components/common/StatusPill'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { ResetDemoCard } from '../components/ResetDemoCard'
import { SETTINGS_SECTIONS } from '../sections'

export function SettingsPage() {
  const { theme, set } = useTheme()

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {SETTINGS_SECTIONS.map(({ slug, title, description, icon: Icon, later }) => {
        const content = (
          <Card
            className={cn(
              'h-full transition-colors',
              later ? 'opacity-60' : 'hover:border-primary/40',
            )}
          >
            <CardContent className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  {title}
                  {later && <TonePill tone="neutral">Later</TonePill>}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              {!later && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            </CardContent>
          </Card>
        )
        return later ? (
          <div key={slug} aria-disabled>
            {content}
          </div>
        ) : (
          <Link
            key={slug}
            to={`/settings/${slug}`}
            className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {content}
          </Link>
        )
      })}
      <Card>
        <CardContent className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Moon className="size-5" aria-hidden />
          </span>
          <div className="flex-1 space-y-1">
            <div className="font-medium">Theme</div>
            <p className="text-sm text-muted-foreground">Dark mode on this device</p>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(dark) => set(dark ? 'dark' : 'light')}
            aria-label="Dark mode"
          />
        </CardContent>
      </Card>
      <ResetDemoCard />
    </div>
  )
}
