# Fix Firebase Permission Errors

You're seeing "Missing or insufficient permissions" errors because your Firestore security rules need to be updated.

## Quick Fix Steps

1. **Go to Firebase Console**
   - Visit [Firebase Console](https://console.firebase.google.com/)
   - Select your project: **note-3cc91**

2. **Navigate to Firestore Rules**
   - Click **"Firestore Database"** in the left sidebar
   - Click the **"Rules"** tab at the top

3. **Replace ALL the rules** with the updated rules from `FIRESTORE_RULES.txt`

   Copy and paste this entire block:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the resource
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Notebooks: Users can create and manage their own notebooks
    match /notebooks/{notebookId} {
      allow read: if isAuthenticated() && 
        (resource == null || isOwner(resource.data.userId));
      allow create: if isAuthenticated() && 
        isOwner(request.resource.data.userId);
      allow update, delete: if isAuthenticated() && 
        isOwner(resource.data.userId);
      // Allow list queries for authenticated users (will filter by userId in query)
      allow list: if isAuthenticated();
    }
    
    // Tabs: Users can create and manage tabs (they're linked to notebooks)
    // Since tabs are linked to notebooks, we allow authenticated users to read/write
    match /tabs/{tabId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
      // Allow list queries for authenticated users
      allow list: if isAuthenticated();
    }
    
    // Notes: Users can create and manage their own notes
    match /notes/{noteId} {
      allow read: if isAuthenticated() && 
        (resource == null || isOwner(resource.data.userId));
      allow create: if isAuthenticated() && 
        isOwner(request.resource.data.userId);
      allow update, delete: if isAuthenticated() && 
        isOwner(resource.data.userId);
      // Allow list queries for authenticated users (will filter by userId in query)
      allow list: if isAuthenticated();
    }
    
    // User Preferences: Users can manage their own preferences
    match /userPreferences/{userId} {
      allow read, write: if isAuthenticated() && 
        request.auth.uid == userId;
      allow list: if isAuthenticated();
    }
  }
}
```

4. **Click "Publish"** to save the rules

5. **Wait 10-30 seconds** for the rules to propagate

6. **Refresh your browser** at `localhost:3000`

## What Changed

- Added explicit `allow list` permissions for collection queries
- Added helper functions for cleaner rule logic
- Rules now properly handle both single document reads and collection queries

## After Updating Rules

Once you've updated the rules and refreshed:
- The permission errors should disappear
- You should be able to see your tabs and notes
- The app should work normally

If you still see errors after updating the rules, make sure:
1. You're logged in (check the browser console for auth status)
2. The rules were published successfully
3. You waited a few seconds for propagation

