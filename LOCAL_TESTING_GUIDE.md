# Local Testing Guide - Service Worker Offline Fix

## Prerequisites

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open in Chrome:**
   - Go to: `http://localhost:3000/base/scratch`
   - Make sure you're logged in

---

## Step 1: Enable Debug Banner (30 seconds)

1. Open Chrome DevTools (F12)
2. Go to **Console** tab
3. Type this command and press Enter:
   ```javascript
   localStorage.setItem('sw-debug', 'true')
   ```
4. Refresh the page (F5)

**Expected Result:**
- You should see a **colored banner at the top** of the page
- **Green** = Service Worker is controlling ✅
- **Red** = Service Worker not controlling ❌

**What the banner shows:**
- `SW v2.0.0`
- `Controller: ✅` or `Controller: ❌`
- `Online: ✅` or `Online: ❌`
- `Caches: note-app-v5, note-app-runtime-v5` (or similar)

---

## Step 2: Verify Service Worker is Active (1 minute)

### Check Service Worker Status:
1. DevTools → **Application** tab
2. Left sidebar → **Service Workers**
3. Look for:
   - Status: "activated and is running" ✅
   - Source: `http://localhost:3000/sw.js`
   - "Received" timestamp should be recent

### Check Cache Status:
1. DevTools → **Application** tab
2. Left sidebar → **Cache Storage**
3. You should see:
   - `note-app-v5` (contains root HTML "/")
   - `note-app-runtime-v5` (runtime cached assets)

**✅ PASS:** Service Worker is "activated and running", caches exist  
**❌ FAIL:** Service Worker not activated OR caches missing

---

## Step 3: Test Offline Navigation (2 minutes)

### Setup:
1. Make sure you're on `/base/scratch` (online)
2. Click **"Short-Term"** tab once (while online)
3. Wait for it to load
4. Go back to **"Scratch"** tab

### Go Offline:
1. DevTools → **Network** tab
2. Check the **"Offline"** checkbox at the top
3. Debug banner should now show `Online: ❌`

### Navigate Offline:
1. Click: **Scratch** → **Now** → **Short-Term**
2. Each tab should load smoothly

**✅ PASS:** All tabs load offline, no errors, no black screen  
**❌ FAIL:** Any tab shows error, black screen, or "page isn't cached"

---

## Step 4: Check for Warning Message (30 seconds)

If you see a **yellow banner** saying:
> "Reload once to enable offline mode."

**Action:**
1. Reload the page once (F5)
2. Debug banner should turn **green**
3. Offline mode should now work

**✅ PASS:** No warning OR reload fixes it  
**❌ FAIL:** Warning persists after reload

---

## Step 5: Verify Notes Work Offline (1 minute)

1. While **offline** (Network tab → Offline checked):
2. Navigate to any tab (Scratch, Now, Short-Term)
3. **Notes should be visible** (loaded from IndexedDB)
4. **You should be able to edit** notes
5. Changes save to IndexedDB (will sync when back online)

**✅ PASS:** Notes visible and editable offline  
**❌ FAIL:** Notes don't load OR can't edit

---

## Troubleshooting

### Debug Banner Not Showing:
- Make sure you ran: `localStorage.setItem('sw-debug', 'true')`
- Refresh the page after setting the flag
- Check console for errors

### Service Worker Not Activating:
1. DevTools → Application → Service Workers
2. Click **"Unregister"** next to any old service workers
3. Hard refresh (Ctrl+Shift+R)
4. Check console for: `[Service Worker] Registered successfully`

### Offline Navigation Fails:
1. Check Network tab → Filter by "Doc"
2. Look for failed requests to `/base/scratch`, `/base/now`, etc.
3. Check console for Service Worker logs:
   - `[Service Worker] ✅ Returning app shell for /base/* route:`
4. Verify root HTML is cached:
   - Application → Cache Storage → `note-app-v5`
   - Should see "/" (root HTML) in the cache

### Cache Missing:
1. Hard refresh (Ctrl+Shift+R) while online
2. Visit `/base/scratch` and wait for it to load
3. Check Cache Storage again

---

## What to Report

If something fails, send me:

1. **Debug banner color:** Green or Red?
2. **Controller status:** ✅ or ❌?
3. **Console logs:** Copy all `[Service Worker]` messages
4. **Network tab:** Screenshot of failed requests (filter by "Doc")
5. **Cache Storage:** Screenshot showing what's cached
6. **What failed:** Exact step that didn't work

---

## Quick Checklist

- [ ] Debug banner shows (green or red)
- [ ] Banner shows `Controller: ✅` (green)
- [ ] Service Worker is "activated and running"
- [ ] Caches exist (`note-app-v5`, `note-app-runtime-v5`)
- [ ] Can navigate offline (Scratch → Now → Short-Term)
- [ ] No "page isn't cached" errors
- [ ] Notes visible offline
- [ ] Can edit notes offline
- [ ] No yellow warning message (or reload fixes it)

---

## Expected Console Logs (When Working)

When navigating offline, you should see:
```
[Service Worker] ✅ Returning app shell for /base/* route: /base/scratch
[Service Worker] ✅ Returning app shell for /base/* route: /base/now
[Service Worker] ✅ Returning app shell for /base/* route: /base/short-term
```

If you see these logs, the Service Worker is working correctly! ✅

