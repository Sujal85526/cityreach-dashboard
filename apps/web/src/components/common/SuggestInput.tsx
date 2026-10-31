import { cn } from 'cn'
import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

type SuggestInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'list'> & {
  value: string
  onChange: (value: string) => void
  suggestions: readonly string[]
}

/**
 * Free-text field with suggestions styled like the app's other menus. Replaces the native
 * <datalist>, whose grey browser popup can't be styled. Any text is still allowed.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  onKeyDown,
  ...input
}: SuggestInputProps) {
  const listId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(-1)

  // Typing filters the list; a value that already matches a suggestion shows them all to switch.
  const query = value.trim().toLowerCase()
  const isExactMatch = suggestions.some((s) => s.toLowerCase() === query)
  const matches =
    query && !isExactMatch
      ? suggestions.filter((s) => s.toLowerCase().includes(query))
      : suggestions
  const isShown = isOpen && matches.length > 0

  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  const pick = (suggestion: string) => {
    onChange(suggestion)
    setIsOpen(false)
    setActive(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step !== 0 && matches.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActive((i) => (i + step + matches.length) % matches.length)
    } else if (event.key === 'Enter' && isShown && active >= 0) {
      event.preventDefault() // pick the suggestion instead of submitting the form
      pick(matches[active] ?? value)
    } else if (event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <Popover open={isShown} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef}>
          <Input
            {...input}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setIsOpen(true)
              setActive(-1)
            }}
            onFocus={(e) => {
              setIsOpen(true)
              input.onFocus?.(e)
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isShown}
            aria-controls={listId}
            aria-activedescendant={isShown && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="max-h-60 w-(--radix-popover-trigger-width) overflow-y-auto p-1"
        // Keep typing in the field: don't move focus into the list, and clicking the field isn't "outside".
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
        }}
      >
        <ul id={listId} role="listbox">
          {matches.map((suggestion, i) => (
            <li
              key={suggestion}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(suggestion)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm select-none',
                i === active && 'bg-accent text-accent-foreground',
              )}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
