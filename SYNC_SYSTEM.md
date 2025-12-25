# Sync System Breakdown

## Overview
Your notes app uses a **two-tier saving system** with automatic cloud synchronization to Firebase Firestore.

---

## What Gets Synced

### ✅ Synced to Cloud (Firebase Firestore):
1. **Notes** - All note data:
   - Title
   - Content (HTML from editor)
   - ContentPlain (for search)
   - Updated timestamp
   - Notebook ID, Tab ID, User ID

2. **Notebooks** - Created/updated immediately:
   - Name, slug
   - Default status
   - Created/updated timestamps

3. **Tabs** - Created/updated immediately:
   - Name, icon, order
   - Locked/staple status

4. **User Preferences** - Updated immediately:
   - Current notebook ID
   - Theme preference

### ❌ NOT Synced (Local Only):
- Local cache (IndexedDB) - for offline access
- Sync queue - temporary storage for failed syncs
- Browser localStorage - UI preferences (font size, etc.)

---

## How Often Sync Happens

### Automatic Sync Triggers:

1. **Note Content Changes**:
   - **When**: 2.5 seconds after you stop typing
   - **What**: Note content, title, plain text
   - **Method**: Direct to Firestore via `updateNote()`
   - **If fails**: Added to sync queue for retry

2. **Immediate Sync** (force sync):
   - **When**: Switching tabs/notebooks, closing note
   - **What**: Current note content
   - **Method**: Direct to Firestore (no delay)

3. **Sync Queue Processing**:
   - **When**: Every 30 seconds automatically
   - **Also**: When coming back online
   - **Also**: On app startup
   - **What**: Any notes that failed to sync previously
   - **Method**: Processes queue, retries failed syncs

4. **Manual Sync**:
   - **When**: User clicks "Sync Now" button
   - **What**: All pending items in sync queue
   - **Method**: Forces immediate queue processing

---

## Sync Flow Diagram

```
User Types in Note
    ↓
Save to IndexedDB (INSTANT - no network)
    ↓
Wait 2.5 seconds (debounce)
    ↓
Try to sync to Firestore
    ├─ Success → Update "Last synced" timestamp
    └─ Failure → Add to sync queue (IndexedDB)
         ↓
    Queue processed every 30 seconds
    ├─ Success → Remove from queue
    └─ Failure → Keep in queue, retry later
```

---

## Storage Locations

### 1. **IndexedDB (Local Browser Storage)**
- **Purpose**: Offline cache + sync queue
- **Stores**:
  - Local note cache (for fast loading)
  - Sync queue (failed syncs waiting to retry)
- **Persistence**: Survives browser restarts
- **Size**: Limited by browser (usually 50MB+)

### 2. **Firebase Firestore (Cloud)**
- **Purpose**: Primary cloud storage
- **Stores**: All notebooks, tabs, notes
- **Persistence**: Permanent, cross-device
- **Access**: Requires internet connection
- **Security**: User authentication required

---

## Sync Status Indicators

### Status Colors:
- 🟢 **Green**: All changes saved (synced)
- 🟡 **Yellow**: Currently syncing
- 🟠 **Orange**: Items pending in queue
- ⚪ **Gray**: Ready (no sync history yet)

### Status Messages:
- "All changes saved" - Everything synced
- "Syncing... Xs" - Active sync in progress
- "X pending" - Items waiting to sync
- "Ready - will sync when you edit notes" - No changes yet

---

## Error Handling

### What Happens on Sync Failure:
1. Note is added to sync queue (IndexedDB)
2. Error event dispatched (shows in UI)
3. Queue processor retries every 30 seconds
4. Retries continue until successful
5. Manual "Sync Now" button can force retry

### Offline Behavior:
- Notes save locally immediately (never lost)
- Failed syncs queued automatically
- When back online, queue processes automatically
- All queued items sync in order

---

## Verification Steps

To verify sync is working:

1. **Edit a note** → Wait 2.5 seconds → Check "Last synced" updates
2. **Check Firestore console** → Verify note appears in cloud
3. **Go offline** → Edit note → See it queue
4. **Come back online** → See queue process automatically
5. **Use "Sync Now"** → Forces immediate sync of queue

---

## Files Involved

- `hooks/useNote.ts` - Main note saving logic
- `hooks/useSyncQueue.ts` - Queue processing
- `lib/firebase/firestore.ts` - Firestore operations
- `lib/utils/localStorage.ts` - Local storage & queue
- `app/(dashboard)/[notebookSlug]/more/page.tsx` - Sync status UI

---

## Performance Notes

- **Local saves**: Instant (no network delay)
- **Cloud sync**: ~100-500ms (depends on connection)
- **Queue processing**: Non-blocking (doesn't slow UI)
- **Debounce**: Prevents excessive writes (saves Firebase costs)

