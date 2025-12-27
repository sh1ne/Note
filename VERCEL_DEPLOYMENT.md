# Vercel Deployment Cache Fix

## Changes Made

1. **`vercel.json`** - Added cache control headers:
   - All pages: `Cache-Control: public, max-age=0, must-revalidate` (forces revalidation)
   - Static assets: `Cache-Control: public, max-age=31536000, immutable` (cached for 1 year)

2. **`next.config.mjs`** - Set `reactStrictMode: false` (was causing issues with TipTap)

3. **`app/layout.tsx`** - Added build timestamp script for cache busting

## How to Verify Deployment Updates

### Method 1: Hard Refresh
- **Desktop**: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Mobile**: Clear browser cache or use incognito/private mode

### Method 2: Check Build Timestamp
Open browser console and check:
```javascript
window.__BUILD_TIMESTAMP__
```

### Method 3: Check Vercel Dashboard
1. Go to your Vercel project dashboard
2. Check the "Deployments" tab
3. Verify the latest deployment shows "Ready" status
4. Check the build logs for any errors

### Method 4: Force Rebuild
If changes still don't appear:
1. Go to Vercel dashboard → Deployments
2. Click "..." on the latest deployment
3. Select "Redeploy"
4. Wait for build to complete

## Common Issues

### Issue: Changes not showing after deployment
**Solution**: 
- Hard refresh the browser (see Method 1)
- Check if Vercel actually rebuilt (check deployment logs)
- Verify you pushed the changes to the correct branch

### Issue: Static assets cached
**Solution**: 
- The `vercel.json` headers should handle this
- Static assets (`/_next/static/`) are cached for 1 year (immutable), which is correct
- HTML pages are set to revalidate immediately

### Issue: Browser still showing old version
**Solution**:
- Clear browser cache completely
- Use incognito/private mode
- Check if you're on the correct URL (not a cached subdomain)

## Testing After Deployment

1. Deploy to Vercel
2. Wait for build to complete
3. Open site in incognito/private window
4. Verify changes are present
5. Check console for `window.__BUILD_TIMESTAMP__` value
6. Compare timestamp with deployment time in Vercel dashboard

