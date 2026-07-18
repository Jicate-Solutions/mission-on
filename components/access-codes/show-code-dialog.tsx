'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/access-codes/show-code-dialog.tsx — the ONE place a plaintext
// access code is ever rendered. Shared by generate + regenerate flows.
//
// Codes are SHOW-ONCE: this dialog is the only moment the code exists on
// screen. There is no "view code again" action anywhere else — a lost code is
// regenerated, not re-displayed (doc/update.md §3-4, confirmed design decision).
//
// Callers MUST render this with `key={code}` so the copied/acknowledged state
// resets via remount for each newly-issued code, rather than via an effect.
// =============================================================================

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'

export function ShowCodeDialog({
  open,
  code,
  displayName,
  onClose,
}: {
  open: boolean
  code: string
  displayName: string
  onClose: () => void
}) {
  const [copied, setCopied] = React.useState(false)
  const [acknowledged, setAcknowledged] = React.useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard access can fail (permissions/insecure context) — the code is
      // still visible on screen to copy by hand.
    }
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="show-code-title">
      <DialogHeader>
        <DialogTitle id="show-code-title">
          Access code for {displayName}
        </DialogTitle>
        <DialogDescription>
          This code is shown only once. Copy or write it down now — it cannot be
          displayed again. If it&apos;s lost later, regenerate a new one from the
          roster.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-4 py-3">
          <code className="font-mono text-lg tracking-wide text-ink">
            {code}
          </code>
          <Button variant="secondary" size="sm" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          I have copied this code
        </label>
      </DialogBody>
      <DialogFooter>
        <Button variant="primary" onClick={onClose} disabled={!acknowledged}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
