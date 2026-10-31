import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  clockIn,
  clockOut,
  getAttendancePhoto,
  listAttendanceRange,
  listMyAttendance,
  saveCorrection,
  type ClockContext,
  type ClockInCapture,
  type ClockOutCapture,
  type Correction,
} from './api'
import type { Attendance, Branch } from '@dm/shared'

export function useMyAttendance() {
  const { uid } = useCurrentUser()
  return useQuery({ queryKey: qk.myAttendance(uid), queryFn: () => listMyAttendance(uid) })
}

export function useAttendanceRange(from: string, to: string) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.attendanceRange(branchId, from, to),
    queryFn: () => listAttendanceRange(branchId, from, to),
  })
}

/** Attendance changes also refresh employee profiles, which show attendance history. */
function useAttendanceMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.attendance, qk.employees),
  })
}

export function useClockIn() {
  const actor = useCurrentUser()
  return useAttendanceMutation(({ ctx, capture }: { ctx: ClockContext; capture: ClockInCapture }) =>
    clockIn(ctx, actor, capture),
  )
}

export function useClockOut() {
  const actor = useCurrentUser()
  return useAttendanceMutation(
    ({
      record,
      branch,
      capture,
    }: {
      record: Attendance
      branch: Branch
      capture: ClockOutCapture
    }) => clockOut(record, branch, actor, capture),
  )
}

/** The clock-in photo, fetched only when the manager opens it. Photos never change. */
export function useAttendancePhoto(recordId: string | null) {
  return useQuery({
    queryKey: qk.attendancePhoto(recordId),
    queryFn: () => getAttendancePhoto(recordId ?? ''),
    enabled: recordId !== null,
    staleTime: Infinity,
  })
}

export function useSaveCorrection() {
  const actor = useCurrentUser()
  return useAttendanceMutation(
    ({ correction, branch }: { correction: Correction; branch: Branch }) =>
      saveCorrection(correction, branch, actor),
  )
}
