# Note App - Project Context & Current Status

## What This Application Does

This is a **note-taking web application** (similar to Evernote or OneNote) built with:
- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Firebase (Firestore for data, Firebase Auth for authentication, Firebase Storage for images)
- **Offline Storage**: IndexedDB (via idb library)
- **Service Worker**: For asset caching and offline page loading
- **Deployment**: Vercel

### Core Features
1. **Notebooks**: Users can create multiple notebooks to organize notes
2. **Notes**: Rich text notes with formatting, images, and organization
3. **Staple Notes**: Special system notes (Scratch, Now, Short-Term, Long-term) that are always available
4. **Tabs**: Notes can be organized into tabs within notebooks
5. **Offline-First Architecture**: All data is cached locally in IndexedDB for offline access
6. **Sync Queue**: Changes made offline are queued and synced to Firestore when online

## Use Case

The primary use case is **offline-first note-taking**:
- Users need to create, edit, and view notes **without internet connectivity**
- All notes must be accessible offline after initial load
- Changes made offline must sync to the cloud when connectivity is restored
- The app must work seamlessly when switching between online and offline states
- Users should never lose data, even if they close the browser while offline

**Critical Requirements:**
1. App fully loads with network disabled
2. Existing notes are visible with network disabled
3. Creating new notes while offline works
4. Editing existing notes while offline works
5. Closing and reopening browser while offline preserves all notes
6. When network is restored, offline changes sync correctly without data loss or duplication

## Current Architecture

### Authentication Flow
- **Primary Source of Truth**: IndexedDB (`auth` store)
- **Secondary**: Firebase Auth (for verification when online)
- **Migration**: User ID and email migrated from localStorage to IndexedDB on first load
- **Offline Behavior**: When offline, app trusts IndexedDB auth state even if Firebase reports `null`

### Data Persistence
- **IndexedDB Stores**:
  - `notes`: All note data (content, title, images, metadata)
  - `notebooks`: Notebook information
  - `syncQueue`: Pending changes to sync when online
  - `auth`: User authentication state (userId, email, lastVerified)
  - `backups`: Periodic backups of user data

### Sync Queue System
- When offline, changes are saved to IndexedDB immediately
- Changes are also added to `syncQueue` for later sync
- When online, `useSyncQueue` hook processes the queue:
  - For existing notes: Calls `updateNote()` in Firestore
  - For new notes (temp IDs starting with `temp-`): Creates note in Firestore, updates local ID

### Key Files
- `contexts/AuthContext.tsx`: Manages Firebase auth state, uses IndexedDB as fallback
- `app/(dashboard)/layout.tsx`: Dashboard layout that prevents redirects when offline
- `app/(dashboard)/[notebookSlug]/[noteSlug]/page.tsx`: Note editor page, loads from IndexedDB when offline
- `hooks/useSyncQueue.ts`: Processes sync queue when online
- `lib/utils/localStorage.ts`: IndexedDB operations
- `lib/utils/authState.ts`: IndexedDB auth state management
- `lib/firebase/firestore.ts`: Firestore operations with offline fallbacks

## Current Status

### What's Working ✅
1. **App loads offline**: Service Worker caches assets, app shell loads
2. **IndexedDB persistence**: Notes, notebooks, and auth state persist in IndexedDB
3. **Offline note viewing**: Existing notes load from IndexedDB when offline
4. **Offline note creation**: New notes can be created with temporary IDs
5. **Auth state persistence**: IndexedDB stores auth state, prevents false logouts
6. **Sync queue for temp IDs**: Fixed to CREATE new notes instead of UPDATE

### What Keeps Failing ❌

#### Issue #1: Redirect to Login When Navigating Between Notes Offline
**Problem**: When user is on a note page (e.g., `/base/scratch`), goes offline, then clicks another note tab (e.g., "Now"), the app redirects to `/login` instead of navigating to the new note.

**Root Cause**: 
- `DashboardLayout` checks auth state on every route change
- There's a race condition where `hasIndexedDBAuth` might be `null` during navigation
- The redirect logic runs before IndexedDB auth check completes
- Even though we check `isOnDashboardRoute`, timing issues cause redirects

**Attempted Fixes**:
1. Added early return if `hasIndexedDBAuth === null` (still checking)
2. Added check to never redirect on dashboard routes
3. Added offline-specific logic to prevent redirects
4. Made IndexedDB the source of truth for auth

**Current State**: Latest fix adds more defensive checks, but issue may persist if there's a timing issue with async IndexedDB checks.

**Console Logs Show**:
- `[Auth] Initial mount - IndexedDB has state but Firebase user not found yet, waiting for Firebase to verify`
- `[Auth] Firebase says null but IndexedDB has auth state (online) - trusting IndexedDB`
- Multiple `net::ERR_INTERNET_DISCONNECTED` errors
- Sync queue attempts while offline (expected)

#### Issue #2: Sync Queue Errors for Existing Notes When Offline
**Problem**: When offline, the sync queue attempts to sync existing notes (not temp IDs), causing errors:
```
[Firestore] ❌ Error syncing note: {noteId: 'x6AXtu61QAJeurchK9KF', error: 'Failed to get document because the client is offline.', code: 'unavailable'}
```

**Root Cause**: 
- `useSyncQueue` hook processes queue every 30 seconds and on `online` event
- When offline, it should skip processing, but there might be a timing issue
- The check `if (!navigator.onLine) return;` should prevent this, but errors still occur

**Attempted Fixes**:
1. Added `navigator.onLine` check in `processSyncQueue`
2. Added check to skip processing if offline

**Current State**: Should be fixed, but errors in console suggest sync attempts are still happening.

#### Issue #3: Editor Save on Navigation (Unverified)
**Problem**: When editing a note offline and navigating away, changes might not be saved.

**Root Cause**: 
- Unmount `useEffect` calls `saveNote(true)` but might not wait for completion
- Editor's `onChange` has debouncing (3 seconds), so rapid navigation might skip save

**Current State**: Not fully tested with real typing. Programmatic text insertion didn't trigger save properly.

## Technical Challenges

### Challenge 1: Firebase Auth Offline Behavior
Firebase Auth's `onAuthStateChanged` fires `null` when offline, even if user was previously authenticated. We work around this by:
- Storing auth state in IndexedDB
- Trusting IndexedDB when Firebase reports `null` and we're offline
- Only clearing IndexedDB on explicit logout

### Challenge 2: Race Conditions in Auth Checks
Multiple components check auth state:
- `AuthContext`: Initial mount, Firebase callbacks
- `DashboardLayout`: Route protection
- `NoteEditorPage`: Note loading

Timing issues can cause:
- Redirects before IndexedDB check completes
- False logouts when Firebase temporarily reports `null`

### Challenge 3: Service Worker Cache Strategy
Current strategy:
- HTML pages: Cache First with network update
- Falls back to root HTML (`/`) if page not in cache

This works but might cause issues with:
- Stale JavaScript bundles
- Version mismatches in IndexedDB schema

### Challenge 4: IndexedDB Version Management
- Current version: 5 (includes `auth` store)
- Upgrade logic handles incremental migrations
- Version errors can occur if old cached JS tries to open with outdated version

## Testing Approach

### Manual Testing Steps (What User Reports)
1. Hard refresh page (Ctrl+Shift+R)
2. Navigate to Scratch note (`/base/scratch`)
3. Turn network offline (DevTools → Network → Offline)
4. Click "Now" tab
5. **Expected**: Navigate to `/base/now` and show Now note
6. **Actual**: Redirects to `/login`

### Browser Automation Limitations
- Can't fully simulate offline mode (network still accessible)
- Can't test browser restart scenarios
- Can't test real typing in editor (programmatic insertion doesn't trigger all events)

## Next Steps / What Needs Investigation

1. **Fix Redirect Issue**: 
   - Add more logging to understand exact timing of redirect
   - Consider using a ref to track "has been authenticated" state
   - Maybe add a small delay before allowing redirects

2. **Verify Sync Queue Offline Behavior**:
   - Ensure `processSyncQueue` truly skips when offline
   - Add more defensive checks

3. **Test Editor Save**:
   - Test with real typing (not programmatic)
   - Verify unmount save works correctly
   - Consider adding a "saving..." indicator

4. **Improve Error Handling**:
   - Better error messages for users
   - More detailed logging for debugging

## Key Code Locations

- **Auth Check in Layout**: `app/(dashboard)/layout.tsx` lines 39-72
- **Note Loading**: `app/(dashboard)/[notebookSlug]/[noteSlug]/page.tsx` lines 426-677
- **Sync Queue Processing**: `hooks/useSyncQueue.ts` lines 13-81
- **IndexedDB Auth**: `lib/utils/authState.ts`
- **Auth Context**: `contexts/AuthContext.tsx` lines 28-187

## Environment

- **URL**: https://note-three-delta.vercel.app
- **Repository**: Private GitHub repo
- **Deployment**: Automatic via Vercel on push to `main` branch
- **Browser Testing**: Chrome DevTools with Network → Offline simulation

