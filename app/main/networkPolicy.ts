// No-unexpected-network (ADR-015, DOC-03 §6): the app may not make any
// network request except to approved endpoints. Today that list is EMPTY in
// production — the app talks to nothing. The company server's address is
// added here in Phase 10, and nothing else, ever. In development, the Vite
// dev server that serves the UI is allowed.
//
// This file is a pure decision function with no Electron dependency, so the
// check suite can test it directly; index.ts hooks it into Electron's
// request pipeline, cancelling anything it rejects.

/** Origins the app may talk to over the network in production. Deliberately empty. */
export const APPROVED_ORIGINS: readonly string[] = [];

export function isRequestAllowed(url: string, devServerOrigin?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // unparseable → blocked
  }

  // Local, non-network schemes the app itself is built from.
  const scheme = parsed.protocol;
  if (scheme === 'file:' || scheme === 'data:' || scheme === 'blob:' || scheme === 'about:') {
    return true;
  }
  if (scheme === 'devtools:' || scheme === 'chrome:') {
    return true; // Electron's own developer tools pages
  }

  // Network requests: only approved origins, plus the dev server in development.
  if (scheme === 'http:' || scheme === 'https:' || scheme === 'ws:' || scheme === 'wss:') {
    if (devServerOrigin && originMatches(parsed, devServerOrigin)) return true;
    return APPROVED_ORIGINS.some((approved) => originMatches(parsed, approved));
  }

  return false;
}

function originMatches(url: URL, approvedOrigin: string): boolean {
  try {
    const approved = new URL(approvedOrigin);
    // ws://host:port and http://host:port count as the same origin here, so
    // the dev server's page load and its reload socket are both covered.
    return url.hostname === approved.hostname && url.port === approved.port;
  } catch {
    return false;
  }
}
