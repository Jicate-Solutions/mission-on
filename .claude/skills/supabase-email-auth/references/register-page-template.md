# Registration Page Template

File: `app/register/page.tsx`

Full-featured registration page with validation, success screen, and auto-redirect.

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, AlertCircle, CheckCircle, Loader2, Mail, Lock, User } from 'lucide-react';
import { signUpWithPassword, getUser } from '@/lib/auth/client';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if already logged in
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { user } = await getUser();
    if (user) {
      router.push('/dashboard');
    }
  };

  // Auto-redirect after successful registration
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push('/login');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validation
    if (!email || !password || !fullName) {
      setMessage({
        type: 'error',
        text: 'Please fill in all required fields',
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

    if (password !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match',
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid email address',
      });
      return;
    }

    setLoading(true);
    setMessage({
      type: 'info',
      text: 'Creating your account...',
    });

    try {
      console.log('Starting registration...');
      const { data, error } = await signUpWithPassword(email, password, fullName);

      if (error) {
        console.error('Registration error:', error);

        // Handle specific error messages
        let errorMessage = error.message;
        if (error.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        }

        setMessage({
          type: 'error',
          text: errorMessage,
        });
        setLoading(false);
        return;
      }

      console.log('✅ Registration successful');
      setMessage({
        type: 'success',
        text: 'Account created successfully! Redirecting to login...',
      });
      setSuccess(true);

    } catch (error: any) {
      console.error('Unexpected registration error:', error);
      setMessage({
        type: 'error',
        text: `Error: ${error.message || 'An unexpected error occurred'}`,
      });
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
              <CheckCircle size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Registration Complete!</h1>
            <p className="text-purple-200 mb-2">
              Your account has been created successfully.
            </p>
            <p className="text-purple-300 text-sm">
              Redirecting to login page in 3 seconds...
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="text-purple-300 hover:text-purple-100 font-semibold underline"
              >
                Click here if not redirected automatically
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Registration Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
              <UserPlus size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-purple-200">Join us today</p>
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
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Input */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-purple-200 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300" size={20} />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                Email Address *
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
                Password * (min. 6 characters)
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

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-purple-200 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300" size={20} />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-8 py-3 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed shadow-lg disabled:opacity-50 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus size={20} />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-purple-200 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-purple-300 hover:text-purple-100 font-semibold underline">
                Sign in here
              </Link>
            </p>
          </div>

          {/* Info Text */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-purple-200 text-sm text-center">
              By creating an account, you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Validation Rules

- **Full Name:** Required, any text
- **Email:** Required, valid email format
- **Password:** Required, minimum 6 characters
- **Confirm Password:** Must match password exactly

## Customization Options

### Add Terms & Conditions Checkbox

```typescript
const [acceptTerms, setAcceptTerms] = useState(false);

// Add to validation
if (!acceptTerms) {
  setMessage({ type: 'error', text: 'Please accept the terms and conditions' });
  return;
}

// Add to JSX before submit button
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="terms"
    checked={acceptTerms}
    onChange={(e) => setAcceptTerms(e.target.checked)}
    className="rounded border-white/20"
  />
  <label htmlFor="terms" className="text-sm text-purple-200">
    I accept the{' '}
    <Link href="/terms" className="text-purple-300 underline">
      Terms & Conditions
    </Link>
  </label>
</div>
```

### Add Password Strength Indicator

```typescript
const getPasswordStrength = (password: string) => {
  if (password.length < 6) return { strength: 'weak', color: 'red' };
  if (password.length < 10) return { strength: 'medium', color: 'yellow' };
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) {
    return { strength: 'strong', color: 'green' };
  }
  return { strength: 'medium', color: 'yellow' };
};

// Add under password input
{password && (
  <div className="mt-2">
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            getPasswordStrength(password).color === 'green'
              ? 'bg-green-500 w-full'
              : getPasswordStrength(password).color === 'yellow'
              ? 'bg-yellow-500 w-2/3'
              : 'bg-red-500 w-1/3'
          }`}
        />
      </div>
      <span className="text-xs text-purple-200">
        {getPasswordStrength(password).strength}
      </span>
    </div>
  </div>
)}
```

### Email Verification Required

If you enable email verification in Supabase:

```typescript
// Update success message
<p className="text-purple-200 mb-2">
  Please check your email to verify your account before signing in.
</p>
```

## Important Notes

- Auto-redirects if already logged in
- Success screen shows for 3 seconds before redirect
- All validation happens client-side first
- Server-side validation by Supabase
- Loading states prevent double submission
