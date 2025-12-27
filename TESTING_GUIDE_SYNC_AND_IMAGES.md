# Testing Guide: Sync Queue & Image Extraction

## 1. Testing Sync Queue Processing

### What We're Testing
The sync queue logic fix ensures that when a note is deleted from Firestore, the sync queue correctly identifies it and removes the stale item instead of retrying forever.

### Test Scenario 1: Deleted Note in Sync Queue

**Steps:**
1. **Create a note while offline:**
   - Turn off your internet connection (or use browser DevTools → Network → Offline)
   - Create a new note and type some content
   - Wait a few seconds (the note should save locally)
   - You should see "pending" count increase in the UI

2. **Delete the note while still offline:**
   - Delete the note you just created
   - The note is now deleted locally, but there's still a pending sync item in the queue

3. **Go back online:**
   - Turn internet back on
   - The sync queue should try to sync the deleted note
   - **Expected behavior:** The sync queue should detect that the note doesn't exist in Firestore and remove it from the queue (not retry forever)
   - Check browser console for: `[Sync Queue] ⚠️ Note does not exist, removing from queue: [noteId]`
   - The "pending" count should decrease

4. **Verify in browser console:**
   - Open DevTools → Console
   - Look for sync queue messages
   - Should see: "Note does not exist, removing from queue" (not endless retries)

### Test Scenario 2: Normal Sync Queue Processing

**Steps:**
1. **Create a note while offline:**
   - Turn off internet
   - Create/edit a note
   - Wait for local save

2. **Go back online:**
   - Turn internet back on
   - **Expected behavior:** Note should sync successfully
   - Check console for: `[Sync Queue] ✅ Successfully synced note: [noteId]`
   - "pending" count should decrease

### How to Verify It's Working

**Browser Console Messages:**
- ✅ Success: `[Sync Queue] ✅ Successfully synced note: [noteId]`
- ⚠️ Stale item removed: `[Sync Queue] ⚠️ Note does not exist, removing from queue: [noteId]`
- ❌ Error (should retry): `[Sync Queue] ❌ Error syncing note [noteId]: [error]`

**UI Indicators:**
- "X pending" count should decrease when items are processed
- Should not see endless "pending" items that never clear

### What the Fix Changed

**Before (buggy):**
```typescript
if (error?.message?.includes('does not exist in Firestore') || 
    error?.message?.includes('Note') && error?.message?.includes('does not exist'))
// This was evaluated incorrectly due to operator precedence
```

**After (fixed):**
```typescript
if (error?.message?.includes('does not exist in Firestore') || 
    (error?.message?.includes('Note') && error?.message?.includes('does not exist')))
// Now correctly checks: (A) OR (B AND C)
```

---

## 2. Testing Image Extraction

### What We're Testing
After consolidating image extraction logic, we need to verify that:
- Images are correctly extracted from HTML content
- Images are saved to the `images` array in notes
- Images persist across devices
- Images show up in note lists

### Test Scenario 1: Upload Image and Verify Extraction

**Steps:**
1. **Upload an image:**
   - Open a note
   - Click the image icon (top toolbar)
   - Select an image from your device
   - Choose a size (Small/Medium/Large)
   - Image should appear in the note

2. **Verify image is saved:**
   - Wait a few seconds for auto-save
   - Check browser console for save messages
   - **Expected:** Image URL should be in the note's `images` array

3. **Switch notes and come back:**
   - Navigate to another note
   - Navigate back to the note with the image
   - **Expected:** Image should still be there

4. **Check on another device:**
   - Open the same note on your phone (or another browser)
   - **Expected:** Image should appear

### Test Scenario 2: Image in Note List

**Steps:**
1. **Create a note with an image:**
   - Upload an image to a note
   - Save the note

2. **Go to "All Notes" page:**
   - Navigate to the notebook's "All Notes" view
   - **Expected:** The note should show a thumbnail of the image

3. **Verify image array is populated:**
   - The note list should display up to 3 image thumbnails per note
   - **Expected:** Images should be visible in the list

### Test Scenario 3: Image Persistence After Tab Switch

**Steps:**
1. **Upload an image:**
   - Add an image to a note
   - Wait for save to complete

2. **Switch tabs immediately:**
   - Quickly switch to another tab (e.g., from "Scratch" to "Now")
   - **Expected:** Image should persist (this was a previous bug we fixed)

3. **Refresh the page:**
   - Refresh the browser
   - Navigate back to the note
   - **Expected:** Image should still be there

### Test Scenario 4: Multiple Images

**Steps:**
1. **Add multiple images:**
   - Add 2-3 images to the same note
   - Save the note

2. **Verify all images are extracted:**
   - Check that all images appear in the note
   - Check that all image URLs are in the `images` array
   - **Expected:** All images should be saved and displayed

### How to Verify It's Working

**Browser DevTools:**
1. Open DevTools → Application → IndexedDB → notes-db → notes
2. Find your note
3. Check the `images` array - should contain Firebase Storage URLs
4. Check the `content` HTML - should contain `<img>` tags with the same URLs

**Network Tab:**
- When loading a note, you should see requests to Firebase Storage for images
- Images should load successfully

**Console:**
- Should see image upload messages
- Should see save messages with image URLs

### What the Fix Changed

**Before (duplicated code):**
- Image extraction logic was in both `firestore.ts` and `imageHelpers.ts`
- Two different regex patterns doing the same thing

**After (consolidated):**
- Single `extractImageUrls()` function in `imageHelpers.ts`
- Used everywhere: `firestore.ts`, `useNote.ts`, etc.
- Consistent behavior across the app

### Edge Cases to Test

1. **Note with no images:**
   - Create a text-only note
   - **Expected:** `images` array should be empty `[]`

2. **Note with deleted image:**
   - Upload an image
   - Delete the image from Firebase Storage manually
   - **Expected:** Note should still load (graceful degradation)

3. **Very large image:**
   - Upload a large image file
   - **Expected:** Should be compressed and uploaded successfully

4. **Image in HTML from external source:**
   - If you paste HTML with external image URLs
   - **Expected:** Only Firebase Storage URLs should be in the `images` array (data URLs and blob URLs are excluded)

---

## Quick Test Checklist

### Sync Queue
- [ ] Create note offline → goes to sync queue
- [ ] Delete note while offline → queue item becomes stale
- [ ] Go online → stale item is removed (not retried forever)
- [ ] Normal sync works → note syncs successfully
- [ ] Console shows correct messages

### Image Extraction
- [ ] Upload image → appears in note
- [ ] Image persists after tab switch
- [ ] Image persists after page refresh
- [ ] Image appears on other devices
- [ ] Image shows in note list thumbnails
- [ ] Multiple images work correctly
- [ ] `images` array is populated correctly

---

## Troubleshooting

### Sync Queue Not Working
- Check browser console for error messages
- Verify you're actually offline (check Network tab)
- Check IndexedDB → syncQueue store for pending items
- Look for `[Sync Queue]` messages in console

### Images Not Appearing
- Check browser console for upload errors
- Verify Firebase Storage permissions
- Check Network tab for failed image requests
- Verify `images` array in IndexedDB is populated
- Check that image URLs are valid Firebase Storage URLs

