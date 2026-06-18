// Mission ON — Smart Choices
// app/(app)/learner/feedback/feedback-constants.ts
// PLAIN DATA shared by the server DAL and the client form. Kept separate from
// feedback-dal.ts (which is 'server-only') so the client may import the limit
// without pulling server code into the browser bundle.
export const FEEDBACK_MAX_COMMENT = 2000
