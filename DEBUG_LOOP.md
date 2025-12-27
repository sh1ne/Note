# Debugging Infinite Loop

## Test Steps to Isolate the Problem

1. **Open browser console**
2. **Add breakpoints or console.logs at:**
   - `hooks/useNote.ts` line 158: `handleContentChange` entry
   - `hooks/useNote.ts` line 183: `setNote(updatedNote)`
   - `components/editor/RichTextEditor.tsx` line 91: `onUpdate` callback
   - `components/editor/RichTextEditor.tsx` line 150: `useEffect` watching `content` prop

3. **Test sequence:**
   - Refresh page (should be fine)
   - Click in editor (triggers loop)
   - Check console logs to see the sequence

## Suspected Issues

1. **handleContentChange calls setContent** → changes `content` prop → triggers RichTextEditor useEffect → might trigger onUpdate
2. **updateCache after save** → might update `cachedNote` → but we removed it from dependencies, so shouldn't trigger
3. **setTimeout delay too short** → `isUpdatingFromPropsRef` might reset before onUpdate fires

## Potential Fixes

1. Don't call `setContent` in `handleContentChange` - content is already in editor state
2. Use a ref to track if update is from user input vs props
3. Increase setTimeout delay or use a different mechanism
4. Check if `updateCache` is causing issues even though it's not in dependencies

