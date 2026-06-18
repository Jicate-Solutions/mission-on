// =============================================================================
// Mission ON — Smart Choices
// app/(app)/anonymous-chat/anon-dal-constants.ts
//
// PLAIN DATA shared by the server DAL and the client composer. Kept separate
// from anon-dal.ts (which is 'server-only') so the client may import the limit
// without pulling server code into the browser bundle.
// =============================================================================

/** Max body length accepted for an anonymous post (chars). */
export const ANON_MAX_BODY = 1000
