# PART 1 - Answers

## 1) Where is the service worker registered?

**File:** `components/common/ServiceWorkerRegistration.tsx`

**Code snippet:**
```typescript
navigator.serviceWorker
  .register('/sw.js', { scope: '/' })
  .then((registration) => {
    console.log('[Service Worker] Registered successfully:', registration.scope);
    // ... update handling
  })
```

**Location:** Lines 11-12

---

## 2) Confirm we are in PRODUCTION build on Vercel

**Production assets:** `/_next/static/` (confirmed in `public/sw.js` line 81)

**Dev-mode-only branches that can be removed:**
- Lines 77-106: Entire `/next/static/` dev mode handling block
- This is only for localhost dev mode, not needed in production

**Code to remove:**
```javascript
// Lines 77-106 - REMOVE THIS ENTIRE BLOCK
const isDevStaticAsset = url.pathname.startsWith('/next/static/');
if (isDevStaticAsset) {
  // ... entire dev mode handling
  return;
}
```

---

## 3) For the failing case (/base/short-term offline):

**Network request that fails:**
- Navigation request: `request.mode === "navigate"` AND `url.pathname === "/base/short-term"`

**What Service Worker currently returns:**
- Line 148-234: Checks if route is cached
- If not cached, tries network (line 156)
- Network fails offline → catch block (line 167)
- For `/base/*` routes, tries to return cached "/" (line 173)
- **PROBLEM:** If "/" is not cached, returns 503 "page isn't cached" HTML (line 180-233)

**Why "page isn't cached" happens:**
- Root HTML ("/") is supposed to be cached at install (STATIC_ASSETS includes "/")
- But if cache fails or gets cleared, root isn't available
- Service Worker then returns 503 offline page instead of app shell
- This breaks offline navigation for `/base/*` routes

---

## 4) Is /base/[noteSlug] a single dynamic route?

**Route structure:**
- `/base/scratch` → `app/(dashboard)/[notebookSlug]/[noteSlug]/page.tsx` (notebookSlug="base", noteSlug="scratch")
- `/base/now` → `app/(dashboard)/[notebookSlug]/[noteSlug]/page.tsx` (notebookSlug="base", noteSlug="now")
- `/base/short-term` → `app/(dashboard)/[notebookSlug]/[noteSlug]/page.tsx` (notebookSlug="base", noteSlug="short-term")

**Confirmed:** Yes, all staple tabs go through the same dynamic route handler: `app/(dashboard)/[notebookSlug]/[noteSlug]/page.tsx`

**This means:** All `/base/*` routes are handled by Next.js client-side routing, so serving the app shell ("/") for any `/base/*` navigation will work correctly.

