import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface ModuleTab {
  value: string
  label: string
  content: ReactNode
}

/** A page made of tabs, each a card (used by the operations, food-safety and equipment pages). */
export function ModuleTabs({
  title,
  description,
  tabs,
  loading,
  top,
}: {
  title: string
  description: string
  tabs: ModuleTab[]
  loading?: boolean
  top?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {top}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Tabs defaultValue={tabs[0]?.value}>
          <TabsList className="max-w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <Card>
                <CardContent className="pt-6">{t.content}</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
