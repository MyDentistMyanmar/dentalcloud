# Fix for Supabase 401 Error with Conversations Table

## Issue
The application was encountering a 401 Unauthorized error when trying to access the conversations table:
```
POST https://ovvpvxajizbnbwmpwtwj.supabase.co/rest/v1/conversations?select=* 401 (Unauthorized)
```

## Root Cause
The issue was caused by complex JOIN queries that were triggering authorization errors even with RLS disabled. The original query was using:
- Inner joins with `patients!inner(name)` and `users!inner(username)`
- Subqueries for counting messages with `messages(count)`

These complex queries may still be subject to some authorization checks in Supabase even when RLS is disabled.

## Solution Applied
Modified the `getConversations` function in `services/api.ts` to:

1. **Simplified the initial query**: Changed from complex joins to simple `select('*')` from conversations table
2. **Separate queries for related data**: Made individual calls to fetch patient names, admin names, and unread message counts
3. **Maintained functionality**: All the same data is still retrieved, just through separate queries

## Specific Changes Made

### In services/api.ts
- Modified `getConversations` function to avoid complex joins
- Added separate queries to fetch patient names from the patients table
- Added separate queries to fetch admin usernames from the users table  
- Added separate queries to count unread messages for each conversation
- Maintained the same return structure for compatibility with existing code

### In services/supabase.ts
- Updated configuration to ensure proper anonymous access using the anon key
- Disabled automatic session management to work with the custom auth system

## Benefits
- Eliminates the 401 unauthorized error
- Maintains all existing functionality
- Makes the code more resilient to authorization issues
- Preserves the same data structure for all consuming components

## Verification
After applying these changes, the application should be able to:
- Access the conversations table without authorization errors
- Display conversation lists with proper patient/admin names
- Show correct unread message counts
- Continue to work with both patient and admin messaging flows