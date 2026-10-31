import { useSearchParams } from 'react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BestDaysTab } from '../components/BestDaysTab'
import { LabourTab } from '../components/LabourTab'
import { ReorderTab } from '../components/ReorderTab'
import { WasteTab } from '../components/WasteTab'

const TABS = [
  { id: 'labour', label: 'Labour vs sales', Content: LabourTab },
  { id: 'days', label: 'Best & worst days', Content: BestDaysTab },
  { id: 'waste', label: 'Waste', Content: WasteTab },
  { id: 'reorder', label: 'Reorder', Content: ReorderTab },
] as const

/** Manager: what the shop's own records say about staff cost, busy days, waste and what to buy. */
export function InsightsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'labour'
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Insights</h2>
        <p className="text-sm text-muted-foreground">
          Worked out from your sales, attendance, payslips and stock records.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(id) => setParams({ tab: id }, { replace: true })}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map(({ id, Content }) => (
          <TabsContent key={id} value={id} className="space-y-6 pt-2">
            <Content />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
