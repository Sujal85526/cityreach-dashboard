import { CANDIDATE_STAGES, type Candidate } from '@cityreach/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TonePill } from '@/components/common/StatusPill'
import { useDocuments } from '@/features/documents/queries'
import { RecordList } from '@/features/records/components/RecordList'
import { useModuleContext } from '@/features/records/context'
import { useRecords } from '@/features/records/queries'
import { candidatesModule, STAGE } from '../modules'

/** Manager: the hiring pipeline (applied → interview → offer → hired / rejected). */
export function RecruitmentPage() {
  const ctx = useModuleContext()
  const docs = useDocuments()
  const list = useRecords<Candidate>('candidates')
  if (!ctx || !docs.data) return <Skeleton className="h-64 w-full rounded-xl" />
  const cvs = docs.data.filter((d) => d.category === 'CV')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CANDIDATE_STAGES.map((s) => (
          <TonePill key={s} tone={STAGE[s][1]} className="px-3 py-1 text-sm">
            {STAGE[s][0]}: {(list.data ?? []).filter((c) => c.stage === s).length}
          </TonePill>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <RecordList module={candidatesModule(ctx, cvs)} />
        </CardContent>
      </Card>
    </div>
  )
}
