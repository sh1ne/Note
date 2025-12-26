# Testing Guide

## Testing on iPhone

### Option 1: Deploy to a Hosting Service (Recommended)
1. **Deploy your app** to a hosting service:
   - **Vercel** (easiest for Next.js): Connect your GitHub repo, it auto-deploys
   - **Netlify**: Similar to Vercel
   - **Firebase Hosting**: Since you're already using Firebase
   
2. **Access on iPhone**:
   - Get the deployed URL (e.g., `https://your-app.vercel.app`)
   - Open Safari on iPhone
   - Navigate to the URL
   - The app should work as a PWA (Progressive Web App)

### Option 2: Local Network Testing
1. **Find your computer's IP address**:
   - Windows: Open Command Prompt, type `ipconfig`, look for "IPv4 Address"
   - Mac: System Preferences → Network → Wi-Fi → Advanced → TCP/IP
   
2. **Start your dev server** with network access:
   ```bash
   npm run dev -- -H 0.0.0.0
   ```
   Or modify `package.json` to add `-H 0.0.0.0` to the dev script

3. **Access on iPhone**:
   - Make sure iPhone and computer are on the same Wi-Fi network
   - Open Safari on iPhone
   - Navigate to `http://YOUR_IP_ADDRESS:3000` (replace with your actual IP)

### Option 3: Use ngrok (Tunneling)
1. **Install ngrok**: Download from https://ngrok.com
2. **Start your dev server**: `npm run dev`
3. **Create tunnel**: `ngrok http 3000`
4. **Use the ngrok URL** on your iPhone (e.g., `https://abc123.ngrok.io`)

**Note**: For PWA features to work fully, you'll need HTTPS, so Option 1 (hosting service) is best.

---

## Step-by-Step Testing Instructions

### Test 1: Test Pending (UI Test)
**Purpose**: Verify the UI correctly shows pending items

**Steps**:
1. Go to More page → Sync Status section
2. Click "Add Test Item" (orange button)
3. **Observe**:
   - Pending count should increase (e.g., "1 pending")
   - Orange pulsing dot appears
   - Text changes to "1 pending" instead of "All changes saved"
4. **Wait 30 seconds** (or click "Sync Now")
5. **Check console**: Should see `[Sync Queue] Skipping test item: test-pending-...`
6. **Observe**: Pending count goes back to 0, green dot returns

**What this tests**: UI correctly displays pending state

---

### Test 2: Real Note Sync Test (Firebase Verification)
**Purpose**: Verify notes actually sync to Firebase Firestore

**Steps**:
1. Go to More page → Sync Status section
2. **Before starting**: Note which note will be tested (check console after clicking)
3. Click "Add Real Note to Queue" (blue button)
4. **Immediately check console**: Should see `[Sync Test] Adding real note to queue:` with noteId and title
5. **Observe UI**: Pending count increases, orange dot appears
6. **Option A - Wait**: Wait ~30 seconds for automatic sync
7. **Option B - Immediate**: Click "Sync Now" button to sync immediately
8. **Check console**: Should see:
   - `[Firestore] Syncing note to cloud:` (with noteId)
   - `[Firestore] Current note in Firestore:` (shows current state)
   - `[Firestore] ✅ Successfully synced note to cloud:` (confirms success)
9. **Verify in Firebase Console**:
   - Go to https://console.firebase.google.com
   - Select your project
   - Go to Firestore Database → `notes` collection
   - Find the note by ID (from console log)
   - **Check**:
     - `updatedAt` timestamp matches console log timestamp
     - `content` field contains `[QUEUED FOR TEST]`
     - `title` matches what you saw in console
10. **Observe UI**: Pending count decreases

**What this tests**: End-to-end sync from queue → Firebase → UI update

---

### Test 3: Invalid Note ID Test (Error Handling)
**Purpose**: Test what happens when a note ID doesn't exist in Firebase

**Steps**:
1. Go to More page → Sync Status section
2. **Note current pending count** (e.g., "0 pending" or "1 pending")
3. Click "Add Invalid Note ID" (red button)
4. **Check console immediately**: Should see `[Sync Test] Adding invalid note ID to queue: invalid-note-id-...`
5. **Observe UI**: Pending count increases (e.g., "1 pending" or "2 pending")
6. **Wait 30 seconds OR click "Sync Now"**
7. **Check console**: Should see RED ERROR messages:
   - `[Firestore] ❌ Note does not exist in Firestore: invalid-note-id-...`
   - `[Firestore] ❌ Error syncing note:`
   - `Error syncing note invalid-note-id-...: Error: Note ... does not exist in Firestore`
8. **Observe UI**: 
   - Error message appears: "Sync error: Failed to sync note. Will retry automatically."
   - Pending count stays the same (item remains in queue - this is CORRECT behavior)
9. **Verify in Firebase Console**:
   - Go to Firestore → `notes` collection
   - **Search for the invalid note ID** (from console: `invalid-note-id-1766708219536`)
   - **Expected**: ❌ The note should NOT exist in Firebase (this is correct!)
   - If it doesn't exist = ✅ Test passed (error handling working)
   - If it exists = ❌ Something is wrong
10. **Verify queue**: Click "View Queue Contents" → Check console → Should see the invalid note ID still in queue
11. **Clean up**: Click "Clear Queue" to remove it

**What this tests**: Error handling when note doesn't exist, queue retry logic

**Expected Result**: ❌ **ERRORS ARE CORRECT!** 
- The note doesn't exist, so it SHOULD fail
- The errors prove the system correctly identifies invalid notes
- The item stays in queue (will keep retrying - this is expected behavior)
- **Success = Seeing the errors** (means error handling works!)

---

### Test 4: Multiple Pending Test (Queue Processing)
**Purpose**: Test processing multiple items in the queue

**Steps**:
1. Go to More page → Sync Status section
2. Click "Add Multiple Notes" (purple/indigo button)
3. **Check console immediately**: Should see `[Sync Test] Adding multiple notes to queue: 5` (or however many notes you have)
4. **Observe UI**: Pending count shows "5 pending" (or "6 pending" if you had 1 already)
5. **Click "Sync Now"** to process all at once
6. **Watch console**: Should see multiple sync operations:
   - Each note syncs sequentially
   - `[Firestore] Syncing note to cloud:` for each note
   - `[Firestore] ✅ Successfully synced note to cloud:` for each note
   - All notes should have `[MULTI-TEST]` in their content
7. **Observe UI**: Pending count decreases as each note syncs
8. **Verify in Firebase Console**:
   - Go to Firestore → `notes` collection
   - Find the notes (use noteIds from console)
   - Check that `content` contains `[MULTI-TEST]`
   - Check `updatedAt` timestamps are recent

**What this tests**: Queue processes multiple items correctly, sequential sync

---

### Test 5: Offline Sync Test (Complete Verification)
**Purpose**: Test that notes save locally when offline and sync when back online

**Steps**:
1. **Before starting**: Note which note you'll test (e.g., "Scratch" or "New Note 1")
2. **Open Firebase Console** (keep it open in another tab):
   - Go to https://console.firebase.google.com
   - Select your project → Firestore Database → `notes` collection
   - Find your test note (search by title or scroll)
   - **Note the current `content` and `updatedAt` timestamp** (write it down or screenshot)
3. **Open the note in editor** (in your app)
4. **Look at note editor header** (top right) - note current pending count
5. **Open DevTools** (F12) → Network tab
6. **Check the "Offline" checkbox** (this simulates no internet)
7. **Edit the note**: Type something unique like "OFFLINE TEST [YOUR NAME] [TIMESTAMP]" 
   - Example: "OFFLINE TEST Ryan 4:25pm"
   - Make it unique so you can find it later
8. **Observe note editor header**: Should show "X pending" (e.g., "1 pending" or "2 pending")
   - The pending count increases because the note can't sync while offline
9. **Wait 5-10 seconds**: The pending count should stay the same (still offline)
10. **Go back online**: Uncheck "Offline" in Network tab
11. **Click "Sync Now" button** (on More page) to force immediate sync
   - OR wait ~30 seconds for automatic sync
12. **Observe note editor header**: Pending count should decrease
13. **Check console**: Should see:
    - `[Firestore] Syncing note to cloud:` (with your note ID)
    - `[Firestore] ✅ Successfully synced note to cloud:`
14. **Verify in Firebase Console** (the tab you kept open):
    - **Refresh the page** (or click the note again)
    - **Check `content` field**: Should contain your unique text "OFFLINE TEST [YOUR NAME] [TIMESTAMP]"
    - **Check `updatedAt` timestamp**: Should be recent (just now or a few seconds ago)
    - **Compare**: The `updatedAt` should be NEWER than what you noted before step 2
15. **Success criteria**:
    - ✅ Your unique text appears in Firebase `content`
    - ✅ `updatedAt` timestamp is recent
    - ✅ Pending count went back to 0
    - ✅ Console shows successful sync

**What this tests**: Offline saving, queue persistence, automatic sync when back online, Firebase verification

**What this tests**: Offline saving, queue persistence, automatic sync when back online

---

### Test 6: Queue Validation Test
**Purpose**: Find orphaned/invalid items in the queue

**Steps**:
1. Go to More page → Sync Status section
2. **First, add an invalid note**: Click "Add Invalid Note ID" (red button)
3. **Then, add a real note**: Click "Add Real Note to Queue" (blue button)
4. Click "Validate Queue vs Firebase" (yellow button)
5. **Check console**: Should see validation object:
   ```javascript
   {
     total: 2,
     real: 2,
     valid: 1,      // Real note that exists
     invalid: 1,    // Invalid note that doesn't exist
     invalidNoteIds: ['invalid-note-id-...']
   }
   ```
6. **Check toast**: Should show "Queue: 2 real items (1 valid, 1 invalid). Check console."
7. **What to do**: The invalid items are identified - you can clear them with "Clear Queue" or leave them (they'll keep retrying)

**What this tests**: Identifies problematic queue items that will never sync

---

### Test 7: Firebase Connection Test
**Purpose**: Verify you can connect to Firebase

**Steps**:
1. Go to More page → Sync Status section
2. Click "Test Firebase Connection" (green button)
3. **Check toast**: Should show "✅ Firebase connected! Response time: Xms"
4. **If it fails**: Check your internet connection and Firebase config

**What this tests**: Basic Firebase connectivity

---

## Why "Add Real Note" Shows Console Logs After 20-30 Seconds

The sync queue processes **automatically every 30 seconds**. So when you add a real note:
1. It's added to the queue immediately (you see the toast)
2. The queue processor runs every 30 seconds
3. After ~30 seconds, it processes your queued note
4. That's when you see the Firestore sync logs in console

**To see logs immediately**: Click "Sync Now" button - it processes the queue right away!

---

## Testing Checklist

- [ ] Test Pending - UI shows pending count
- [ ] Real Note Sync - Verifies in Firebase Console
- [ ] Invalid Note ID - Tests error handling
- [ ] Multiple Pending - Tests queue processing
- [ ] Offline Sync - See pending count in note editor header
- [ ] Queue Validation - Finds orphaned items
- [ ] Firebase Connection - Verifies connectivity
- [ ] Test on iPhone - Using one of the methods above

---

## Firebase Console Verification - Step by Step

### How to Check Firebase After Testing

**Step 1: Open Firebase Console**
1. Go to https://console.firebase.google.com
2. Select your project
3. Click "Firestore Database" in the left sidebar

**Step 2: Find Your Notes**
1. Click on the `notes` collection
2. You'll see a list of all notes with their IDs

**Step 3: Find the Test Note**
1. Look at your console logs - find the `noteId` from the sync logs
2. In Firebase Console, search for that note ID (use browser Find/Ctrl+F)
3. Or scroll through the list to find it

**Step 4: Verify the Sync Worked**
For each test, check these fields:

**After "Add Real Note to Queue" test:**
- ✅ `updatedAt` - Should be recent (matches console log timestamp)
- ✅ `content` - Should contain `[QUEUED FOR TEST]`
- ✅ `title` - Should match the note title from console

**After "Add Multiple Notes" test:**
- ✅ Multiple notes should have `[MULTI-TEST]` in their `content`
- ✅ All should have recent `updatedAt` timestamps
- ✅ Count how many were updated (should match how many you added)

**After "Invalid Note ID" test:**
- ❌ The invalid note ID should NOT appear in Firebase (it doesn't exist)
- ✅ This confirms the error handling worked correctly

**After offline sync test:**
- ✅ The note you edited offline should have your changes
- ✅ `updatedAt` should be recent (when it synced after going online)

### What to Look For in Firebase

**Good Signs (Everything Working):**
- ✅ Notes have recent `updatedAt` timestamps
- ✅ `content` matches what you typed
- ✅ `notebookId` is correct
- ✅ No duplicate notes

**Bad Signs (Problems):**
- ❌ `updatedAt` is old (note didn't sync)
- ❌ Missing notes (should be there but aren't)
- ❌ Wrong `notebookId` (note in wrong notebook)
- ❌ Duplicate notes (same content, different IDs)

