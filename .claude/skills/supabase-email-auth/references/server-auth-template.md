# Server Authentication Template

File: `lib/auth/server.ts`

This file contains server-side authentication utilities for Server Components, API Routes, and Server Actions.

```typescript
// Server-side auth utilities
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

// Check if user is admin
export async function isAdmin() {
  const { user } = await getUser();

  if (!user) {
    return false;
  }

  // First, check email whitelist for backward compatibility
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  if (adminEmails.includes(user.email || '')) {
    return true;
  }

  // Then check app_users table for role = 'admin'
  // Use supabaseAdmin to bypass RLS policies
  try {
    const { data: appUser, error } = await supabaseAdmin
      .from('app_users')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (error || !appUser) {
      return false;
    }

    // User must have admin role and be active
    return appUser.role === 'admin' && appUser.status === 'active';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

// Middleware helper for protecting routes
export async function requireAuth(request: NextRequest) {
  const { user } = await getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return null;
}

// Middleware helper for requiring admin role
export async function requireAdmin(request: NextRequest) {
  const { user } = await getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const admin = await isAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }

  return null;
}
```

## Usage Examples

### Protect Server Component
```typescript
// app/protected-page/page.tsx
import { getUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const { user } = await getUser();

  if (!user) {
    redirect('/login');
  }

  return <div>Welcome {user.email}</div>;
}
```

### Admin-Only Server Component
```typescript
// app/admin-panel/page.tsx
import { getUser, isAdmin } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function AdminPanel() {
  const { user } = await getUser();

  if (!user) {
    redirect('/login');
  }

  const admin = await isAdmin();

  if (!admin) {
    redirect('/access-denied');
  }

  return <div>Admin Panel</div>;
}
```

### Protect API Route
```typescript
// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, isAdmin } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const { user } = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isAdmin();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
  }

  // Admin logic here
  return NextResponse.json({ users: [] });
}
```

### Server Action with Auth
```typescript
// app/actions/update-profile.ts
'use server';

import { getUser } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  const { user } = await getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name');

  // Update profile logic here

  revalidatePath('/profile');
  return { success: true };
}
```

## Important Notes

- **Server-side only:** Use these functions in Server Components, API Routes, or Server Actions
- **Never in Client Components:** Will cause cookie errors
- **Admin checking:** Uses both email whitelist and database roles
- **Error handling:** Always check for null user
- **RLS bypass:** Admin client bypasses Row Level Security for role checks
