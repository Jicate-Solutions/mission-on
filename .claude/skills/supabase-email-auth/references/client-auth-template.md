# Client Authentication Template

File: `lib/auth/client.ts`

This file contains client-side authentication utilities for browser-based operations.

```typescript
// Client-side auth utilities - Email/Password Authentication
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Sign in with Google OAuth (Optional)
 */
export async function signInWithGoogle() {
  const supabase = createClient();

  // Get the current origin for redirect
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      // PKCE flow is handled automatically by @supabase/ssr
      // The code_verifier will be stored in cookies
    },
  });

  return { data, error };
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/**
 * Register new user with email and password
 */
export async function signUpWithPassword(email: string, password: string, fullName?: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      // Email confirmation configuration
      // Set to undefined if you don't want email confirmation
      emailRedirectTo: undefined,
    },
  });

  return { data, error };
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const supabase = createClient();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?type=recovery`,
  });

  return { data, error };
}

/**
 * Update password (used in password reset flow)
 */
export async function updatePassword(newPassword: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { data, error };
}

/**
 * Get current user
 */
export async function getUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * Sign out
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}
```

## Usage Examples

### Sign In
```typescript
'use client';
import { signInWithPassword } from '@/lib/auth/client';

const handleLogin = async (email: string, password: string) => {
  const { data, error } = await signInWithPassword(email, password);

  if (error) {
    console.error('Login failed:', error.message);
    return;
  }

  console.log('Logged in:', data.user);
  // Redirect or update UI
};
```

### Sign Up
```typescript
'use client';
import { signUpWithPassword } from '@/lib/auth/client';

const handleRegister = async (email: string, password: string, name: string) => {
  const { data, error } = await signUpWithPassword(email, password, name);

  if (error) {
    console.error('Registration failed:', error.message);
    return;
  }

  console.log('Account created:', data.user);
  // Redirect to login or dashboard
};
```

### Get Current User
```typescript
'use client';
import { getUser } from '@/lib/auth/client';
import { useEffect, useState } from 'react';

export function UserProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const { user, error } = await getUser();
      if (!error && user) {
        setUser(user);
      }
    }
    loadUser();
  }, []);

  return <div>{user?.email}</div>;
}
```

## Important Notes

- **Client-side only:** Use these functions in Client Components (marked with `'use client'`)
- **PKCE flow:** Automatically handled by `@supabase/ssr`
- **Cookie storage:** Sessions stored in cookies automatically
- **Error handling:** Always check for errors in responses
- **Type safety:** Use TypeScript for better error catching
