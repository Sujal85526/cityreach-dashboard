import { useEffect, useState } from 'react'

type Subscribe<T> = (onData: (data: T) => void, onError: (error: Error) => void) => () => void

interface LiveState<T> {
  data: T | undefined
  error: Error | null
  isPending: boolean
}

/**
 * Real-time data from a store listener (`onSnapshot`). Used only where live updates matter
 * (task board, my tasks, notification bell); everything else is a cached query.
 * `key` must change when the subscription's inputs change.
 */
export function useLive<T>(key: string | null, subscribe: Subscribe<T>): LiveState<T> {
  const [state, setState] = useState<LiveState<T> & { key: string | null }>({
    key,
    data: undefined,
    error: null,
    isPending: true,
  })

  useEffect(() => {
    if (!key) return
    return subscribe(
      (data) => setState({ key, data, error: null, isPending: false }),
      (error) => setState({ key, data: undefined, error, isPending: false }),
    )
    // `subscribe` is recreated every render; `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state.key === key ? state : { data: undefined, error: null, isPending: true }
}
