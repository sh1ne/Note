# Testing Guide - Production Offline Fix

## What Was Fixed

**Service Worker rewritten with 3 deterministic lanes:**
- **LANE A**: `/_next/static/*` - CacheFirst (production static assets)
- **LANE B**: `/base/*` navigation - ALWAYS returns app shell (never 503 "page isn't cached")
- **LANE C**: Everything else - NetworkFirst with cache fallback

**Removed:**
- All dev mode logic (`/next/static/` handling)
- Duplicated offline HTML blocks (now single template)
- Complex conditional logic

## How to Test on Deployed Site (Vercel)

### Prerequisites
1. Wait for Vercel deployment to complete after this commit
2. Open the deployed site on your phone (or desktop with airplane mode)

### Test Steps

1. **Open app online:**
   - Go to `https://note-three-delta.vercel.app/base/scratch`
   - Wait for page to fully load
   - Verify you can see your notes

2. **Visit Short-Term once (online):**
   - Click "Short-Term" tab in bottom navigation
   - Wait for page to load
   - This ensures the route is visited at least once

3. **Turn on airplane mode:**
   - On phone: Enable airplane mode
   - On desktop: Chrome DevTools → Network tab → Check "Offline"

4. **Navigate between tabs (offline):**
   - Click: **Scratch** → **Now** → **Short-Term**
   - Each navigation should work smoothly

### ✅ PASS Criteria

- All three tabs load offline (Scratch, Now, Short-Term)
- No "page isn't cached" error message
- No black screen or infinite loading
- Notes are visible and editable
- Bottom navigation bar is visible

### ❌ FAIL Criteria

- Any tab shows "page isn't cached" error
- Black screen or infinite loading spinner
- App redirects to login page
- Bottom navigation bar missing

## What to Check if It Fails

1. **Service Worker Status:**
   - Chrome DevTools → Application → Service Workers
   - Verify service worker is "activated and running"
   - Check "Received" timestamp (should be recent)

2. **Cache Status:**
   - Chrome DevTools → Application → Cache Storage
   - Verify `note-app-v5` cache exists
   - Verify `note-app-runtime-v5` cache exists
   - Check that "/" (root HTML) is in `note-app-v5` cache

3. **Console Logs:**
   - Look for: `[Service Worker] ✅ Returning app shell for /base/* route:`
   - Should see this for each navigation

4. **Network Tab:**
   - Filter by "Doc" (document requests)
   - Verify `/base/scratch`, `/base/now`, `/base/short-term` requests
   - Status should be 200 (from cache) or 200 (from network if online)

## If Service Worker Needs Update

If you see old behavior, the service worker might not have updated:

1. **Chrome DevTools → Application → Service Workers**
2. Click "Unregister" next to the service worker
3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
4. Check console for: `[Service Worker] Registered successfully`
5. Re-run test steps

## Expected Behavior

**Online:**
- All routes load normally from network
- Assets are cached in background

**Offline:**
- `/base/*` routes: Always return app shell (same HTML), client-side routing handles the rest
- Static assets: Served from cache if available
- Notes: Loaded from IndexedDB
- No "page isn't cached" errors for `/base/*` routes

