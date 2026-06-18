# Auth Callback Template

File: `app/auth/callback/route.ts`

This route handles Supabase authentication callbacks including OAuth, magic links, and password reset flows.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * AUTH CALLBACK ROUTE
 *
 * Handles Supabase auth callbacks including:
 * - OAuth logins (Google, etc.) with PKCE flow
 * - Password reset flows (type=recovery)
 * - Magic link logins
 *
 * Uses @supabase/ssr for proper cookie management.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');

  console.log('Auth callback triggered');
  console.log('Type:', type);
  console.log('Code:', code ? 'present' : 'missing');

  // If we have an auth code (OAuth/PKCE flow), exchange it for a session
  if (code) {
    try {
      const cookieStore = await cookies();

      // Create Supabase SSR client with proper cookie handling
      // This is CRITICAL for PKCE flow - the code_verifier is stored in cookies
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set({ name, value, ...options });
              } catch (error) {
                // Handle cookie setting errors in Edge runtime
                console.error('Error setting cookie:', error);
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set({ name, value: '', ...options });
              } catch (error) {
                // Handle cookie removal errors
                console.error('Error removing cookie:', error);
              }
            },
          },
        }
      );

      // Exchange code for session - SSR client automatically retrieves code_verifier from cookies
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('❌ Error exchanging code:', error);
        return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
      }

      console.log('✅ Code exchanged successfully');
      console.log('User:', data.user?.email);

      // Check if password recovery
      if (type === 'recovery') {
        console.log('Password recovery flow - redirecting to update-password');
        return NextResponse.redirect(new URL('/update-password', request.url));
      }

      // Check if user email is authorized for admin access
      const userEmail = data.user?.email || '';
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

      console.log('Checking admin access...');
      console.log('User email:', userEmail);
      console.log('Admin emails:', adminEmails);

      const isAdmin = adminEmails.includes(userEmail);

      if (!isAdmin) {
        console.log('❌ Access denied - user not in admin whitelist');
        // Sign out the user
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
      }

      console.log('✅ Admin access granted - redirecting to admin panel');
      return NextResponse.redirect(new URL('/admin-panel', request.url));

    } catch (error: any) {
      console.error('❌ Code exchange error:', error);
      return NextResponse.redirect(new URL('/login?error=server_error', request.url));
    }
  }

  // No code provided - redirect to login
  console.log('No code found - redirecting to login');
  return NextResponse.redirect(new URL('/login', request.url));
}
```

## Customization Options

### Remove Admin Whitelist Check

If you want to allow all authenticated users (no admin restriction):

```typescript
// Replace the admin check section with:
console.log('✅ User authenticated - redirecting to dashboard');
return NextResponse.redirect(new URL('/dashboard', request.url));
```

### Add Database Role Check

For database-based role verification:

```typescript
// After successful code exchange, check database role
import { supabaseAdmin } from '@/lib/supabase-admin';

const { data: appUser } = await supabaseAdmin
  .from('app_users')
  .select('role, status')
  .eq('id', data.user.id)
  .single();

if (!appUser || appUser.status !== 'active') {
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login?error=inactive_account', request.url));
}

// Redirect based on role
if (appUser.role === 'admin') {
  return NextResponse.redirect(new URL('/admin-panel', request.url));
} else {
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

### Handle Magic Link Login

Magic links use the same callback, no changes needed. They automatically work with this implementation.

### Custom Redirect After Login

To redirect users to their intended page before login:

```typescript
// Check for redirect parameter
const redirectUrl = requestUrl.searchParams.get('redirect');

// After successful authentication
if (redirectUrl) {
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}

// Default redirect
return NextResponse.redirect(new URL('/dashboard', request.url));
```

## Error Codes

The callback uses these error codes in redirect URLs:

- `auth_failed` - Code exchange failed
- `access_denied` - User not in admin whitelist
- `server_error` - Unexpected server error

Handle these in your login page:

```typescript
// In login page
const searchParams = useSearchParams();
const error = searchParams?.get('error');

if (error === 'auth_failed') {
  setMessage({ type: 'error', text: 'Authentication failed. Please try again.' });
} else if (error === 'access_denied') {
  setMessage({ type: 'error', text: 'Access denied. Your email is not authorized.' });
}
```

## Important Notes

- **PKCE Code Verifier:** Automatically retrieved from cookies by `@supabase/ssr`
- **Cookie Handling:** Must use proper cookie handlers for Next.js 13+
- **Error Logging:** Console logs help debug auth issues
- **Security:** Service role key never exposed to client
- **Redirect URLs:** Must match exactly in Supabase dashboard settings
