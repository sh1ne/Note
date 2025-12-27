/**
 * Helper to trace all /login navigation sources
 * Call this IMMEDIATELY before every navigation or redirect to /login
 */
export function traceLoginNav(tag: string) {
  if (typeof window === 'undefined') return;
  
  const route = window.location.pathname;
  const isOnline = navigator.onLine;
  const timestamp = new Date().toISOString();
  
  console.warn(
    `[LOGIN_NAV][${tag}] route=${route} online=${isOnline} time=${timestamp}`
  );
  console.trace();
}

