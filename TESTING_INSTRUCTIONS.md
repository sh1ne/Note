# Clear Testing Instructions

## Prerequisites
1. Make sure `npm run dev` is running (localhost should be accessible)
2. Open Chrome DevTools (F12)

## Test 1: Verify "All Notes" and "More" tabs appear offline

### Steps:
1. **Go to Application tab → Service Workers**
   - Click "Unregister" on any existing service workers
   - This ensures you get the latest Service Worker code

2. **Hard refresh the page** (Ctrl+Shift+R or Cmd+Shift+R)
   - This loads the new Service Worker

3. **Go online** (make sure Network tab "Offline" checkbox is UNCHECKED)
   - Navigate to `/base/scratch`
   - Wait for page to fully load

4. **Go offline** (Network tab → Check "Offline" checkbox)

5. **Check the bottom navigation bar**
   - You should see 6 tabs: Scratch, Now, Short, Long, All Notes, More
   - ✅ **PASS** if you see all 6 tabs
   - ❌ **FAIL** if you only see 4 tabs (Scratch, Now, Short, Long)

---

## Test 2: Smoke test - Navigate between staple tabs offline

### Steps:
1. **Go online** (Network tab → Uncheck "Offline")
   - Navigate to `/base/scratch`
   - Wait for page to fully load
   - Click on `/base/short-term` tab once (while online)
   - Wait for it to load
   - This caches the route

2. **Go offline** (Network tab → Check "Offline" checkbox)

3. **Navigate: Scratch → Now → Short-Term**
   - Click "Scratch" tab → Should load
   - Click "Now" tab → Should load (or show error - see Test 3)
   - Click "Short" tab → Should load

4. **Check for errors:**
   - ✅ **PASS** if all pages load without "page isn't cached" error
   - ✅ **PASS** if no infinite loops/spinners
   - ❌ **FAIL** if you see "Offline, this page isn't cached" message
   - ❌ **FAIL** if page keeps loading/spinning forever

---

## Test 3: Debug "Note not found" error when clicking "Now" offline

### Steps:
1. **Go online** (Network tab → Uncheck "Offline")
   - Navigate to `/base/scratch`
   - Wait for page to fully load

2. **Go offline** (Network tab → Check "Offline")

3. **Click "Now" tab**

4. **Check Console tab** for these logs:
   - Look for `[loadNote]` messages
   - Look for `[useTabs]` messages
   - Look for any error messages

5. **Check Application tab → IndexedDB:**
   - Expand your database
   - Look for a "notes" store
   - Check if there's a note with title "Now"
   - Check if there's a note with title "Scratch" (for comparison)

6. **Report back:**
   - What error message do you see? (exact text)
   - What console logs appear when clicking "Now"?
   - Does "Now" note exist in IndexedDB?
   - Does "Scratch" note exist in IndexedDB?

---

## Quick Service Worker Reset (if needed)

If Service Worker seems stuck or not updating:

1. **DevTools → Application → Service Workers**
   - Click "Unregister" on all service workers

2. **DevTools → Application → Clear storage**
   - Click "Clear site data" button
   - This clears Service Worker cache

3. **Hard refresh** (Ctrl+Shift+R)

4. **Check Console** for: `[Service Worker] Registered successfully`

---

## What to Report

After running all tests, tell me:

1. **Test 1 result:** Do you see 6 tabs (including All Notes and More) when offline?
2. **Test 2 result:** Can you navigate Scratch → Now → Short-Term offline without "page isn't cached" error?
3. **Test 3 findings:** 
   - Exact error message when clicking "Now"
   - Console logs (copy/paste the relevant ones)
   - Does "Now" note exist in IndexedDB?

