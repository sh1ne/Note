# Simple Testing Steps (No Service Worker Reset Needed)

## First Time Setup (Only Once)
1. Make sure `npm run dev` is running
2. Open `localhost:3000` in Chrome
3. Open DevTools (F12) → Application → Service Workers
4. If you see a service worker, note the "Received" time
5. That's it - you're ready to test!

---

## Test 1: Check if "All Notes" and "More" tabs appear (2 minutes)

**No Service Worker reset needed - just test!**

1. Go to `/base/scratch` (while online)
2. Wait for page to load
3. Go offline (Network tab → Check "Offline")
4. Look at bottom navigation bar

**Expected:** 6 tabs visible (Scratch, Now, Short, Long, All Notes, More)  
**Result:** ✅ Pass or ❌ Fail

---

## Test 2: Navigate between tabs offline (3 minutes)

**No Service Worker reset needed - just test!**

1. Go online → `/base/scratch` → Wait to load
2. Click "Short" tab once (while online) → Wait to load
3. Go offline (Network tab → Check "Offline")
4. Click: Scratch → Now → Short

**Expected:** All pages load, no "page isn't cached" error  
**Result:** ✅ Pass or ❌ Fail

---

## When Do You Need to Reset Service Worker?

**ONLY if I tell you "Service Worker code changed" or you see old behavior**

**Quick Reset (30 seconds):**
1. DevTools → Application → Service Workers
2. Click "Unregister"
3. Hard refresh (Ctrl+Shift+R)
4. Check console for: `[Service Worker] Registered successfully`

**How to verify new code loaded:**
- Check "Received" timestamp in Service Workers panel
- Should be recent (within last few minutes)
- Or check console for registration message

---

## For Your Current Tests

**You DON'T need to reset Service Worker right now!**

Just:
1. Make sure dev server is running (`npm run dev`)
2. Go to `localhost:3000/base/scratch`
3. Run the tests above

The Service Worker is already registered and working. You're just testing if the tabs appear and navigation works.

