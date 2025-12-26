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

## Sync Testing Scenarios

### 1. Test Pending (UI Test)
- **Button**: "Add Test Item" (orange)
- **What it does**: Adds a fake item to sync queue
- **Expected**: 
  - Pending count increases
  - Orange dot appears
  - Shows "X pending"
  - Auto-removed after 30 seconds (check console: `[Sync Queue] Skipping test item`)

### 2. Real Note Sync Test
- **Button**: "Add Real Note to Queue" (blue)
- **What it does**: Adds an actual note to queue (will sync to Firebase)
- **Expected**:
  - Console shows: `[Sync Test] Adding real note to queue:`
  - Pending count increases
  - After 30 seconds (or click "Sync Now"), console shows:
    - `[Firestore] Syncing note to cloud:`
    - `[Firestore] ✅ Successfully synced note to cloud:`
  - Check Firebase Console → notes collection → verify the note was updated
  - Pending count decreases

### 3. Invalid Note ID Test
- **Button**: "Add Invalid Note ID" (red) - NEW!
- **What it does**: Adds a note with a fake ID that doesn't exist in Firebase
- **Expected**:
  - Pending count increases
  - When sync tries, it will fail (note doesn't exist)
  - Console shows error: `Error syncing note invalid-note-id-...`
  - Item stays in queue (error handling test)
  - Use "View Queue Contents" to see it's still there

### 4. Multiple Pending Test
- **Button**: "Add Multiple Notes" (indigo) - NEW!
- **What it does**: Adds up to 5 real notes to queue
- **Expected**:
  - Pending count shows "5 pending" (or however many notes you have)
  - They sync one by one every 30 seconds
  - Or click "Sync Now" to sync all at once
  - Watch console to see each one sync sequentially

### 5. Offline Sync Test
- **Steps**:
  1. Open a note in the editor
  2. Open DevTools → Network tab → Check "Offline"
  3. Edit the note (type something)
  4. **NEW**: You'll see "X pending" in the note editor header (top right)
  5. The note saves locally immediately
  6. Go back online (uncheck "Offline")
  7. Wait 30 seconds or click "Sync Now"
  8. Note syncs to Firebase
  9. Pending count goes to 0

### 6. Queue Validation Test
- **Button**: "Validate Queue vs Firebase" (yellow)
- **What it does**: Checks if queued note IDs actually exist in Firebase
- **Expected**:
  - Console shows validation results
  - Identifies any orphaned/invalid queue items
  - Toast shows: "X real items (Y valid, Z invalid)"

### 7. Firebase Connection Test
- **Button**: "Test Firebase Connection" (green)
- **What it does**: Verifies you can read from Firestore
- **Expected**:
  - Toast shows: "✅ Firebase connected! Response time: Xms"
  - If fails: Shows error message

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

## Firebase Console Verification

To verify sync is working:
1. Go to Firebase Console → Firestore Database
2. Navigate to `notes` collection
3. Find the note ID from console logs
4. Check `updatedAt` timestamp - should match console log timestamp
5. Check `content` - should have `[QUEUED FOR TEST]` or `[MULTI-TEST]` if you used test buttons

