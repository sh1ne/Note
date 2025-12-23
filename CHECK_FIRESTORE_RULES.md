# How to Check Your Firestore Security Rules

## Step 1: Go to Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **note-3cc91**

## Step 2: Navigate to Firestore Rules
1. In the left sidebar, click **"Firestore Database"**
2. Click on the **"Rules"** tab at the top

## Step 3: Check Your Current Rules
You should see your security rules in the editor. They should look like this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notebooks/{notebookId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    match /tabs/{tabId} {
      allow read, write: if request.auth != null;
    }
    match /notes/{noteId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    match /userPreferences/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
  }
}
```

## Step 4: Update Rules (If Needed)
Replace your rules with the updated rules from `FIRESTORE_RULES.txt` that allow list queries:

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

## Step 5: Publish Rules
1. Click the **"Publish"** button
2. Wait for confirmation that rules are published

## Important Difference
The key difference is:
- **Old rules**: `allow read, write` - This doesn't work for creating NEW documents
- **New rules**: Separate `allow create` with `request.resource.data.userId` - This allows creating new documents

The `request.resource` refers to the data being written (new document), while `resource.data` refers to existing document data.

