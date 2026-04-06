# 🚨 Fix: 403 Forbidden Error on Upload

## Problem

You're getting:
```
PUT https://s3api.nationalcancercenter.click/storage/v1/s3/.../file.pdf 403 (Forbidden)
```

## Root Cause

You're **still using the S3-Compatible API** (old method with signature issues).

You need to use the **NEW Supabase Storage REST API** (no signature needed)!

---

## ✅ Quick Fix (Easiest Method)

### Option 1: Run SQL Script

Run this in your **MAIN** Supabase SQL Editor:

**File:** `database/check_storage_settings.sql`

This will:
1. Show current settings
2. Clear S3 settings
3. Set Supabase Storage settings
4. Verify the update

### Option 2: Update Via UI (After Deploy)

1. **Wait for Netlify deploy** to finish
2. **Refresh your app** (Ctrl+F5)
3. **Go to Settings**
4. **Clear all S3 settings** (the gray section - make all fields empty)
5. **Fill in Supabase Storage** (the green section):
   ```
   Storage URL:    https://YOUR-SUBDOMAIN.supabase.co  (or your Cloudflare tunnel URL)
   Bucket Name:    patient_files
   Anon Key:       sb_publishable_... (get from your Supabase dashboard)
   Service Key:    sb_secret_... (get from your Supabase dashboard)
   ```
6. **Click "Save Supabase Storage Settings"**
7. **Refresh page** and try uploading

---

## 🔍 Why This Works

### OLD Method (S3-Compatible API) ❌
```
URL: /storage/v1/s3/...
Uses: AWS Signature V4
Problem: Signature doesn't match Supabase's expectations
Result: 403 Forbidden
```

### NEW Method (Supabase Storage REST API) ✅
```
URL: /storage/v1/object/...
Uses: Bearer token authentication
No signature calculation needed!
Result: Works perfectly!
```

---

## 📊 Storage Priority

The app now checks in order:

1. **Supabase Storage REST API** ← Use this! (no signature)
2. **S3-Compatible API** ← Don't use (signature issues)
3. **Default Supabase Storage** ← Fallback

**You want #1!**

---

## 🧪 Testing After Fix

1. Open browser console (F12)
2. Try uploading a file
3. Check the Network tab:
   - ✅ Should see: `/storage/v1/object/patient_files/...` (POST request)
   - ❌ Should NOT see: `/storage/v1/s3/...` (PUT request with signing)

---

**Status:** SQL script ready ✅  
**Action:** Run `check_storage_settings.sql` in your main Supabase!
