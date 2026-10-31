import type { StoredDocument } from '@cityreach/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  deleteDocument,
  listDocuments,
  updateDocumentDetails,
  uploadDocument,
  type DocumentInput,
  type Upload,
} from './api'

export function useDocuments() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.documents(branchId), queryFn: () => listDocuments(branchId) })
}

function useDocumentMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  const { branchId } = useCurrentUser().access
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.documents(branchId)),
  })
}

export function useUploadDocument() {
  const actor = useCurrentUser()
  return useDocumentMutation((input: Upload) => uploadDocument(input, actor))
}

export function useUpdateDocument() {
  const actor = useCurrentUser()
  return useDocumentMutation(({ d, input }: { d: StoredDocument; input: DocumentInput }) =>
    updateDocumentDetails(d, input, actor),
  )
}

export function useDeleteDocument() {
  const actor = useCurrentUser()
  return useDocumentMutation((d: StoredDocument) => deleteDocument(d, actor))
}
