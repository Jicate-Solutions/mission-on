# Supabase Email Authentication Skill

A comprehensive, production-ready skill for implementing Supabase email/password authentication in Next.js 13+ applications with App Router.

## What This Skill Provides

- ✅ Complete authentication flow (signup, login, password reset)
- ✅ Client and server-side utilities
- ✅ Pre-built login and registration pages
- ✅ OAuth callback handling with PKCE flow
- ✅ Admin role-based access control
- ✅ Password reset functionality
- ✅ Middleware for route protection
- ✅ Troubleshooting guide for common errors

## Saves You Time

This skill eliminates the typical **1-hour setup process** by providing:
- Tested, working code templates
- Common error resolutions
- Best practices implementation
- Security considerations built-in

## Files Included

### Core Templates
- **SKILL.md** - Complete implementation guide
- **client-auth-template.md** - Browser-side auth utilities
- **server-auth-template.md** - Server-side auth utilities
- **auth-callback-template.md** - OAuth callback handler
- **supabase-admin-template.md** - Admin client for RLS bypass

### Page Templates
- **login-page-template.md** - Full-featured login page
- **register-page-template.md** - Registration page with validation

### Configuration
- **env-template.md** - Environment variables setup
- **database-schema.md** - Optional role-based auth schema

### Documentation
- **troubleshooting.md** - Solutions to common issues

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install @supabase/ssr @supabase/supabase-js lucide-react
   ```

2. **Set Environment Variables**
   - Copy from `references/env-template.md`
   - Add to `.env.local`

3. **Create Auth Utilities**
   - Copy from `references/client-auth-template.md` → `lib/auth/client.ts`
   - Copy from `references/server-auth-template.md` → `lib/auth/server.ts`
   - Copy from `references/supabase-admin-template.md` → `lib/supabase-admin.ts`

4. **Create Auth Callback**
   - Copy from `references/auth-callback-template.md` → `app/auth/callback/route.ts`

5. **Create Pages**
   - Copy from `references/login-page-template.md` → `app/login/page.tsx`
   - Copy from `references/register-page-template.md` → `app/register/page.tsx`

6. **Configure Supabase Dashboard**
   - Enable Email provider
   - Add redirect URLs
   - Configure email templates (optional)

## Features

### Email/Password Authentication
- User registration with validation
- Login with error handling
- Password reset flow
- Session management

### Admin Access Control
- Email whitelist support
- Database role verification
- Protected routes and API endpoints

### Security
- PKCE flow for OAuth
- Proper cookie handling
- RLS policies support
- Server-side validation

### Developer Experience
- TypeScript support
- Loading states
- Error messages
- Auto-redirects
- Responsive design

## When to Use

Use this skill when you need to:
- Add authentication to a Next.js app
- Implement Supabase email auth
- Fix auth-related errors
- Set up admin panels
- Implement role-based access

## Prerequisites

- Next.js 13+ with App Router
- Supabase project
- Node.js and npm/yarn

## Support

For issues and questions:
- Check `references/troubleshooting.md`
- Supabase Docs: https://supabase.com/docs/guides/auth
- Next.js Docs: https://nextjs.org/docs/app/building-your-application/authentication

## License

Free to use in any project. Based on official Supabase and Next.js documentation patterns.
