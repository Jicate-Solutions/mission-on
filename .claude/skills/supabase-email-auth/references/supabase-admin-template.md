# Supabase Admin Client Template

File: `lib/supabase-admin.ts`

This creates an admin Supabase client that bypasses Row Level Security (RLS) policies. Use only for admin operations that require elevated privileges.

```typescript
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client
 *
 * Uses service role key to bypass RLS policies.
 * ONLY use in server-side code (API routes, server components, server actions).
 * NEVER expose this client to the browser.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

## When to Use Admin Client

Use the admin client when you need to:
- Check user roles from `app_users` table (bypassing RLS)
- Perform admin operations on behalf of users
- Access data that RLS policies would normally restrict
- Manage users, roles, and permissions
- Bulk operations that require elevated access

## Usage Examples

### Check User Role
```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getUserRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('role, status')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }

  return data;
}
```

### Create User Profile
```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function createUserProfile(userId: string, email: string, role: 'admin' | 'user') {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .insert({
      id: userId,
      email: email,
      role: role,
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }

  return data;
}
```

### Update User Status
```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function updateUserStatus(userId: string, status: 'active' | 'inactive') {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update({ status })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user status:', error);
    throw error;
  }

  return data;
}
```

### Bulk User Management
```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getAllUsers() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data;
}
```

### Delete User Account
```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function deleteUserAccount(userId: string) {
  // Delete from auth.users (this will cascade to app_users if configured)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Error deleting user:', error);
    throw error;
  }

  return { success: true };
}
```

## Security Best Practices

⚠️ **CRITICAL SECURITY RULES:**

1. **Server-Side Only**
   - NEVER import this in client components
   - Only use in API routes, server components, or server actions
   - The service role key must NEVER reach the browser

2. **Validate Permissions**
   - Always verify the requesting user is authorized
   - Check admin status before admin operations
   - Log all admin actions for audit trail

3. **Input Validation**
   - Sanitize all inputs before database operations
   - Validate user IDs and emails
   - Use TypeScript types for safety

4. **Error Handling**
   - Never expose internal errors to clients
   - Log detailed errors server-side
   - Return generic error messages to users

## Example: Protected Admin API Route

```typescript
// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, isAdmin } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify authentication
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin status
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Safe to use admin client now
  const body = await request.json();
  const { role, status } = body;

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update({ role, status })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

## Comparison: Regular Client vs Admin Client

### Regular Client (lib/auth/client.ts or lib/auth/server.ts)
- Respects RLS policies
- Users can only access their own data
- Safe for general application use
- Session-based authentication

### Admin Client (lib/supabase-admin.ts)
- Bypasses ALL RLS policies
- Full database access
- Use ONLY for admin operations
- Service role authentication

## Database Schema Requirement

For role-based access, create `app_users` table:

```sql
-- See references/database-schema.md for full schema
CREATE TABLE app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_app_users_role ON app_users(role);
CREATE INDEX idx_app_users_status ON app_users(status);
```

## Troubleshooting

### Error: "Invalid API key"
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify it's the service role key, not anon key
- Ensure environment variable is loaded

### Error: "Row Level Security policy violation"
- You're using regular client instead of admin client
- Check you're importing from `lib/supabase-admin`

### Error: "Failed to fetch"
- Network issue or Supabase URL incorrect
- Check `NEXT_PUBLIC_SUPABASE_URL` is set
- Verify Supabase project is active
