# Comprehensive Testing Guide

This document provides a complete testing checklist for the Note App. Test every feature, edge case, and user flow to ensure production readiness.

## Table of Contents

1. [Testing Setup](#testing-setup)
2. [Core Functionality Tests](#core-functionality-tests)
3. [Rich Text Editor Tests](#rich-text-editor-tests)
4. [Notebook & Tab System Tests](#notebook--tab-system-tests)
5. [Sync & Offline Tests](#sync--offline-tests)
6. [User Interface Tests](#user-interface-tests)
7. [Share & Export Tests](#share--export-tests)
8. [Account & Settings Tests](#account--settings-tests)
9. [Mobile-Specific Tests](#mobile-specific-tests)
10. [Cross-Device Tests](#cross-device-tests)
11. [Edge Cases & Error Handling](#edge-cases--error-handling)
12. [Performance Tests](#performance-tests)
13. [Firebase Verification](#firebase-verification)

---

## Testing Setup

### Prerequisites
- Local development server running (`npm run dev`)
- Firebase Console open (https://console.firebase.google.com)
- Browser DevTools open (F12)
- iPhone for mobile testing (optional but recommended)

### Testing on iPhone

**Option 1: Deploy to Vercel (Recommended)**
1. Push code to GitHub
2. Vercel auto-deploys
3. Open deployed URL in Safari on iPhone
4. Add to Home Screen for PWA experience

**Option 2: Local Network Testing**
1. Find computer's IP address (Windows: `ipconfig`, Mac: System Preferences)
2. Start dev server: `npm run dev -- -H 0.0.0.0`
3. On iPhone (same Wi-Fi): Navigate to `http://YOUR_IP:3000`

**Option 3: ngrok Tunneling**
1. Install ngrok from https://ngrok.com
2. Start dev server: `npm run dev`
3. Create tunnel: `ngrok http 3000`
4. Use ngrok URL on iPhone

---

## Core Functionality Tests

### Test 1: User Authentication
**Purpose**: Verify login, signup, and session persistence

**Steps**:
1. [ ] Navigate to login page
2. [ ] Enter valid credentials → Click "Sign In"
3. [ ] Verify: Redirected to notebook page
4. [ ] Close browser tab
5. [ ] Reopen app → Verify: Still logged in (auth persistence)
6. [ ] Click "Logout" → Verify: Redirected to login
7. [ ] Test signup flow with new account
8. [ ] Test invalid credentials → Verify: Error message shown

**Expected**: Users stay logged in, can log out, errors handled gracefully

---

### Test 2: Notebook Creation & Management
**Purpose**: Verify notebook CRUD operations

**Steps**:
1. [ ] Go to More → Notebooks section
2. [ ] Click "+" to create new notebook
3. [ ] Enter name: "Test Notebook"
4. [ ] Verify: Notebook appears in list
5. [ ] Click on notebook → Verify: Switches to that notebook
6. [ ] Create note in new notebook
7. [ ] Switch back to original notebook
8. [ ] Verify: Notes are isolated (don't mix between notebooks)
9. [ ] Delete test notebook → Verify: Notebook and all its notes/tabs deleted from Firebase

**Expected**: Notebooks are isolated, CRUD operations work correctly

---

### Test 3: Note Creation
**Purpose**: Verify note creation flow

**Steps**:
1. [ ] Click "+" button in bottom nav
2. [ ] Verify: New note created and opened in editor
3. [ ] Verify: New tab appears in bottom nav
4. [ ] Type content in note
5. [ ] Verify: Note saves automatically (check console for sync logs)
6. [ ] Verify: Note appears in "All Notes" list
7. [ ] Verify: Note title auto-generates from first line

**Expected**: Notes create correctly, auto-save works, tabs update

---

### Test 4: Note Editing
**Purpose**: Verify note editing and auto-save

**Steps**:
1. [ ] Open existing note
2. [ ] Type content → Verify: No immediate sync (debouncing)
3. [ ] Stop typing for 2.5 seconds → Verify: Sync occurs (check console)
4. [ ] Edit title by clicking on it
5. [ ] Change title → Verify: Title updates
6. [ ] Verify: Tab name updates if note is in a tab
7. [ ] Make rapid edits → Verify: Only one sync after stopping (debouncing works)

**Expected**: Auto-save works, debouncing prevents excessive syncs

---

### Test 5: Note Deletion & Recovery
**Purpose**: Verify trash system

**Steps**:
1. [ ] Create a test note
2. [ ] Delete the note (three dots menu or delete button)
3. [ ] Verify: Note disappears from list
4. [ ] Go to More → Trash → View Deleted Notes
5. [ ] Verify: Deleted note appears in trash list
6. [ ] Click "Restore" on deleted note
7. [ ] Verify: Note reappears in notes list
8. [ ] Delete note again
9. [ ] Click "Delete Permanently"
10. [ ] Verify: Note removed from Firebase (check Firebase Console)

**Expected**: Deleted notes go to trash, can be restored, permanent delete works

---

## Rich Text Editor Tests

### Test 6: Text Formatting
**Purpose**: Verify all formatting options work

**Steps**:
1. [ ] Open note editor
2. [ ] Type text and select it
3. [ ] Click "B" (Bold) → Verify: Text becomes bold
4. [ ] Click "I" (Italic) → Verify: Text becomes italic
5. [ ] Click "U" (Underline) → Verify: Text becomes underlined
6. [ ] Click "S" (Strikethrough) → Verify: Text has strikethrough
7. [ ] Apply multiple formats → Verify: All formats apply correctly
8. [ ] Click format button again → Verify: Format toggles off
9. [ ] Test in dark mode → Verify: Toolbar buttons are visible (not black on black)

**Expected**: All formatting works, toolbar visible in all themes

---

### Test 7: Text Alignment
**Purpose**: Verify alignment options

**Steps**:
1. [ ] Type text in note
2. [ ] Click "Align Left" → Verify: Text aligns left
3. [ ] Click "Align Center" → Verify: Text centers
4. [ ] Click "Align Right" → Verify: Text aligns right
5. [ ] Create task list
6. [ ] Apply alignment to task list → Verify: Task items respect alignment

**Expected**: Alignment works for paragraphs and task lists

---

### Test 8: Lists
**Purpose**: Verify all list types

**Steps**:
1. [ ] Click "•" (Bullet List) → Verify: Bullet list created
2. [ ] Add multiple items → Verify: Each item is a bullet
3. [ ] Click "1." (Numbered List) → Verify: Numbered list created
4. [ ] Add multiple items → Verify: Numbers increment
5. [ ] Click "☑" (Task List) → Verify: Task list created
6. [ ] Click checkbox → Verify: Task marked complete
7. [ ] Create nested list (indent) → Verify: Nested structure works
8. [ ] Apply alignment to list items → Verify: Alignment works

**Expected**: All list types work, nesting works, alignment works

---

### Test 9: Undo/Redo
**Purpose**: Verify undo/redo functionality

**Steps**:
1. [ ] Type text in note
2. [ ] Click "Undo" button (top header) → Verify: Last action undone
3. [ ] Click "Redo" button → Verify: Action redone
4. [ ] Make multiple edits
5. [ ] Click undo multiple times → Verify: Each action undone in order
6. [ ] Verify: Undo button disabled when nothing to undo
7. [ ] Verify: Redo button disabled when nothing to redo
8. [ ] Test on mobile → Verify: Undo/redo buttons visible and functional

**Expected**: Undo/redo works correctly, buttons enable/disable properly

---

### Test 10: Cursor Placement
**Purpose**: Verify cursor moves to clicked position

**Steps**:
1. [ ] Type text in note
2. [ ] Click on blank space below text → Verify: Cursor moves to closest typing position
3. [ ] Click in middle of text → Verify: Cursor placed at click position
4. [ ] Click at end of text → Verify: Cursor at end
5. [ ] Click at beginning → Verify: Cursor at beginning

**Expected**: Cursor placement works correctly

---

## Notebook & Tab System Tests

### Test 11: Staple Notes
**Purpose**: Verify staple notes (Scratch, Now, Short-Term, Long-Term) work

**Steps**:
1. [ ] Click "Scratch" in bottom nav → Verify: Opens Scratch note
2. [ ] Edit Scratch note → Verify: Saves correctly
3. [ ] Click "Now" → Verify: Opens Now note
4. [ ] Edit Now note → Verify: Saves correctly
5. [ ] Repeat for Short-Term and Long-Term
6. [ ] Verify: Each staple note is separate
7. [ ] Verify: Staple notes appear in search (All Notes search)
8. [ ] Verify: Staple notes don't appear in regular notes list

**Expected**: All staple notes work independently, search includes them

---

### Test 12: Tab Navigation
**Purpose**: Verify bottom navigation works

**Steps**:
1. [ ] Click each tab in bottom nav → Verify: Navigates correctly
2. [ ] Click "All Notes" → Verify: Shows all notes list
3. [ ] Click "More" → Verify: Opens More page
4. [ ] Create new note → Verify: New tab appears in bottom nav
5. [ ] Click new tab → Verify: Opens that note
6. [ ] Delete note → Verify: Tab removed from bottom nav
7. [ ] Test on mobile → Verify: Bottom nav has rounded corners, text doesn't wrap

**Expected**: Navigation works, tabs update correctly, mobile UI correct

---

### Test 13: All Notes Page
**Purpose**: Verify All Notes functionality

**Steps**:
1. [ ] Click "All Notes" in bottom nav
2. [ ] Verify: List of all notes displayed
3. [ ] Verify: Staple notes NOT in list (but searchable)
4. [ ] Click "+" button in header → Verify: Creates new note
5. [ ] Type in search box → Verify: Searches note bodies (not titles)
6. [ ] Verify: Search includes staple notes
7. [ ] Click on note → Verify: Opens note editor
8. [ ] Verify: Back button returns to All Notes

**Expected**: All Notes displays correctly, search works, plus button works

---

## Sync & Offline Tests

### Test 14: Automatic Sync
**Purpose**: Verify notes sync automatically to Firebase

**Steps**:
1. [ ] Open note editor
2. [ ] Type content
3. [ ] Stop typing for 2.5 seconds
4. [ ] Check console: Should see `[Firestore] Syncing note to cloud:`
5. [ ] Check console: Should see `[Firestore] ✅ Successfully synced note to cloud:`
6. [ ] Open Firebase Console → Firestore → `notes` collection
7. [ ] Find note by ID (from console log)
8. [ ] Verify: `content` matches what you typed
9. [ ] Verify: `updatedAt` timestamp is recent
10. [ ] Verify: UI shows "All changes saved" with green dot

**Expected**: Notes sync automatically, Firebase updated, UI reflects status

---

### Test 15: Offline Sync
**Purpose**: Verify offline functionality and sync queue

**Steps**:
1. [ ] Open Firebase Console → Find a note → Note current `content` and `updatedAt`
2. [ ] Open note in editor
3. [ ] Open DevTools (F12) → Network tab → Check "Offline"
4. [ ] Edit note: Type "OFFLINE TEST [YOUR NAME] [TIME]" (unique text)
5. [ ] Verify: Note editor header shows "X pending"
6. [ ] Verify: Pending count increases
7. [ ] Wait 10 seconds → Verify: Still pending (offline)
8. [ ] Uncheck "Offline" in Network tab
9. [ ] Click "Sync Now" OR wait ~30 seconds
10. [ ] Verify: Pending count decreases
11. [ ] Check console: Should see sync logs
12. [ ] Verify in Firebase Console: Refresh → Check `content` has your unique text
13. [ ] Verify: `updatedAt` is recent (newer than step 1)

**Expected**: Offline edits queue, sync when online, Firebase updated

---

### Test 16: Sync Queue Processing
**Purpose**: Verify queue handles multiple items

**Steps**:
1. [ ] Go to More → Sync Status section
2. [ ] Click "Add Multiple Notes" (purple button)
3. [ ] Verify: Pending count increases (e.g., "5 pending")
4. [ ] Click "Sync Now"
5. [ ] Watch console: Should see multiple sync operations
6. [ ] Verify: Each note syncs sequentially
7. [ ] Verify: Pending count decreases as each syncs
8. [ ] Verify in Firebase Console: All notes have `[MULTI-TEST]` in content
9. [ ] Verify: All `updatedAt` timestamps are recent

**Expected**: Queue processes multiple items correctly

---

### Test 17: Sync Error Handling
**Purpose**: Verify error handling for invalid notes

**Steps**:
1. [ ] Go to More → Sync Status section
2. [ ] Click "Add Invalid Note ID" (red button)
3. [ ] Verify: Pending count increases
4. [ ] Click "Sync Now"
5. [ ] Check console: Should see RED ERROR messages
6. [ ] Verify: Error message: "Note ... does not exist in Firestore"
7. [ ] Verify: Pending count stays same (item remains in queue)
8. [ ] Verify: Toast shows error message
9. [ ] Verify in Firebase Console: Invalid note ID does NOT exist (correct!)
10. [ ] Click "Clear Queue" → Verify: Queue cleared

**Expected**: Errors handled gracefully, invalid items stay in queue for retry

---

### Test 18: Sync Status UI
**Purpose**: Verify sync status indicators

**Steps**:
1. [ ] Go to More page → Sync Status section
2. [ ] Verify: Shows "All changes saved" with green dot when synced
3. [ ] Verify: Shows "X pending" with orange dot when pending
4. [ ] Verify: Shows "Last synced: X ago" timestamp
5. [ ] Edit a note → Verify: Status updates to pending
6. [ ] Wait for sync → Verify: Status updates to saved
7. [ ] Check note editor header → Verify: Shows pending count when in note

**Expected**: Sync status accurately reflects state

---

## User Interface Tests

### Test 19: Theme Switching
**Purpose**: Verify all themes work correctly

**Steps**:
1. [ ] Go to More → Theme section
2. [ ] Click "Dark" → Verify: Theme changes to dark
3. [ ] Verify: Toolbar buttons visible (not black on black)
4. [ ] Click "Light" → Verify: Theme changes to light
5. [ ] Verify: All UI elements visible
6. [ ] Click "Purple" → Verify: Theme changes to purple
7. [ ] Click "Blue" → Verify: Theme changes to blue
8. [ ] Refresh page → Verify: Theme persists (saved preference)
9. [ ] Test on mobile → Verify: Themes work on iPhone

**Expected**: All themes work, preferences persist, toolbar visible in all themes

---

### Test 20: Mobile Toolbar Behavior
**Purpose**: Verify mobile toolbar only shows when needed

**Steps**:
1. [ ] Open note on mobile (iPhone)
2. [ ] Verify: Toolbar NOT visible initially
3. [ ] Select text → Verify: Toolbar appears
4. [ ] Deselect text → Verify: Toolbar disappears
5. [ ] Type text → Verify: Toolbar appears when text selected
6. [ ] Verify: Toolbar positioned above keyboard (not covered)
7. [ ] Verify: Toolbar fits in one row (no wrapping)
8. [ ] Verify: No undo/redo buttons in mobile toolbar (only in top header)
9. [ ] Test toolbar buttons → Verify: All work correctly

**Expected**: Toolbar only shows when text selected, positioned correctly, no wrapping

---

### Test 21: Bottom Navigation
**Purpose**: Verify bottom nav works on mobile

**Steps**:
1. [ ] Open app on iPhone
2. [ ] Verify: Bottom nav has rounded top corners
3. [ ] Verify: Text doesn't wrap (Short/Long labels)
4. [ ] Verify: Icons aligned uniformly
5. [ ] Verify: Safe area spacing at bottom
6. [ ] Click each tab → Verify: All tabs clickable and navigate correctly
7. [ ] Verify: Active tab highlighted
8. [ ] Test in landscape mode → Verify: Layout still works

**Expected**: Bottom nav looks good, all tabs functional, proper spacing

---

### Test 22: Responsive Design
**Purpose**: Verify app works on different screen sizes

**Steps**:
1. [ ] Test on desktop (1920x1080) → Verify: Layout correct
2. [ ] Test on tablet (768px width) → Verify: Layout adapts
3. [ ] Test on mobile (375px width) → Verify: Mobile layout
4. [ ] Resize browser window → Verify: Layout adapts smoothly
5. [ ] Test toolbar on each size → Verify: Toolbar works correctly
6. [ ] Test bottom nav on each size → Verify: Nav works correctly

**Expected**: App responsive, works on all screen sizes

---

## Share & Export Tests

### Test 23: Share via Email
**Purpose**: Verify email sharing works

**Steps**:
1. [ ] Open note editor
2. [ ] Click "Share" button → Verify: Dropdown menu appears
3. [ ] Click "Share via Email"
4. [ ] Verify: Email client opens (or toast shows "Opening email client")
5. [ ] Verify: Note content in email body
6. [ ] On desktop without email client → Verify: Falls back to copy to clipboard
7. [ ] Verify: Toast notification shows success

**Expected**: Email sharing works, fallback works, visual feedback provided

---

### Test 24: Share via App
**Purpose**: Verify native share works

**Steps**:
1. [ ] Open note editor
2. [ ] Click "Share" → "Share via App"
3. [ ] Verify: Native share dialog appears (mobile)
4. [ ] Verify: Share menu closes immediately
5. [ ] Select share option (e.g., Messages, Mail)
6. [ ] Verify: Note content shared correctly

**Expected**: Native share works, menu closes properly

---

### Test 25: Copy to Clipboard
**Purpose**: Verify clipboard functionality

**Steps**:
1. [ ] Open note with content
2. [ ] Click "Share" → "Copy to Clipboard"
3. [ ] Verify: Toast notification appears ("Copied to clipboard!")
4. [ ] Paste in another app → Verify: Content pasted correctly
5. [ ] Verify: Plain text copied (not HTML)

**Expected**: Clipboard works, visual feedback provided

---

### Test 26: Export as Text File
**Purpose**: Verify text file export

**Steps**:
1. [ ] Open note with content
2. [ ] Click "Share" → "Export as Text File"
3. [ ] Verify: File downloads
4. [ ] Open downloaded file → Verify: Content correct
5. [ ] Verify: File name is note title or "note.txt"

**Expected**: Text file exports correctly

---

## Account & Settings Tests

### Test 27: Account Management
**Purpose**: Verify account section works

**Steps**:
1. [ ] Go to More → Account section
2. [ ] Verify: Email displayed
3. [ ] Click "Logout" → Verify: Logs out and redirects to login
4. [ ] Log back in → Verify: Account info still correct

**Expected**: Account info displayed, logout works

---

### Test 28: Storage Usage
**Purpose**: Verify storage display

**Steps**:
1. [ ] Go to More → Storage section
2. [ ] Verify: Note count displayed
3. [ ] Verify: Estimated size displayed
4. [ ] Create multiple notes
5. [ ] Refresh More page → Verify: Counts update

**Expected**: Storage info accurate and updates

---

### Test 29: Cleanup & Maintenance
**Purpose**: Verify cleanup functions work

**Steps**:
1. [ ] Go to More → Cleanup & Maintenance section
2. [ ] Click "Delete All Notes" (red button)
3. [ ] Verify: ConfirmDialog appears
4. [ ] Confirm deletion
5. [ ] Verify: All notes deleted from Firebase
6. [ ] Verify: Orphaned tabs cleaned up
7. [ ] Verify: Local storage cleared
8. [ ] Verify: Staple notes recreated when accessed

**Expected**: Cleanup works, confirms before deleting, cleans everything

---

## Mobile-Specific Tests

### Test 30: PWA Installation
**Purpose**: Verify app can be installed on iPhone

**Steps**:
1. [ ] Open app in Safari on iPhone
2. [ ] Tap Share button
3. [ ] Select "Add to Home Screen"
4. [ ] Verify: App icon appears on home screen
5. [ ] Tap icon → Verify: App opens full screen (no browser UI)
6. [ ] Verify: App works like native app

**Expected**: App installs and works as PWA

---

### Test 31: Mobile Keyboard Behavior
**Purpose**: Verify keyboard doesn't cover UI

**Steps**:
1. [ ] Open note editor on iPhone
2. [ ] Tap in editor → Verify: Keyboard appears
3. [ ] Verify: Toolbar positioned above keyboard (when text selected)
4. [ ] Verify: Editor content scrollable above keyboard
5. [ ] Type text → Verify: Can see what you're typing
6. [ ] Dismiss keyboard → Verify: Toolbar disappears

**Expected**: Keyboard doesn't cover content, toolbar accessible

---

### Test 32: Touch Interactions
**Purpose**: Verify touch targets are adequate

**Steps**:
1. [ ] Test all buttons on mobile → Verify: Easy to tap
2. [ ] Test bottom nav buttons → Verify: All clickable
3. [ ] Test toolbar buttons → Verify: All clickable
4. [ ] Test text selection → Verify: Easy to select text
5. [ ] Test scrolling → Verify: Smooth scrolling

**Expected**: All touch targets adequate size, interactions smooth

---

## Cross-Device Tests

### Test 33: Cross-Device Sync
**Purpose**: Verify notes sync between devices

**Steps**:
1. [ ] On desktop: Create/edit a note
2. [ ] Wait for sync (or click "Sync Now")
3. [ ] On iPhone: Open app → Verify: Note appears
4. [ ] On iPhone: Edit the note
5. [ ] On desktop: Refresh → Verify: Changes appear
6. [ ] On desktop: Make another edit
7. [ ] On iPhone: Refresh → Verify: Changes appear
8. [ ] Verify: No conflicts, latest edit wins

**Expected**: Notes sync between devices correctly

---

### Test 34: Multiple Notebooks Isolation
**Purpose**: Verify notebooks are isolated

**Steps**:
1. [ ] Create new notebook "Test Notebook"
2. [ ] Create note in new notebook
3. [ ] Switch to original notebook
4. [ ] Verify: Test notebook's note doesn't appear
5. [ ] Switch back to Test Notebook
6. [ ] Verify: Note still there
7. [ ] On different device: Verify: Notebook isolation maintained

**Expected**: Notebooks completely isolated across devices

---

## Edge Cases & Error Handling

### Test 35: Rapid Edits
**Purpose**: Verify debouncing prevents excessive syncs

**Steps**:
1. [ ] Open note editor
2. [ ] Type rapidly without stopping (100+ characters)
3. [ ] Check console: Should NOT see multiple syncs
4. [ ] Stop typing for 2.5 seconds
5. [ ] Check console: Should see ONE sync
6. [ ] Verify: All content saved correctly

**Expected**: Debouncing works, only one sync after stopping

---

### Test 36: Large Note Content
**Purpose**: Verify sync handles large content

**Steps**:
1. [ ] Create new note
2. [ ] Paste large amount of text (5000+ words)
3. [ ] Wait for sync
4. [ ] Check Firebase Console → Verify: Content synced correctly
5. [ ] Verify: No errors in console
6. [ ] Open note again → Verify: All content loads

**Expected**: Large content syncs without issues

---

### Test 37: Network Interruption
**Purpose**: Verify recovery from network issues

**Steps**:
1. [ ] Start editing a note
2. [ ] Go offline mid-edit (DevTools → Network → Offline)
3. [ ] Continue typing
4. [ ] Verify: Changes saved locally
5. [ ] Go back online
6. [ ] Verify: All changes sync correctly
7. [ ] Verify: No data loss

**Expected**: No data loss during network interruption

---

### Test 38: Concurrent Edits
**Purpose**: Verify handling of simultaneous edits

**Steps**:
1. [ ] On desktop: Open note and start editing
2. [ ] On iPhone: Open same note
3. [ ] On desktop: Make edit and wait for sync
4. [ ] On iPhone: Make different edit
5. [ ] Verify: Both edits sync
6. [ ] Verify: Latest edit wins (or both preserved if different fields)

**Expected**: Concurrent edits handled gracefully

---

### Test 39: Invalid Data Handling
**Purpose**: Verify app handles invalid data gracefully

**Steps**:
1. [ ] Go to More → Sync Testing section
2. [ ] Click "Add Invalid Note ID"
3. [ ] Click "Sync Now"
4. [ ] Verify: Error handled gracefully (toast shown)
5. [ ] Verify: App doesn't crash
6. [ ] Verify: Invalid item stays in queue for retry
7. [ ] Verify: Other operations still work

**Expected**: Invalid data doesn't crash app, errors handled

---

### Test 40: Empty States
**Purpose**: Verify empty states display correctly

**Steps**:
1. [ ] Delete all notes
2. [ ] Go to "All Notes" → Verify: Empty state message
3. [ ] Create new notebook → Verify: Empty notebook handled
4. [ ] Go to Trash (empty) → Verify: Empty state message
5. [ ] Search with no results → Verify: "No results" message

**Expected**: All empty states have appropriate messages

---

## Performance Tests

### Test 41: Load Time
**Purpose**: Verify app loads quickly

**Steps**:
1. [ ] Clear browser cache
2. [ ] Open app → Measure load time
3. [ ] Verify: Initial load < 3 seconds
4. [ ] Navigate between pages → Verify: Fast navigation
5. [ ] Open note → Verify: Note loads quickly

**Expected**: App loads and navigates quickly

---

### Test 42: Memory Usage
**Purpose**: Verify app doesn't leak memory

**Steps**:
1. [ ] Open DevTools → Memory tab
2. [ ] Take heap snapshot
3. [ ] Navigate between pages multiple times
4. [ ] Open/close notes multiple times
5. [ ] Take another heap snapshot
6. [ ] Verify: Memory doesn't continuously increase

**Expected**: No memory leaks

---

### Test 43: Sync Performance
**Purpose**: Verify sync doesn't block UI

**Steps**:
1. [ ] Open note editor
2. [ ] Type content
3. [ ] Verify: Typing is smooth (no lag)
4. [ ] Verify: Sync happens in background
5. [ ] Verify: UI remains responsive during sync
6. [ ] Test with multiple pending items
7. [ ] Verify: UI still responsive

**Expected**: Sync doesn't block UI, typing smooth

---

## Firebase Verification

### How to Verify in Firebase Console

**Step 1: Open Firebase Console**
1. Go to https://console.firebase.google.com
2. Select your project
3. Click "Firestore Database" in left sidebar

**Step 2: Verify Notes Collection**
1. Click on `notes` collection
2. Find note by ID (from console logs)
3. Check these fields:
   - `content`: Should match note content
   - `contentPlain`: Should be plain text version
   - `title`: Should match note title
   - `updatedAt`: Should be recent timestamp
   - `notebookId`: Should be correct
   - `userId`: Should be your user ID
   - `tabId`: Should be correct

**Step 3: Verify Notebooks Collection**
1. Click on `notebooks` collection
2. Verify: Your notebooks exist
3. Check: `name`, `slug`, `userId` are correct

**Step 4: Verify Tabs Collection**
1. Click on `tabs` collection
2. Verify: Tabs exist for your notebooks
3. Check: `notebookId` matches, `isStaple` correct

**Step 5: Verify User Preferences**
1. Click on `userPreferences` collection
2. Verify: Your preferences exist
3. Check: `currentNotebookId`, `theme` are correct

---

## Testing Checklist Summary

### Critical Tests (Must Pass)
- [ ] User authentication and persistence
- [ ] Note creation, editing, deletion
- [ ] Automatic sync to Firebase
- [ ] Offline sync and queue
- [ ] Rich text formatting
- [ ] Mobile toolbar behavior
- [ ] Theme switching
- [ ] Cross-device sync

### Important Tests (Should Pass)
- [ ] Notebook isolation
- [ ] Tab navigation
- [ ] Share functionality
- [ ] Trash and recovery
- [ ] Search functionality
- [ ] Error handling

### Nice-to-Have Tests (Optional)
- [ ] Large content handling
- [ ] Rapid edits debouncing
- [ ] Performance metrics
- [ ] Memory leak testing

---

## Testing Notes

- **Console Logs**: Keep DevTools console open to monitor sync operations
- **Firebase Console**: Keep open in separate tab for verification
- **Test Data**: Use unique identifiers (your name, timestamp) to track test data
- **Cleanup**: Delete test data after testing (More → Delete All Notes)
- **Mobile Testing**: Test on actual iPhone for best results

---

## Known Issues (Fixed)

- ✅ Dark mode toolbar visibility - Fixed (uses theme variables)
- ✅ Mobile toolbar wrapping - Fixed (flex-nowrap)
- ✅ Bottom nav text wrapping - Fixed (shortened labels)
- ✅ Auth persistence - Fixed (browserLocalPersistence)
- ✅ Infinite loop - Fixed (uncontrolled editor, proper debouncing)

---

## Production Readiness

**Ready for Production IF**:
- ✅ All critical tests pass
- ✅ Mobile experience works well
- ✅ Sync system reliable
- ✅ No data loss scenarios
- ✅ Error handling graceful

**Before Going Live**:
1. Complete all critical tests
2. Test on actual iPhone
3. Clean up test data
4. Verify Firebase security rules
5. Check Vercel deployment

---

**Last Updated**: After dark mode toolbar fix
**Status**: Comprehensive testing guide ready for use

