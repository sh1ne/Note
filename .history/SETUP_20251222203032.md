# Setup Guide

## Prerequisites
- Node.js 18+ installed
- Firebase account (free)
- Git installed

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "note-app")
4. Follow the setup wizard
5. Once created, click on the project

### Enable Authentication
1. Go to "Authentication" in the left menu
2. Click "Get started"
3. Enable "Email/Password" provider
4. Click "Save"

### Create Firestore Database
1. Go to "Firestore Database" in the left menu
2. Click "Create database"
3. Start in "test mode" (we'll add security rules later)
4. Choose a location (closest to you)
5. Click "Enable"

### Set Up Storage (Requires Blaze Plan - But Free Tier Available!)
**Important**: Firebase Storage requires the Blaze (pay-as-you-go) plan, BUT it has a generous free tier:
- 5 GB storage
- 1 GB/day downloads
- 20K uploads/day
- 50K deletes/day
- **You won't be charged if you stay within these limits!**

**Steps:**
1. Go to "Storage" in the left menu
2. You'll see a message about upgrading - click "Upgrade project"
3. This will enable billing, but you'll stay on the free tier
4. After upgrading, click "Get started" on the Storage page
5. Start in "test mode" (we'll add security rules)
6. Choose a location (same as Firestore)
7. Click "Done"

**Note**: You can also skip Storage for now if you don't want to enable billing. The app will work, but image uploads won't function until Storage is set up.

### Get Firebase Config
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`)
4. Register app with a nickname (e.g., "Note App Web")
5. Copy the config values

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and fill in your Firebase config values:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_actual_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_actual_app_id
   ```

## Step 4: Set Up Firestore Security Rules

1. Go to Firestore Database → Rules
2. Replace the rules with:
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
3. Click "Publish"

## Step 5: Set Up Storage Rules

1. Go to Storage → Rules
2. Replace the rules with:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /images/{userId}/{allPaths=**} {
         allow read, write: if request.auth != null && 
           request.auth.uid == userId;
       }
     }
   }
   ```
3. Click "Publish"

## Step 6: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 7: Test the App

1. Click "Sign up" to create an account
2. After signing up, you'll be redirected to the dashboard
3. A default notebook with 6 tabs will be created automatically
4. Click the "+" button to create a new note
5. Start typing and your notes will auto-save!

## Next Steps

- Deploy to Vercel (see README.md)
- Add PWA icons (create icon-192.png and icon-512.png in /public)
- Customize themes and styling

## Troubleshooting

**Firebase errors**: Make sure all environment variables are set correctly in `.env.local`

**Authentication errors**: Verify Email/Password is enabled in Firebase Authentication

**Database errors**: Check that Firestore is created and security rules are published

**Storage errors**: 
- If you see "upgrade required" - you need to enable the Blaze plan (free tier available)
- Verify Storage is set up and rules are published
- If you skip Storage, image uploads won't work but the rest of the app will function

