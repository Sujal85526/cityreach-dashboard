# UI rules

- Match `docs/PROTOTYPE.md`: same navigation, card layout, table columns, pills, colours. When the prototype and `docs/PRODUCT.md` disagree, the product doc wins (e.g. drop Revenue/POS).
- Colours only through theme tokens in `src/index.css` (`bg-card`, `text-muted-foreground`, `bg-success-soft text-success`…). No hex values in components.
- One `StatusPill` maps every status (attendance, task, stock, priority, notification type) to a tone. Add new statuses there, not inline.
- Build from shadcn/ui primitives in `components/ui`; icons from lucide-react.
- Free text with suggestions (position, category, unit) uses `SuggestInput`, never a native `<datalist>`: its grey browser popup can't be themed.
- Every data view has loading (skeleton), empty and error states.
- Forms: React Hook Form + zodResolver with the shared schema; disable submit while pending; toast on success/error.
- Responsive: manager screens desktop-first but usable on tablet; **employee screens phone-first** (375 px): big tap targets (≥ 44 px), bottom-reachable primary action.
- Dates and times shown in the branch timezone with date-fns; relative times ("5 min ago") for feeds.
- Accessibility: labels on inputs, `aria-label` on icon buttons, focus visible, colour never the only signal (pill text says the status).
