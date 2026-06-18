Product Requirements Document (PRD)
Mission ON — Smart Choices
A peer-mentored youth resilience, substance-awareness & confidential follow-through platform

Field
Detail
Product name
Mission ON — Smart Choices
Initiated by
Young Indians (Yi), Erode Chapter
Delivered by
J.K.K. Nattraja Educational Institutions (JKKN) — Medical & Non-Medical Learner Wings
Program window
Centenary Year context (Nov 2025 – Nov 2026) · #JKKN100
Document type
Product Requirements Document (v1.0 — Draft for review)
Owner
Yi Erode + JKKN joint program team
Status
Draft — pending stakeholder sign-off

A note on terminology used throughout this document: consistent with the program's existing playbook, end-users are called Learners (never "students"), JKKN faculty anchors are Learning Facilitators, and the peer guides ("immediate seniors") are Mentors.

1. Executive Summary
Mission ON — Smart Choices is a role-based web/mobile application that operationalizes the Yi Erode + JKKN school-intervention program. The program runs awareness sessions in schools and then sustains impact through follow-through (counselling) sessions delivered by immediate seniors (Mentors).
The Admins and Super Admins hold all the background knowledge of how the program functions — the classification logic, the module design, the operational pipeline, and the safeguarding rules — and they orchestrate the program from behind the scenes. The Mentors are the frontline (the "frontiers") who actually meet the Learners and deliver the mentoring — equipped with just enough basic and background knowledge for a Learner to open up, share freely, and receive guidance. In other words: Admins/Super Admins run and know the machinery; Mentors are the human face the Learner interacts with.
The app does three core jobs:
Classify each participating school into one of nine intervention modules using a pre-session questionnaire — and surface that classification only to Admins and Super Admins, never to the school.
Run the operational pipeline — school approach, questionnaire, session scheduling, module design with the Mentor team, delivery, and structured follow-through.
Sustain the Learner–Mentor relationship over time through alias-protected mentoring, confidential feedback, an anonymous open chat space, and a bug-report loop — all governed by a strict safeguarding and confidentiality model because the end-users are minors discussing sensitive subjects.

2. The Problem & Why an App
The intervention's highest-impact moment is not the awareness session itself — it is the one-on-one follow-through where a Learner trusts a near-peer enough to disclose. Today this depends on paper, phone calls, and manual coordination. That breaks down at scale and leaks confidentiality.
The app exists to: (a) make school classification objective and invisible to the school, (b) make scheduling and Mentor allocation reliable, (c) give every Learner a safe, alias-protected channel to a Mentor they chose, and (d) give Yi/JKKN aggregate, anonymized data to steer the program — without ever exposing an individual minor.

3. Goals & Success Metrics
Goal
Success metric
Objective, hidden school classification
100% of schools auto-classified from the questionnaire; classification visible only to Admin/Super Admin roles
Reliable session pipeline
Every school has a live status reflecting its real stage; zero "lost" schools between approach and session
Sustained follow-through
≥ X% of flagged Learners receive a Mentor follow-up within the defined window (target set by Yi)
Learner trust & safety
Zero exposure of a Learner's real identity to anyone outside their permission boundary; alias system used end-to-end
Continuous improvement loop
Bug reports triaged to resolution; anonymous chat surfacing actionable suggestions each cycle

Specific numeric targets (the "X%") are intentionally left for Yi Erode + JKKN to set during sign-off — see Open Questions (§16).

4. Scope
In scope (v1): role-based authentication & role allocation; the questionnaire + auto-classification engine; school coordinator pipeline; module design workspace for Admins + Mentor team; Mentor directory & availability; Learner profiles with alias-based Mentor selection & change-request escalation; follow-through logging; Learner feedback capture & viewing; anonymous chat space; bug report & resolution system; per-role dashboards.
Out of scope (v1, candidate for later): automated clinical risk scoring; video calling inside the app; payments; public-facing marketing site; multi-chapter (beyond Erode) tenancy; offline-first sync. (These are noted in the roadmap, §15.)

5. Roles, Personas & Access Model
The system has five roles in a clear hierarchy. Access is least-privilege: each role sees only what it needs.
Role
Who they are
Primary purpose
Super Admin
Yi Erode program lead / system owner
Full system control; sees school classifications; manages Admins; final authority on escalations & data
Admin
Program coordinators (Yi/JKKN)
Run the pipeline; design modules; allocate Mentors; approve Mentor-change requests; triage bugs; assign roles to new joiners
School Coordinator
The point person managing a school's journey (internal pipeline owner)
Move schools through the stages: approached → questionnaire → session fixed → delivered → follow-up
Mentor
Immediate seniors (JKKN Learners with basic + background knowledge)
Conduct follow-through, counsel, view feedback from their Learners
Learner
School participants (Grades 8–11, minors)
Receive the session, choose a Mentor by alias, share/seek help, give feedback, post anonymously

5.1 Identity & alias rules (critical)
Mentors have a real profile (name, college, course, phone, availability) that is visible only to Admin and Super Admin, plus a public alias that Learners see.
Learners have both a real name and an alias. Learners browse and select Mentors by alias only — they never see a Mentor's real name.
A Learner's real identity is never shown to other Learners. Mentor-facing visibility of a Learner's real name is a configurable permission decision for Yi/JKKN (see Open Questions §16) — the default assumption in this PRD is that a Mentor sees the Learner's alias by default, with real name revealed only where the safeguarding workflow requires it.

6. The Classification Engine (3×3 Matrix → 9 Modules)
Every school is mapped to one module code from a 3×3 matrix. Category A captures the school's demographic baseline; Category B captures the Learners' usage reality.
6.1 Category A — Demographic (by school fees)
Code
Definition
A1
Private school, fees above ₹1,00,000 / year
A2
Private school, fees below ₹1,00,000 / year
A3
Government school

6.2 Category B — Behaviour (by drug usage)
Code
Definition
B1
No usage / few exposure — aware and afraid to take up drugs
B2
Mild usage — curiosity-driven, peer-pressure-driven
B3
Frequent users — and actively influencing/polluting others to use

6.3 The nine modules


B1
B2
B3
A1
A1-B1
A1-B2
A1-B3
A2
A2-B1
A2-B2
A2-B3
A3
A3-B1
A3-B2
A3-B3

6.4 How classification happens
A questionnaire is shared with the school one week (≈10 days) before the session.
The questionnaire is deliberately designed so that the school's answers map onto the matrix — Category A questions resolve A1/A2/A3, Category B questions resolve B1/B2/B3.
The app auto-scores the responses and computes the module code (e.g. A2-B2).
The computed school type is shown ONLY to Super Admin and Admin. It is never shown to the school or the school coordinator role's external view.
The Admin then designs the module with the Mentor team for that school, using the suggested code as the planning anchor.
Design rule for the questionnaire builder: Category A is anchored on fee bracket + school type first, then confirmed by behavioural pattern. Where the demographic anchor and the behavioural pattern diverge by more than one step, the app flags the school for manual Admin confirmation before locking the module code. (This mirrors the existing playbook's recommendation to reconcile fee-based and behaviour-based signals.)
6.5 Auto-classification logic (reference)
INPUT: questionnaire responses (Category A items, Category B items, fee bracket, school type)

STEP 1 — Category A:
    a_demographic = derive_from(fee_bracket, school_type)   // A1 / A2 / A3  (authoritative)
    a_behaviour   = tally(Category A behavioural answers)     // pattern signal
    IF distance(a_demographic, a_behaviour) > 1 step:
        flag = "A_DIVERGENCE — Admin confirm"

STEP 2 — Category B:
    b_code = tally(Category B answers)                        // B1 / B2 / B3

STEP 3 — Module:
    module_code = a_demographic + "-" + b_code                // e.g. "A2-B2"

OUTPUT (visible to Admin / Super Admin ONLY):
    { module_code, confidence, flags[], raw_responses }

7. Functional Requirements (by feature area)
7.1 Authentication & Role Management
Secure sign-in for all five roles.
Admins and Super Admins can create accounts and allocate/modify roles for new joiners (e.g., promote a JKKN Learner to Mentor, add a School Coordinator).
Super Admin can manage Admins; Admins cannot elevate themselves to Super Admin.
Every role lands on its own dashboard after login (§9).
7.2 School Onboarding & Coordinator Pipeline
Create a school record and assign a School Coordinator.
Track the school across explicit pipeline stages with an updatable status at each stage (§9.3).
Capture session logistics: grade, date, day, timing, total expected student strength.
Record the questionnaire dispatch + completion state.
7.3 Questionnaire & Auto-Classification
Build/issue the pre-session questionnaire to a school (target: ~1 week prior).
Collect responses; auto-compute the module code.
Restrict classification visibility to Admin + Super Admin.
Surface divergence flags for manual confirmation.
7.4 Module Design Workspace
Admin opens the suggested module code and assembles the delivery plan with the Mentor team (which media/film, which demonstration, which conversation framework, which escalation pathway).
Attach the assigned Mentors and Learning Facilitator to the session.
7.5 Mentor Management
Mentor profile fields: real name, alias, college, course, phone number, availability dates, schools allocated.
All Mentor profile data is visible only to Admin + Super Admin. Learners see alias only.
Mentors can view feedback given by their Learners.
Availability calendar feeds allocation.
7.6 Learner Management & Mentor Selection
Learner profile: alias + real name, school, contact number.
Learner selects a Mentor by browsing aliases (no real names exposed).
Learner can raise a "change my Mentor" request, which is escalated to an Admin; the Admin opens the option to switch.
Learner can share freely with their Mentor and receive counselling/console.
7.7 Follow-Through / Counselling
Follow-through sessions are conducted by the Learner's chosen Mentor.
Mentors log follow-through interactions (subject to the confidentiality model, §12).
Flagged cases route to the Admin/Super Admin + (where applicable) the JKKN counsellor per the safeguarding workflow.
7.8 Feedback & Assessment
Learners submit feedback (and the program's post-session assessment) through the app.
Mentors view feedback from their own Learners; Admins/Super Admins view aggregate.
7.9 Anonymous Chat Space
An open, anonymous space available to all roles to freely post opinions and suggestions.
Posts are not attributed to a real identity.
Lightweight moderation tooling for Admin/Super Admin (hide/remove harmful content) — see safeguarding (§12).
7.10 Bug Report System
Any role can raise a bug.
A bug-resolving workflow for Admin/Super Admin: triage → assign → resolve → close, with status visible to the reporter.
7.11 Notifications
Stage changes, new mentor-change requests, new bug reports, flagged follow-through cases, and questionnaire completions trigger role-appropriate notifications.

8. End-to-End Master Process Flow
mermaid
flowchart TD
    A[School approached by Coordinator] --> B[School record created · Coordinator assigned]
    B --> C[Questionnaire issued ~1 week prior]
    C --> D[School completes questionnaire]
    D --> E[App auto-computes module code]
    E --> F{Demographic vs behaviour diverge > 1 step?}
    F -- Yes --> G[Flag for manual Admin confirmation]
    F -- No --> H[Module code ready]
    G --> H
    H --> I[Code visible to Admin / Super Admin ONLY]
    I --> J[Admin designs module with Mentor team]
    J --> K[Session fixed: grade · date · day · time · strength]
    K --> L[Awareness session delivered]
    L --> M[Learners onboarded · choose Mentor by alias]
    M --> N[Follow-through / counselling via Mentor]
    N --> O[Feedback + assessment captured]
    O --> P{Case flagged?}
    P -- Yes --> Q[Safeguarding / escalation workflow]
    P -- No --> R[Aggregate anonymized review by Yi + JKKN]
    Q --> R
    R --> S[Decide re-visit / recalibrate module]

9. Per-Role Dashboards & Flows
Each role has a dedicated dashboard. Below are the dashboard contents and the flow each role moves through.
9.1 Super Admin Dashboard
Sees: everything — all schools + their classified module codes, all Admins/Coordinators/Mentors/Learners, system-wide analytics, escalations, bug queue, anonymous-chat moderation.
Can do: manage Admins; allocate any role; final authority on Mentor-change escalations and safeguarding cases; view (not be blocked from) classification data.
mermaid
flowchart LR
    SA[Super Admin login] --> SA1[System overview · all schools + module codes]
    SA1 --> SA2[Manage Admins & role allocation]
    SA1 --> SA3[Review escalations & safeguarding cases]
    SA1 --> SA4[Bug queue oversight]
    SA1 --> SA5[Anonymous chat moderation]
    SA1 --> SA6[Program-wide anonymized analytics]
9.2 Admin Dashboard
Sees: the full pipeline, module classifications (Admin-visible), Mentor directory (real details), Learner directory, mentor-change requests, bug queue, feedback aggregates.
Can do: issue questionnaires; confirm divergent classifications; design modules with the Mentor team; allocate Mentors to schools; approve Mentor-change requests (open the switch option); assign roles to new joiners; triage/resolve bugs.
mermaid
flowchart LR
    AD[Admin login] --> AD1[Pipeline board · all schools by stage]
    AD1 --> AD2[Open questionnaire results · view module code]
    AD2 --> AD3{Divergence flag?}
    AD3 -- Yes --> AD4[Call coordinator · confirm code]
    AD3 -- No --> AD5[Design module with Mentor team]
    AD4 --> AD5
    AD5 --> AD6[Allocate Mentors · fix session]
    AD1 --> AD7[Handle Mentor-change requests]
    AD1 --> AD8[Allocate roles to new joiners]
    AD1 --> AD9[Triage & resolve bugs]
    AD1 --> AD10[View feedback aggregates]
9.3 School Coordinator Dashboard
Sees: the schools they own and each school's journey. Does NOT see the module classification (that is Admin/Super Admin only).
Pipeline stages with updatable status:
Stage
What is tracked
Example statuses
1. Approach
School contacted
Not started · Contacted · Awaiting response · Declined
2. Questionnaire
Form issued & completed
Issued · Partially filled · Completed
3. Session fixing
Grade, date, day, timing, expected strength
Proposed · Confirmed · Rescheduled
4. Delivery
Session conducted
Scheduled · Delivered · Postponed
5. Follow-up
Post-session follow-through window
In progress · Completed

mermaid
flowchart LR
    SC[Coordinator login] --> SC1[My schools list with current stage]
    SC1 --> SC2[Stage 1 · Approach · update status]
    SC2 --> SC3[Stage 2 · Issue questionnaire · track completion]
    SC3 --> SC4[Stage 3 · Fix session: grade/date/day/time/strength]
    SC4 --> SC5[Stage 4 · Mark delivered]
    SC5 --> SC6[Stage 5 · Follow-up status]
    SC1 --> SC7[Raise bug · post in anonymous chat]
9.4 Mentor Dashboard
Sees: their assigned schools, their allocated Learners (alias-first), their availability calendar, and feedback from their Learners. Mentor's own real profile is editable but only Admin/Super Admin see it in directories.
Can do: set availability; conduct & log follow-through; view feedback; raise bugs; post in anonymous chat.
mermaid
flowchart LR
    ME[Mentor login] --> ME1[My profile & alias · set availability]
    ME1 --> ME2[Assigned schools & Learners]
    ME2 --> ME3[Conduct follow-through / counselling]
    ME3 --> ME4{Risk / safeguarding trigger?}
    ME4 -- Yes --> ME5[Escalate per safeguarding workflow]
    ME4 -- No --> ME6[Log session]
    ME2 --> ME7[View Learner feedback]
    ME1 --> ME8[Raise bug · anonymous chat]
9.5 Learner Dashboard
Sees: their own alias + profile, available Mentors by alias, their chosen Mentor, the anonymous chat, feedback forms.
Can do: choose a Mentor by alias; escalate a Mentor-change request; share with / seek counselling from their Mentor; submit feedback; post anonymously; raise bugs.
mermaid
flowchart LR
    LE[Learner login] --> LE1[My profile · alias]
    LE1 --> LE2[Browse Mentors by ALIAS only]
    LE2 --> LE3[Select Mentor]
    LE3 --> LE4[Share & receive counselling]
    LE3 --> LE5{Want a different Mentor?}
    LE5 -- Yes --> LE6[Raise change request -> Admin]
    LE6 --> LE7[Admin opens switch option]
    LE1 --> LE8[Submit feedback]
    LE1 --> LE9[Anonymous chat · raise bug]

10. Key Data Entities (high-level)
Entity
Key fields
Sensitive?
User
id, role, login credentials, status
yes
School
id, name, type (private/govt), fee bracket, coordinator_id, pipeline_stage, status
partial
Session
id, school_id, grade, date, day, time, expected_strength, module_code, status
partial
Questionnaire Response
id, school_id, answers, computed_module_code, divergence_flag
restricted (Admin+)
Mentor
user_id, real_name, alias, college, course, phone, availability[], allocated_schools[]
real fields Admin-only
Learner
user_id, real_name, alias, school_id, contact_number, chosen_mentor_id
high — minor data
Follow-through Log
id, learner_id, mentor_id, notes, flags, timestamp
high — confidential
Mentor-Change Request
id, learner_id, current_mentor_id, reason, status (open/approved/rejected)
partial
Feedback / Assessment
id, learner_id, session_id, responses, anonymity_flag
partial
Anonymous Post
id, body, timestamp (no author identity stored)
moderated
Bug Report
id, reporter_role, description, status, assignee, resolution
low


11. Role-Based Access Control (RBAC) Matrix
Capability
Super Admin
Admin
Coordinator
Mentor
Learner
See school module classification
✅
✅
❌
❌
❌
Manage Admins
✅
❌
❌
❌
❌
Allocate roles to new joiners
✅
✅
❌
❌
❌
Run pipeline / update school stages
✅
✅
✅ (own schools)
❌
❌
Issue questionnaire
✅
✅
✅
❌
❌
Design module with Mentor team
✅
✅
❌
view
❌
See Mentor real profile (name/phone/college)
✅
✅
❌
self
❌
See Mentor alias
✅
✅
✅
✅
✅
Allocate Mentors to schools
✅
✅
❌
❌
❌
Choose Mentor (by alias)
—
—
—
—
✅
Approve Mentor-change request
✅
✅
❌
❌
❌ (raise only)
View Learner feedback
✅
✅ (aggregate)
❌
✅ (own Learners)
self
Conduct/log follow-through
❌
❌
❌
✅
—
Post in anonymous chat
✅
✅
✅
✅
✅
Moderate anonymous chat
✅
✅
❌
❌
❌
Raise a bug
✅
✅
✅
✅
✅
Resolve a bug
✅
✅
❌
❌
❌


12. Privacy, Safeguarding & Confidentiality (Mandatory)
Because end-users are minors disclosing sensitive information, confidentiality is an operating mechanism, not a courtesy. The app must encode the program's existing protocol.
Confidentiality rings
Ring 1 — Learner ↔ Mentor: one-on-one content is confidential to the Mentor (and the JKKN counsellor). It must not reach the school, the family, or any external party without the Learner's explicit consent.
Ring 2 — Admin/Super Admin ↔ Yi/JKKN: only aggregated, anonymized data crosses; no individual names.
Ring 3 — Yi ↔ external resources (helplines, de-addiction services): accessed only with informed consent, except under the safeguarding override.
Safeguarding override (when confidentiality yields): immediate physical danger, active suicidal ideation with plan/means, disclosure of abuse, or active coercion/trafficking signs trigger defined escalation to the designated safeguarding lead within the protocol's timelines. The app must support a controlled escalation path for flagged follow-through cases.
Hard product rules
The school never sees its own classification or any individual Learner's disclosures.
Learners never see Mentors' real identities; Mentor real data is Admin/Super-Admin-only.
Anonymous chat stores no author identity.
Wellbeing/crisis resources should be reachable in-app; the app must not surface specific harmful "how-to" content. Sensitive escalations must route to humans, not be auto-resolved by the system.
This is a high-sensitivity application. Before launch, Yi/JKKN should confirm the consent model, data-retention period, and the exact safeguarding contacts and timelines (see Open Questions §16).

13. Non-Functional Requirements
Security: encrypted in transit and at rest; least-privilege RBAC enforced server-side (not just UI hiding); audit log for classification access, role changes, and safeguarding escalations.
Privacy by design: alias-first rendering everywhere a Learner is the audience; restricted fields never sent to unauthorized clients.
Usability: mobile-friendly for Learners and Mentors; low-bandwidth tolerance for rural/government-school contexts; bilingual readiness (English + Tamil) for the delivery context.
Reliability: stage/status updates and follow-through logs must persist reliably; no silent data loss.
Accessibility: age-appropriate, plain-language UI for Grades 8–11.

14. Suggested Technical Approach
The team's existing tooling fits this well; this is a suggestion, not a mandate.
Backend / DB / Auth: Supabase (Postgres + row-level security to enforce the RBAC matrix at the data layer; RLS is the right tool to guarantee "school can't see classification" and "Learner can't see Mentor real name").
Automation / workflows: n8n for questionnaire dispatch, reminders, stage-change notifications, and follow-up scheduling.
Source control / CI: GitHub.
Frontend: a role-aware SPA with five dashboard shells; alias-rendering enforced as a server-side concern.
Security note: enforce visibility rules with server-side row-level security, never by hiding fields in the front end alone — sensitive minor data must be unreachable by an unauthorized client even via direct API calls.

15. Release Roadmap (proposed)
Phase
Focus
Phase 1 — Foundation
Auth + RBAC; school records; coordinator pipeline with stages/status; role allocation
Phase 2 — Classification
Questionnaire builder + dispatch; auto-classification; Admin-only visibility; divergence flagging
Phase 3 — Mentoring core
Mentor profiles/availability; Learner profiles; alias-based selection; mentor-change escalation; follow-through logging
Phase 4 — Engagement & feedback
Feedback/assessment capture & views; anonymous chat; bug report/resolution
Phase 5 — Safeguarding & analytics
Escalation workflow; aggregate anonymized dashboards; audit logs
Later (out of v1 scope)
In-app calling, multi-chapter tenancy, offline sync, advanced risk analytics


16. Open Questions & Assumptions
Assumptions made in this draft (please confirm or correct):
Module classification is visible to both Admin and Super Admin (you specified "super admin and admin").
A Learner sees a Mentor's alias only; whether a Mentor sees a Learner's real name by default is left as a Yi/JKKN policy decision — this PRD defaults to alias-first with real-name reveal only under safeguarding need.
"Immediate seniors" = Mentors drawn from JKKN Learner wings; Mentor allocation to schools is done by Admins.
Questionnaire is issued ~1 week (≈10 days) before the session, consistent with the existing playbook.
Questions for sign-off:
What are the numeric success targets (follow-up rate, response timelines)?
What is the consent model and data-retention period for minor data and follow-through logs?
Who are the named safeguarding contacts, and what are the exact escalation timelines to encode?
Should the anonymous chat be global (all roles together) or segmented (e.g., Learner-only, Mentor-only)?
Should the questionnaire be answered by the school staff (about the cohort) or by Learners directly — this changes phrasing and the classification confidence model.
Do you want a single anonymous chat or separate spaces per dashboard?
Bilingual (English/Tamil) at launch, or English first?

17. Appendix A — Pipeline Status Reference
Stage
Allowed statuses
Approach
Not started · Contacted · Awaiting response · Declined · Approved to proceed
Questionnaire
Issued · Partially filled · Completed · Overdue
Session fixing
Proposed · Confirmed · Rescheduled · Cancelled
Delivery
Scheduled · Delivered · Postponed
Follow-up
Not started · In progress · Completed

18. Appendix B — Module Code Quick Map
Code
School profile
Usage profile
A1-B1
Private, fees > ₹1L
No usage / afraid
A1-B2
Private, fees > ₹1L
Mild / curiosity / peer
A1-B3
Private, fees > ₹1L
Frequent + influencing
A2-B1
Private, fees < ₹1L
No usage / afraid
A2-B2
Private, fees < ₹1L
Mild / curiosity / peer
A2-B3
Private, fees < ₹1L
Frequent + influencing
A3-B1
Government
No usage / afraid
A3-B2
Government
Mild / curiosity / peer
A3-B3
Government
Frequent + influencing


Mission ON — Smart Choices · Young Indians (Yi) Erode Chapter × J.K.K. Nattraja Educational Institutions · #JKKN100 · PRD v1.0 (Draft)

