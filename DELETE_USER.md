# How to Delete a User Account in Firebase

## Step 1: Go to Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **note-3cc91**

## Step 2: Navigate to Authentication
1. In the left sidebar, click **"Authentication"**
2. Click on the **"Users"** tab (should be selected by default)

## Step 3: Find and Delete Your User
1. You'll see a list of all users
2. Find the user with email: **ryan.krajniak@gmail.com** (or whatever email you used)
3. Click on the **three dots (⋯)** menu on the right side of that user's row
4. Click **"Delete user"**
5. Confirm the deletion

## Step 4: (Optional) Delete Associated Data
If you want to also delete the notebook and notes associated with that account:

1. Go to **"Firestore Database"** → **"Data"** tab
2. You'll see collections: `notebooks`, `tabs`, `notes`, etc.
3. Click on each collection
4. Find documents where `userId` matches the deleted user's UID
5. Click on each document and delete them

**Note**: The user's UID will be shown in the Authentication users list before you delete them. You can copy it if needed.

## After Deletion
Once deleted, you can:
- Sign up again with the same email
- Create a fresh account
- Start with a clean slate

---

**Quick Method**: If you just want to test, you can also create a new account with a different email (like adding +1 to your email: ryan.krajniak+1@gmail.com - Gmail treats this as the same inbox but Firebase sees it as different).

