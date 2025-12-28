# Testing Steps - Service Worker Verification

## PART A: Enable Debug Banner (Desktop Chrome)

### Step 1: Enable Debug Mode
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Type: `localStorage.setItem('sw-debug', 'true')`
4. Press Enter
5. Refresh the page (F5)

### Step 2: Verify Debug Banner
You should see a **green or red banner at the top** of the page showing:
- `SW v2.0.0`
- `Controller: ✅` (green) or `Controller: ❌` (red)
- `Online: ✅` or `Online: ❌`
- `Caches: note-app-v5, note-app-runtime-v5` (or similar)

**✅ PASS:** Banner is green with `Controller: ✅`  
**❌ FAIL:** Banner is red with `Controller: ❌`

---

## PART B: Test Offline Navigation (Desktop Chrome)

### Step 1: Load Pages Online
1. Go to: `http://localhost:3000/base/scratch` (or your Vercel URL)
2. Wait for page to fully load
3. Click "Short-Term" tab once
4. Wait for it to load
5. Go back to "Scratch" tab

### Step 2: Go Offline
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check the "Offline" checkbox
4. Debug banner should show `Online: ❌`

### Step 3: Navigate Offline
1. Click: **Scratch** → **Now** → **Short-Term**
2. Each tab should load smoothly

**✅ PASS:** All tabs load offline, no "page isn't cached" error, no black screen  
**❌ FAIL:** Any tab shows error, black screen, or infinite loading

---

## PART C: Test on iPhone Safari

### Step 1: Enable Debug Banner on iPhone
1. Open Safari on iPhone
2. Go to your Vercel URL: `https://note-three-delta.vercel.app/base/scratch`
3. Open Safari settings (share button → "Add to Home Screen" if needed, or just use Safari)
4. Open the page
5. **To enable debug banner on iPhone:**
   - Connect iPhone to Mac
   - Open Safari on Mac → Develop menu → [Your iPhone] → [Your Tab]
   - In Console, type: `localStorage.setItem('sw-debug', 'true')`
   - Refresh page on iPhone

### Step 2: Check Debug Banner
Look at the top of the page on iPhone:
- Should see a colored banner (green or red)
- Green = Service Worker is controlling ✅
- Red = Service Worker not controlling ❌

**✅ PASS:** Banner is green with `Controller: ✅`  
**❌ FAIL:** Banner is red with `Controller: ❌`

### Step 3: Test Offline on iPhone
1. **Enable Airplane Mode** on iPhone
2. Open the app (should still work)
3. Navigate: Scratch → Now → Short-Term
4. Each tab should load

**✅ PASS:** All tabs work offline, notes visible, can edit  
**❌ FAIL:** Black screen, "page isn't cached" error, or app doesn't open

### Step 4: Check for Warning Message
If you see a **yellow banner** saying "Reload once to enable offline mode":
1. Reload the page once
2. Debug banner should turn green
3. Offline mode should now work

---

## What to Send Me If It Fails

### Screenshots:
1. **Debug banner** (top of page) - shows SW status
2. **Console logs** (if on desktop)
3. **Network tab** (if on desktop, filter by "Doc")
4. **Error message** (if any)

### Information:
1. **Device:** iPhone Safari or Desktop Chrome?
2. **URL:** What URL were you on?
3. **What happened:** Exact steps that failed
4. **Debug banner color:** Green or red?
5. **Controller status:** ✅ or ❌?

### Console Logs (if on desktop):
Copy all console logs, especially:
- `[Service Worker] Registered successfully`
- `[Service Worker] Initial install complete`
- `[Service Worker] ✅ Returning app shell for /base/* route:`
- Any errors in red

---

## Expected Behavior Summary

### ✅ Working Correctly:
- **Debug banner:** Green with `Controller: ✅`
- **Offline navigation:** All `/base/*` tabs load offline
- **No errors:** No "page isn't cached" for `/base/*` routes
- **Notes visible:** Can see and edit notes offline
- **Sync later:** Changes sync when back online

### ❌ Not Working:
- **Debug banner:** Red with `Controller: ❌`
- **Offline fails:** Black screen or "page isn't cached" error
- **App doesn't open:** Stuck on loading screen
- **No notes:** Can't see notes offline

---

## Quick Test Checklist

**Desktop Chrome:**
- [ ] Debug banner shows (green or red)
- [ ] Banner shows `Controller: ✅` (green)
- [ ] Can navigate offline (Scratch → Now → Short-Term)
- [ ] No "page isn't cached" errors
- [ ] Notes visible offline

**iPhone Safari:**
- [ ] Debug banner shows (green or red)
- [ ] Banner shows `Controller: ✅` (green)
- [ ] App opens in airplane mode
- [ ] Can navigate offline
- [ ] Notes visible and editable offline
- [ ] No yellow warning message (or reload fixes it)

