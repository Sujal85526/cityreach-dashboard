import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SettingsCardProps {
  title: string
  description?: string
  children: ReactNode
  /** When set, the card is a form with a Save button. */
  onSubmit?: (e: React.FormEvent) => void
  saving?: boolean
  dirty?: boolean
  submitLabel?: string
}

/** Frame for every settings section: title, body and a Save button bound to the form. */
export function SettingsCard({
  title,
  description,
  children,
  onSubmit,
  saving,
  dirty = true,
  submitLabel = 'Save changes',
}: SettingsCardProps) {
  const body = (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {onSubmit && (
        <CardFooter className="justify-end border-t pt-4">
          <Button type="submit" disabled={saving || !dirty}>
            {saving && <Loader2 className="animate-spin" />} {submitLabel}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
  return onSubmit ? (
    <form onSubmit={onSubmit} noValidate>
      {body}
    </form>
  ) : (
    body
  )
}
