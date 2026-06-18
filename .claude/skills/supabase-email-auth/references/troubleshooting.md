# Troubleshooting Guide

Common issues and solutions when implementing Supabase email authentication.

## PKCE Flow Errors

### Error: "code_verifier not found"

**Cause:** PKCE code verifier wasn't stored properly in cookies during OAuth initiation.

**Solutions:**
1. Ensure using `@supabase/ssr` package (not `@supabase/auth-helpers`)
2. Use `createBrowserClient` for client-side auth
3. Verify callback route uses `createServerClient` with proper cookie handlers
4. Check browser cookies are enabled
5. Clear browser cookies and try again

```typescript
// Correct client setup
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Error: "Invalid PKCE code"

**Cause:** Code verifier doesn't match the code challenge.

**Solutions:**
1. Check redirect URLs match exactly in Supabase dashboard
2. Ensure no middleware is stripping cookies
3. Verify HTTPS in production (cookies may not work on HTTP)
4. Check `sameSite` cookie settings

## Cookie Issues

### Error: "Cookies can only be modified in a Server Action or Route Handler"

**Cause:** Trying to use `createServerClient` in a Client Component.

**Solutions:**
1. Add `'use client'` directive and use `createBrowserClient` instead
2. Move server-side auth checks to Server Components
3. Use API routes for server-side operations

```typescript
// Client Component - CORRECT
'use client';
import { createBrowserClient } from '@supabase/ssr';

// Server Component - CORRECT
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
```

### Cookies Not Persisting

**Cause:** Browser settings, HTTPS requirement, or incorrect configuration.

**Solutions:**
1. Enable cookies in browser settings
2. Use HTTPS in production (required for secure cookies)
3. Check `sameSite` and `secure` cookie attributes
4. Verify no ad blockers or privacy extensions blocking cookies

## Session Issues

### Session Lost on Page Refresh

**Cause:** Session not properly stored or middleware not refreshing tokens.

**Solutions:**
1. Verify callback route exchanges code properly
2. Check cookies are being set correctly
3. Add middleware to refresh sessions (see middleware template)
4. Ensure `@supabase/ssr` is latest version

```typescript
// middleware.ts example
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getSession(); // Refreshes session

  return response;
}
```

### "User not found" After Login

**Cause:** Session exists but `getUser()` returns null.

**Solutions:**
1. Use `getUser()` instead of `getSession()` (more reliable)
2. Check Supabase project is active
3. Verify JWT secret hasn't changed
4. Try signing out and back in

## Admin Access Issues

### Admin Not Recognized

**Cause:** Email not in whitelist or database role check failing.

**Solutions:**
1. Check `ADMIN_EMAILS` environment variable format
2. Verify exact email match (case-sensitive)
3. Ensure no extra spaces in email list
4. Check `app_users` table exists if using database roles

```env
# Correct format
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Wrong format (spaces will cause issues)
ADMIN_EMAILS=admin1@example.com, admin2@example.com
```

### isAdmin() Always Returns False

**Cause:** Database query failing or user not in app_users table.

**Solutions:**
1. Check `app_users` table exists
2. Verify RLS policies allow service role access
3. Ensure trigger creates app_users record on signup
4. Check service role key is correct

```typescript
// Debug isAdmin function
export async function isAdmin() {
  const { user } = await getUser();
  console.log('User:', user?.email);

  if (!user) return false;

  // Check email whitelist
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  console.log('Admin emails:', adminEmails);
  console.log('Is in whitelist:', adminEmails.includes(user.email || ''));

  // Check database
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  console.log('Database role:', data?.role);
  console.log('Database error:', error);

  return data?.role === 'admin' && data?.status === 'active';
}
```

## Email Issues

### Password Reset Email Not Sending

**Cause:** Supabase email limits, SMTP not configured, or spam folder.

**Solutions:**
1. Check Supabase email rate limits (free tier has limits)
2. Verify SMTP configured in Supabase dashboard (for production)
3. Check spam/junk folder
4. Use custom SMTP provider (Resend, SendGrid, etc.)
5. Check email template in Supabase dashboard

### Confirmation Email Not Arriving

**Cause:** Email confirmation enabled but emails not sending.

**Solutions:**
1. Disable email confirmation if not needed:
   ```typescript
   signUp({
     email,
     password,
     options: {
       emailRedirectTo: undefined, // Disable confirmation
     },
   });
   ```
2. Configure custom SMTP
3. Check Supabase logs for email errors
4. Verify email template is correct

## Authentication Errors

### "Invalid login credentials"

**Cause:** Wrong email/password or user doesn't exist.

**Solutions:**
1. Verify email is correctly typed
2. Check password is correct (at least 6 characters)
3. Ensure user has registered
4. Check user hasn't been deleted from Supabase dashboard

### "Email not confirmed"

**Cause:** Email confirmation required but user hasn't confirmed.

**Solutions:**
1. Disable email confirmation in Supabase Auth settings
2. Manually confirm user in Supabase dashboard
3. Resend confirmation email
4. Set `email_confirm: true` when creating user via admin

```typescript
// Auto-confirm when creating user as admin
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // Auto-confirm
});
```

## Redirect Issues

### Infinite Redirect Loop

**Cause:** Middleware or auth check causing loops.

**Solutions:**
1. Exclude auth pages from middleware protection
2. Check for redirect loops in login/callback logic
3. Verify session exists before redirecting

```typescript
// middleware.ts - Exclude auth pages
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|auth).*)'],
};
```

### Wrong Redirect After Login

**Cause:** Hardcoded redirect or missing redirect parameter.

**Solutions:**
1. Pass redirect parameter: `/login?redirect=/protected-page`
2. Check for redirect param in login logic
3. Default to appropriate page based on user role

## Environment Variable Issues

### "Invalid API key"

**Cause:** Wrong or missing Supabase keys.

**Solutions:**
1. Verify keys copied correctly from Supabase dashboard
2. Check `.env.local` file exists and is loaded
3. Restart Next.js dev server after adding env vars
4. Ensure using `NEXT_PUBLIC_` prefix for public vars

### Environment Variables Not Loading

**Cause:** Next.js not loading .env.local.

**Solutions:**
1. Restart dev server
2. Check `.env.local` is in root directory
3. Verify no syntax errors in .env file
4. For production, add to hosting platform's env vars

## Database Issues

### "relation app_users does not exist"

**Cause:** Database table not created.

**Solutions:**
1. Run migration to create `app_users` table
2. Check schema in Supabase dashboard
3. Verify using correct database (not pulling from wrong project)

### RLS Policy Errors

**Cause:** Row Level Security blocking access.

**Solutions:**
1. Use `supabaseAdmin` to bypass RLS for admin operations
2. Check RLS policies in Supabase dashboard
3. Temporarily disable RLS for testing (re-enable after!)
4. Verify service role key is being used

## Build/Deployment Issues

### Build Fails with "Module not found"

**Cause:** Missing dependencies or imports.

**Solutions:**
1. Run `npm install` or `yarn install`
2. Check all imports are correct
3. Verify `@supabase/ssr` is in dependencies
4. Clear `.next` folder and rebuild

### Works in Dev, Fails in Production

**Cause:** Environment variables not set in production.

**Solutions:**
1. Add all env vars to hosting platform (Vercel, Netlify, etc.)
2. Ensure `NEXT_PUBLIC_` prefix for client-accessible vars
3. Redeploy after adding environment variables
4. Check logs for specific errors

## Getting Help

If issues persist:

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard > Logs
   - Filter by Auth logs
   - Look for error messages

2. **Enable Debug Logging:**
   ```typescript
   // Add to auth functions
   console.log('Debug info:', { user, error, data });
   ```

3. **Check Browser Console:**
   - Open DevTools > Console
   - Look for JavaScript errors
   - Check Network tab for failed requests

4. **Supabase Resources:**
   - Documentation: https://supabase.com/docs/guides/auth
   - Discord: https://discord.supabase.com
   - GitHub Issues: https://github.com/supabase/supabase/issues

5. **Next.js Resources:**
   - Next.js Auth Docs: https://nextjs.org/docs/app/building-your-application/authentication
   - Next.js Discord: https://nextjs.org/discord
