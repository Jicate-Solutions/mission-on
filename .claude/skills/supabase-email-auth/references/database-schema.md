# Database Schema for Role-Based Auth

This schema is optional but recommended for role-based access control beyond email whitelisting.

## App Users Table

```sql
-- Create app_users table for role-based access
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_app_users_email ON public.app_users(email);
CREATE INDEX idx_app_users_role ON public.app_users(role);
CREATE INDEX idx_app_users_status ON public.app_users(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.app_users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role and status)
CREATE POLICY "Users can update own profile"
  ON public.app_users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT role FROM public.app_users WHERE id = auth.uid()) AND
    status = (SELECT status FROM public.app_users WHERE id = auth.uid())
  );

-- Admins can read all profiles (use service role key to bypass RLS)
-- Admins can update all profiles (use service role key to bypass RLS)
-- Admins can delete users (use service role key to bypass RLS)
```

## Auto-Create Profile on Signup

Create a trigger to automatically create an app_users record when a user signs up:

```sql
-- Function to create app_users record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_users (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user', -- Default role
    'active' -- Default status
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## TypeScript Types

Add these types to your project:

```typescript
// types/database.ts

export type UserRole = 'admin' | 'user' | 'moderator';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: AppUser;
        Insert: Omit<AppUser, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AppUser, 'id' | 'created_at'>>;
      };
    };
  };
}
```

## Usage in Code

### Create User with Role

```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

async function createUserWithRole(
  email: string,
  password: string,
  fullName: string,
  role: 'admin' | 'user' = 'user'
) {
  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError) throw authError;

  // Update role (app_users record created by trigger)
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update({ role })
    .eq('id', authData.user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}
```

### Get User with Role

```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getUserWithRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}
```

### Check User Permissions

```typescript
import { supabaseAdmin } from '@/lib/supabase-admin';

async function hasPermission(userId: string, requiredRole: 'admin' | 'moderator' | 'user') {
  const { data } = await supabaseAdmin
    .from('app_users')
    .select('role, status')
    .eq('id', userId)
    .single();

  if (!data || data.status !== 'active') return false;

  const roleHierarchy = {
    user: 1,
    moderator: 2,
    admin: 3,
  };

  return roleHierarchy[data.role] >= roleHierarchy[requiredRole];
}
```

## Migration Scripts

### Run Migration

Save the SQL above as `supabase/migrations/001_create_app_users.sql` and run:

```bash
# Using Supabase CLI
supabase db push

# Or run in Supabase dashboard SQL editor
```

### Seed Admin User

```sql
-- Seed an admin user (run after user signs up)
UPDATE public.app_users
SET role = 'admin'
WHERE email = 'your-admin@example.com';
```

## Best Practices

1. **Use Service Role Key:** Admin operations should use `supabaseAdmin` client
2. **Validate on Server:** Always check roles server-side, never trust client
3. **RLS Policies:** Users can only modify their own non-role/status fields
4. **Audit Trail:** Consider adding `modified_by` field for admin actions
5. **Soft Delete:** Use `status = 'inactive'` instead of deleting users
