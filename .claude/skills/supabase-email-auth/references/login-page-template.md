# Login Page Template

File: `app/login/page.tsx`

Full-featured login page with email/password authentication, error handling, and responsive design.

```typescript
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, AlertCircle, CheckCircle, Loader2, Mail, Lock } from 'lucide-react';
import { signInWithPassword, getUser } from '@/lib/auth/client';

// Separate component that uses useSearchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check if already logged in
  useEffect(() => {
    checkAuth();

    // Check for redirect parameter (user tried to access protected page)
    const redirect = searchParams?.get('redirect');
    if (redirect) {
      setMessage({
        type: 'info',
        text: 'Please login to access the requested page.',
      });
    }

    // Check for error messages from URL
    const error = searchParams?.get('error');
    if (error === 'auth_failed') {
      setMessage({
        type: 'error',
        text: 'Authentication failed. Please try again.',
      });
    } else if (error === 'access_denied') {
      setMessage({
        type: 'error',
        text: 'Access denied. Your email is not authorized for admin access.',
      });
    }
  }, [searchParams]);

  const checkAuth = async () => {
    const { user } = await getUser();
    if (user) {
      // Check for redirect parameter first
      const redirectUrl = searchParams?.get('redirect');

      if (redirectUrl) {
        // User is already logged in and trying to access a specific page
        router.push(redirectUrl);
        return;
      }

      // No redirect - check if user is admin
      const authCheckResponse = await fetch('/api/auth/check-admin');
      const authResult = await authCheckResponse.json();

      if (authResult.authorized) {
        // Admin user - redirect to admin panel
        router.push('/admin-panel');
      } else {
        // Regular user - redirect to dashboard
        router.push('/dashboard');
      }
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email || !password) {
      setMessage({
        type: 'error',
        text: 'Please enter both email and password',
      });
      return;
    }

    if (password.length < 6) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 6 characters',
      });
      return;
    }

    setLoading(true);
    setMessage({
      type: 'info',
      text: 'Signing in...',
    });

    try {
      console.log('Starting email sign-in...');
      const { data, error } = await signInWithPassword(email, password);

      if (error) {
        console.error('Email sign-in error:', error);
        setMessage({
          type: 'error',
          text: error.message === 'Invalid login credentials'
            ? 'Invalid email or password'
            : `Failed to sign in: ${error.message}`,
        });
        setLoading(false);
        return;
      }

      console.log('✅ Signed in successfully!');

      // Check for redirect parameter
      const redirectUrl = searchParams?.get('redirect');

      // Check if user is admin or regular user
      const authCheckResponse = await fetch('/api/auth/check-admin');
      const authResult = await authCheckResponse.json();

      if (authResult.authorized && !redirectUrl) {
        console.log('✅ Admin user - redirecting to admin panel');
        setMessage({
          type: 'success',
          text: 'Admin access granted! Redirecting...',
        });

        // Redirect to admin panel
        setTimeout(() => {
          router.push('/admin-panel');
        }, 1000);
      } else if (redirectUrl) {
        console.log('✅ Redirecting to intended page:', redirectUrl);
        setMessage({
          type: 'success',
          text: 'Signed in successfully! Redirecting...',
        });

        // Redirect to the intended page
        setTimeout(() => {
          router.push(redirectUrl);
        }, 1000);
      } else {
        console.log('✅ Regular user - redirecting to dashboard');
        setMessage({
          type: 'success',
          text: 'Signed in successfully! Redirecting to dashboard...',
        });

        // Redirect to dashboard page
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }

    } catch (error: any) {
      console.error('Unexpected email sign-in error:', error);
      setMessage({
        type: 'error',
        text: `Error: ${error.message || 'An unexpected error occurred'}`,
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
              <LogIn size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Login</h1>
            <p className="text-purple-200">Welcome back</p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg mb-6 ${
                message.type === 'success'
                  ? 'bg-green-500/20 text-green-100'
                  : message.type === 'info'
                  ? 'bg-blue-500/20 text-blue-100'
                  : 'bg-red-500/20 text-red-100'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300" size={20} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-8 py-3 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Info Text */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-purple-200 text-sm text-center">
              Sign in with your email and password to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
```

## Customization Options

### Add Google OAuth Button

Uncomment this section in the template (after the header, before email form):

```typescript
import { signInWithGoogle } from '@/lib/auth/client';

// Add to component
const [googleLoading, setGoogleLoading] = useState(false);

const handleGoogleSignIn = async () => {
  setGoogleLoading(true);
  setMessage({ type: 'info', text: 'Redirecting to Google...' });

  const { error } = await signInWithGoogle();

  if (error) {
    setMessage({ type: 'error', text: `Failed to sign in: ${error.message}` });
    setGoogleLoading(false);
  }
};

// Add button in JSX
<button
  onClick={handleGoogleSignIn}
  disabled={loading || googleLoading}
  className="w-full bg-white hover:bg-gray-100 text-gray-900 px-8 py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-3 shadow-lg"
>
  {googleLoading ? 'Redirecting...' : 'Sign in with Google'}
</button>
```

### Add Forgot Password Link

```typescript
import Link from 'next/link';

// Add after password input
<div className="flex justify-end">
  <Link
    href="/forgot-password"
    className="text-sm text-purple-300 hover:text-purple-100 transition-colors"
  >
    Forgot password?
  </Link>
</div>
```

### Add Register Link

```typescript
import Link from 'next/link';

// Add after form
<div className="mt-4 text-center">
  <p className="text-purple-200 text-sm">
    Don't have an account?{' '}
    <Link href="/register" className="text-purple-300 hover:text-purple-100 font-semibold underline">
      Register here
    </Link>
  </p>
</div>
```

### Change Color Theme

Replace purple colors with your brand colors:
- `purple-900` → `your-color-900`
- `purple-600` → `your-color-600`
- etc.

## Required API Route

Create `app/api/auth/check-admin/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth/server';

export async function GET() {
  const admin = await isAdmin();
  return NextResponse.json({ authorized: admin });
}
```

## Important Notes

- Uses Suspense for `useSearchParams` (Next.js 13+ requirement)
- Auto-redirects if already logged in
- Handles redirect parameter for protected pages
- Shows appropriate error messages from callback
- Client-side validation before submission
- Loading states during authentication
