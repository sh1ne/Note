# Vercel Black Screen Fix

## Problem
Black screen on https://note-three-delta.vercel.app/ - This is because Firebase environment variables are missing.

## Solution: Add Environment Variables to Vercel

### Step 1: Get Your Firebase Config
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon → Project Settings
4. Scroll to "Your apps" section
5. Find your web app (or click `</>` to add one)
6. Copy these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### Step 2: Add to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project: "note"
3. Go to **Settings** tab
4. Click **Environment Variables** in left sidebar
5. Add these 6 variables (one at a time):

   **Variable 1:**
   - Name: `NEXT_PUBLIC_FIREBASE_API_KEY`
   - Value: (paste your apiKey)
   - Environment: Select all (Production, Preview, Development)
   - Click "Save"

   **Variable 2:**
   - Name: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - Value: (paste your authDomain)
   - Environment: Select all
   - Click "Save"

   **Variable 3:**
   - Name: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - Value: (paste your projectId)
   - Environment: Select all
   - Click "Save"

   **Variable 4:**
   - Name: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - Value: (paste your storageBucket)
   - Environment: Select all
   - Click "Save"

   **Variable 5:**
   - Name: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - Value: (paste your messagingSenderId)
   - Environment: Select all
   - Click "Save"

   **Variable 6:**
   - Name: `NEXT_PUBLIC_FIREBASE_APP_ID`
   - Value: (paste your appId)
   - Environment: Select all
   - Click "Save"

### Step 3: Redeploy
1. After adding all 6 variables, go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete (~2 minutes)
5. Visit https://note-three-delta.vercel.app/ again

### Step 4: Verify
- Should see login/signup page (not black screen)
- Can sign up/login
- App should work normally

---

## Quick Checklist

- [ ] Added `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] Added `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] Added `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] Added `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] Added `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] Added `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] All variables set for Production, Preview, Development
- [ ] Redeployed after adding variables
- [ ] App loads (not black screen)

---

## Alternative: Check Your Local .env.local

If you have a `.env.local` file locally, you can copy those values:
1. Open `.env.local` in your project
2. Copy each value
3. Paste into Vercel Environment Variables

**Note**: `.env.local` is in `.gitignore` (not in GitHub), so you need to manually add to Vercel.

