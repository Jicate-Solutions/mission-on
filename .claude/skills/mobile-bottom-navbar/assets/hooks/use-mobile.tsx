import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  // No viewport on the server — default to non-mobile and let the client
  // reconcile via useSyncExternalStore after hydration.
  return false
}

export function useIsMobile() {
  // useSyncExternalStore subscribes to the viewport media query without
  // calling setState inside an effect, so it sidesteps the cascading-render
  // pitfall and handles SSR/hydration reconciliation correctly.
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
