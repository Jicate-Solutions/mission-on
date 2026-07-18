'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/access-codes/access-code-row.tsx — per-row Revoke/Regenerate
// controls for the access-code roster.
// =============================================================================

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  revokeAccessCode,
  regenerateAccessCode,
} from '@/app/(app)/super-admin/access-codes/_lib/actions'
import { ShowCodeDialog } from './show-code-dialog'

export function AccessCodeRow({
  codeId,
  status,
  displayName,
}: {
  codeId: string
  status: 'active' | 'revoked'
  displayName: string
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [revealedCode, setRevealedCode] = React.useState<string | null>(null)

  function onRevoke() {
    setError(null)
    startTransition(async () => {
      const res = await revokeAccessCode(codeId)
      if (!res.ok) setError(res.error ?? 'Could not revoke the access code.')
    })
  }

  function onRegenerate() {
    setError(null)
    startTransition(async () => {
      const res = await regenerateAccessCode(codeId)
      if (res.ok) {
        setRevealedCode(res.code)
      } else {
        setError(res.error ?? 'Could not regenerate the access code.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRegenerate}
          disabled={pending}
        >
          {pending ? '…' : 'Regenerate'}
        </Button>
        {status === 'active' ? (
          <Button
            variant="danger"
            size="sm"
            onClick={onRevoke}
            disabled={pending}
          >
            {pending ? '…' : 'Revoke'}
          </Button>
        ) : null}
      </div>
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
      <ShowCodeDialog
        key={revealedCode ?? 'none'}
        open={revealedCode !== null}
        code={revealedCode ?? ''}
        displayName={displayName}
        onClose={() => setRevealedCode(null)}
      />
    </div>
  )
}
