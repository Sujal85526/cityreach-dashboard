import { MessageCircle } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'

// Loaded when first opened, so the assistant adds nothing to the first screen.
const AssistantPanel = lazy(() =>
  import('./AssistantPanel').then((m) => ({ default: m.AssistantPanel })),
)

/** The round button on every screen. The panel stays mounted, so the conversation survives closing it. */
export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  return (
    <>
      {!isOpen && (
        <Button
          size="icon"
          aria-label="Open assistant"
          className="fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg"
          onClick={() => {
            setHasOpened(true)
            setIsOpen(true)
          }}
        >
          <MessageCircle className="size-6" />
        </Button>
      )}
      {hasOpened && (
        <Suspense fallback={null}>
          <AssistantPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
