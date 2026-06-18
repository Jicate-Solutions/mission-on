# Classification engine — worked examples

`lib/classification.ts` is pure and unit-testable. Below are three worked
examples that double as the canonical test fixtures. They use the v1 template
question ids from `supabase/migrations/0004_seed.sql`:

- A_behaviour questions: `a_beh_resource_access`, `a_beh_environment`
  - options → code: `high|sheltered`→A1, `medium|mixed`→A2, `low|exposed`→A3
- B questions: `b_usage_prevalence`, `b_peer_influence`, `b_attitude` (each weight 1)
  - `b_usage_prevalence`: `none`→B1, `mild`→B2, `frequent`→B3
  - `b_peer_influence`: `no`→B1, `some`→B2, `active`→B3
  - `b_attitude`: `fearful`→B1, `curious`→B2, `normalised`→B3

Demographic A is AUTHORITATIVE and comes from `deriveCategoryA(feeBracket, schoolType)`,
NOT from the answers. The A_behaviour tally is only used to detect divergence.

---

## Example 1 — Clean private, low usage → A1-B1, no divergence

Input:
- `feeBracket = 'fee_above_1l'`, `schoolType = 'private'` → `deriveCategoryA` = **A1**
- A_behaviour answers: `a_beh_resource_access = 'high'` (A1), `a_beh_environment = 'sheltered'` (A1)
  → behaviour tally = A1. `ordinalDistanceA(A1, A1) = 0` → **no divergence**.
- B answers: `b_usage_prevalence = 'none'` (B1), `b_peer_influence = 'no'` (B1), `b_attitude = 'fearful'` (B1)
  → B tally: B1 weight 3 / total 3 → **B1**, confidence `3/3 = 1.0`.

`computeModule` →
```
{
  computed_a_code: 'A1',
  computed_b_code: 'B1',
  computed_module_code: 'A1-B1',
  confidence: 1.0,
  divergence_flag: false,
  flags: []
}
```

---

## Example 2 — Government school, mixed B signal → A3-B2, no divergence

Input:
- `feeBracket = 'govt'`, `schoolType = 'government'` → `deriveCategoryA` = **A3**
- A_behaviour answers: `a_beh_resource_access = 'low'` (A3), `a_beh_environment = 'exposed'` (A3)
  → behaviour tally = A3. `ordinalDistanceA(A3, A3) = 0` → **no divergence**.
- B answers: `b_usage_prevalence = 'mild'` (B2), `b_peer_influence = 'some'` (B2), `b_attitude = 'fearful'` (B1)
  → B tally: B2 weight 2, B1 weight 1, total 3 → winner **B2**, confidence `2/3 ≈ 0.667`.

`computeModule` →
```
{
  computed_a_code: 'A3',
  computed_b_code: 'B2',
  computed_module_code: 'A3-B2',
  confidence: 0.667,
  divergence_flag: false,
  flags: []
}
```

---

## Example 3 — Divergence: demographic A1 vs behaviour A3 → flagged, confidence halved

Input:
- `feeBracket = 'fee_above_1l'`, `schoolType = 'private'` → `deriveCategoryA` = **A1** (authoritative)
- A_behaviour answers: `a_beh_resource_access = 'low'` (A3), `a_beh_environment = 'exposed'` (A3)
  → behaviour tally = A3. `ordinalDistanceA(A1, A3) = 2` which is `> 1` → **DIVERGENCE**.
- B answers: `b_usage_prevalence = 'frequent'` (B3), `b_peer_influence = 'active'` (B3), `b_attitude = 'normalised'` (B3)
  → B tally: B3 weight 3 / total 3 → **B3**, raw confidence `1.0`.
- Module uses the AUTHORITATIVE demographic A (A1), not the behavioural A3:
  module = `A1-B3`.
- Divergence halves confidence: `1.0 * 0.5 = 0.5`.

`computeModule` →
```
{
  computed_a_code: 'A1',
  computed_b_code: 'B3',
  computed_module_code: 'A1-B3',
  confidence: 0.5,
  divergence_flag: true,
  flags: ['A_DIVERGENCE — Admin confirm']
}
```

This is the case the PRD (§6.4) requires the Admin to manually confirm before
the module code is locked: a high-fee private school whose behavioural signals
look like a high-exposure government context.

---

## Edge cases covered by the engine

- **No B answers at all** → B defaults to the most cautious **B1**, and the flag
  `B_UNRESOLVED — defaulted to B1, Admin confirm` is added; B confidence 0.
- **No A_behaviour answers** → divergence cannot be computed → `divergence_flag`
  stays false (we do not flag on missing data).
- **Ties in a tally** → resolve toward the LOWER ordinal (more cautious) code,
  e.g. a 1-1-1 split across B1/B2/B3 resolves to **B1**.
- **confidence** is clamped to [0,1] and rounded to 3 decimals to match the
  `numeric(4,3)` column on `questionnaire_responses`.
