'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/questionnaires/questionnaire-builder.tsx — Admin editor for the
// pre-session questionnaire template (PRD §7.3 / §15 Phase 2).
//
// An admin/super_admin edits the template title and its questions: each question
// has text, a category (A_demographic / A_behaviour / B) and a list of options;
// each option has a value, a label, a weight, and the A/B code it contributes to
// the classification tally. On save, the whole draft is serialised to JSON and
// submitted to the saveTemplate Server Action, which re-verifies admin internally
// and PUBLISHES A NEW VERSION (preserving older versions for in-flight responses).
//
// The option `code` directly drives lib/classification.ts: an A-question option's
// code (A1/A2/A3) feeds the behavioural divergence check; a B-question option's
// code (B1/B2/B3) plus its weight feed the usage tally that resolves the module.
// Keeping that shape correct is why the action re-validates server-side too.
// =============================================================================

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { saveTemplate } from '@/app/(app)/admin/questionnaires/_builder/actions'
import {
  A_CODES,
  B_CODES,
  CATEGORY_LABELS,
  QUESTION_CATEGORIES,
} from '@/app/(app)/admin/questionnaires/_builder/types'
import type {
  BuilderOption,
  BuilderQuestion,
  BuilderTemplate,
} from '@/app/(app)/admin/questionnaires/_builder/types'

function emptyOption(): BuilderOption {
  return { value: '', label: '', weight: 1, code: '' }
}

function emptyQuestion(): BuilderQuestion {
  return {
    id: '',
    category: 'B',
    text: '',
    options: [emptyOption()],
  }
}

/** Map the loaded template into the editable draft shape (code '' when absent). */
function toDraftQuestions(template: BuilderTemplate | null): BuilderQuestion[] {
  if (!template) return [emptyQuestion()]
  return template.questions.map((q) => ({
    id: q.id,
    category: q.category,
    text: q.text,
    options: q.options.map((o) => ({
      value: o.value,
      label: o.label,
      weight: o.weight,
      code: (o.code ?? '') as BuilderOption['code'],
    })),
  }))
}

export function QuestionnaireBuilder({
  template,
}: {
  /** The currently active template, or null if none exists yet. */
  template: BuilderTemplate | null
}) {
  const [title, setTitle] = React.useState<string>(
    template?.title ?? 'Mission ON Pre-Session Questionnaire'
  )
  const [questions, setQuestions] = React.useState<BuilderQuestion[]>(() =>
    toDraftQuestions(template)
  )
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  function dirty() {
    setError(null)
    setMessage(null)
  }

  // ---- question-level mutations ----
  function updateQuestion(qi: number, patch: Partial<BuilderQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, ...patch } : q))
    )
    dirty()
  }
  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()])
    dirty()
  }
  function removeQuestion(qi: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== qi))
    dirty()
  }

  // ---- option-level mutations ----
  function updateOption(qi: number, oi: number, patch: Partial<BuilderOption>) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? {
              ...q,
              options: q.options.map((o, j) =>
                j === oi ? { ...o, ...patch } : o
              ),
            }
          : q
      )
    )
    dirty()
  }
  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, options: [...q.options, emptyOption()] } : q
      )
    )
    dirty()
  }
  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.filter((_, j) => j !== oi) }
          : q
      )
    )
    dirty()
  }

  function onSave() {
    setError(null)
    setMessage(null)
    const fd = new FormData()
    fd.set('draft', JSON.stringify({ title, questions }))
    startTransition(async () => {
      const res = await saveTemplate(fd)
      if (!res.ok) {
        setError(res.error ?? 'Could not save the template.')
        return
      }
      const base = res.newVersion
        ? `Published version ${res.newVersion}.`
        : 'Published.'
      setMessage(res.warning ? `${base} ${res.warning}` : base)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            {template
              ? `Editing from active version ${template.version}. Saving publishes a NEW version and deactivates the old one — questionnaires already issued keep their original version, so their scoring never changes.`
              : 'No template exists yet. Saving creates version 1 and makes it active.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="tpl-title" required>
              Title
            </Label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                dirty()
              }}
              disabled={pending}
              placeholder="Mission ON Pre-Session Questionnaire"
            />
          </div>
          <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
            <p className="font-medium">This drives the classification engine.</p>
            <p className="mt-1 text-ink-muted">
              Each option&apos;s <span className="font-medium">code</span> and{' '}
              <span className="font-medium">weight</span> are what compute a
              school&apos;s module. A-questions use A1/A2/A3; B-questions use
              B1/B2/B3. Options with no code are not counted in the tally.
            </p>
          </div>
        </CardContent>
      </Card>

      {questions.map((q, qi) => {
        const isB = q.category === 'B'
        const codeChoices = isB ? B_CODES : A_CODES
        return (
          <Card key={qi}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Question {qi + 1}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(qi)}
                  disabled={pending}
                >
                  Remove question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`q-${qi}-id`} required>
                    Question id
                  </Label>
                  <Input
                    id={`q-${qi}-id`}
                    value={q.id}
                    onChange={(e) => updateQuestion(qi, { id: e.target.value })}
                    disabled={pending}
                    placeholder="b_usage_prevalence"
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    Stable key (lowercase, digits, underscores). Changing it on an
                    existing question starts a fresh answer key.
                  </p>
                </div>
                <div>
                  <Label htmlFor={`q-${qi}-cat`} required>
                    Category
                  </Label>
                  <Select
                    id={`q-${qi}-cat`}
                    value={q.category}
                    onChange={(e) =>
                      updateQuestion(qi, {
                        category: e.target
                          .value as BuilderQuestion['category'],
                      })
                    }
                    disabled={pending}
                  >
                    {QUESTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor={`q-${qi}-text`} required>
                  Question text
                </Label>
                <Textarea
                  id={`q-${qi}-text`}
                  value={q.text}
                  onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                  disabled={pending}
                  rows={2}
                  placeholder="What best describes substance use among Learners in this cohort?"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">Options</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(qi)}
                    disabled={pending}
                  >
                    Add option
                  </Button>
                </div>

                {q.options.map((o, oi) => (
                  <div
                    key={oi}
                    className="grid items-end gap-3 rounded-md border border-border bg-surface-muted p-3 sm:grid-cols-[1fr_1fr_5rem_6rem_auto]"
                  >
                    <div>
                      <Label htmlFor={`q-${qi}-o-${oi}-value`}>Value</Label>
                      <Input
                        id={`q-${qi}-o-${oi}-value`}
                        value={o.value}
                        onChange={(e) =>
                          updateOption(qi, oi, { value: e.target.value })
                        }
                        disabled={pending}
                        placeholder="none"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`q-${qi}-o-${oi}-label`}>Label</Label>
                      <Input
                        id={`q-${qi}-o-${oi}-label`}
                        value={o.label}
                        onChange={(e) =>
                          updateOption(qi, oi, { label: e.target.value })
                        }
                        disabled={pending}
                        placeholder="No usage"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`q-${qi}-o-${oi}-weight`}>Weight</Label>
                      <Input
                        id={`q-${qi}-o-${oi}-weight`}
                        type="number"
                        min={0}
                        step="1"
                        value={String(o.weight)}
                        onChange={(e) =>
                          updateOption(qi, oi, {
                            weight: Number(e.target.value),
                          })
                        }
                        disabled={pending}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`q-${qi}-o-${oi}-code`}>Code</Label>
                      <Select
                        id={`q-${qi}-o-${oi}-code`}
                        value={o.code}
                        onChange={(e) =>
                          updateOption(qi, oi, {
                            code: e.target.value as BuilderOption['code'],
                          })
                        }
                        disabled={pending}
                      >
                        <option value="">None</option>
                        {codeChoices.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(qi, oi)}
                      disabled={pending}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {q.options.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Add at least one option.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={addQuestion} disabled={pending}>
          Add question
        </Button>
        <Button onClick={onSave} disabled={pending}>
          {pending ? 'Publishing…' : 'Publish new version'}
        </Button>
        {message ? (
          <p className="text-sm text-success" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
