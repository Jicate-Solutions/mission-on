// Self-contained browser console capture for bug reports.
// Copy to your app as `lib/utils/enhanced-logger.ts` (the widget imports it from there).
//
// This is a trimmed stand-in for MyJKKN's richer enhanced-logger. It provides
// exactly the surface the widget uses:
//   - initializeLogCapture()           -> patch console.* once
//   - getLogManager().getStructuredLogs() -> { allLogs, summary }
//   - getLogManager().clear()
//   - logger.{error,warn,info}(scope, msg, data?)
//
// Logs are de-duplicated by (type + message) and counted, so a noisy loop does
// not balloon the payload. Only the last ~200 unique entries are kept.

type LogType = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface CapturedLog {
  type: LogType;
  message: string;
  moduleName?: string;
  component?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

const MAX_UNIQUE = 200;
const store = new Map<string, CapturedLog>();
let patched = false;

function toMessage(args: any[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ')
    .slice(0, 2000);
}

function record(type: LogType, args: any[]) {
  const message = toMessage(args);
  if (!message) return;
  const key = `${type}::${message}`;
  const now = new Date().toISOString();
  const existing = store.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
  } else {
    if (store.size >= MAX_UNIQUE) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }
    store.set(key, { type, message, count: 1, firstSeen: now, lastSeen: now });
  }
}

export function initializeLogCapture() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  (['log', 'info', 'warn', 'error', 'debug'] as LogType[]).forEach((type) => {
    const original = (console as any)[type]?.bind(console);
    (console as any)[type] = (...args: any[]) => {
      try { record(type, args); } catch { /* never break console */ }
      original?.(...args);
    };
  });
  window.addEventListener('error', (e) =>
    record('error', [e.message, e.filename, `${e.lineno}:${e.colno}`])
  );
  window.addEventListener('unhandledrejection', (e) =>
    record('error', ['UnhandledRejection', (e as PromiseRejectionEvent).reason])
  );
}

export function getLogManager() {
  return {
    getStructuredLogs() {
      const allLogs = Array.from(store.values());
      const totalOccurrences = allLogs.reduce((s, l) => s + l.count, 0);
      return {
        allLogs,
        summary: {
          totalUniqueEntries: allLogs.length,
          totalOccurrences,
          topModules: [] as string[],
        },
      };
    },
    clear() {
      store.clear();
    },
  };
}

// Lightweight scoped logger used across the assets. Swap for your own logger
// if you have one — keep the (scope, message, data?) signature.
export const logger = {
  error: (scope: string, message: string, data?: unknown) =>
    console.error(`[${scope}] ${message}`, data ?? ''),
  warn: (scope: string, message: string, data?: unknown) =>
    console.warn(`[${scope}] ${message}`, data ?? ''),
  info: (scope: string, message: string, data?: unknown) =>
    console.info(`[${scope}] ${message}`, data ?? ''),
};
