# Environment Variables Template

File: `.env.local`

Create this file in the root of your Next.js project.

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Admin Email Whitelist (Optional)
# Comma-separated list of admin emails
ADMIN_EMAILS=admin@example.com,another.admin@example.com

# Email Configuration (Optional - for custom SMTP)
# If using Supabase default email, these are not needed
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_TO=support@yourdomain.com
```

## How to Get Supabase Keys

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## Security Notes

⚠️ **CRITICAL:**
- **NEVER** commit `.env.local` to version control
- Add `.env.local` to `.gitignore`
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Only use service role key in server-side code

## Environment Variable Scopes

### Public Variables (Safe for Client)
- `NEXT_PUBLIC_SUPABASE_URL` - Can be used in client components
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Can be used in client components

### Private Variables (Server-Only)
- `SUPABASE_SERVICE_ROLE_KEY` - ONLY use in server components/API routes
- `ADMIN_EMAILS` - Server-side only
- `RESEND_API_KEY` - Server-side only

## .gitignore Configuration

Ensure your `.gitignore` includes:

```gitignore
# Environment variables
.env.local
.env.development.local
.env.test.local
.env.production.local
.env
```

## Production Deployment

For production (Vercel, Netlify, etc.):

1. Add environment variables in your hosting platform's dashboard
2. Use the same variable names
3. Ensure `NEXT_PUBLIC_*` variables are properly prefixed
4. Never hardcode keys in your code

### Vercel Example
1. Go to Project Settings > Environment Variables
2. Add each variable
3. Select the appropriate environment (Production, Preview, Development)
4. Redeploy after adding variables

## Validation Script (Optional)

Create `scripts/validate-env.js` to check required variables:

```javascript
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

console.log('✅ All required environment variables are set');
```

Run before build:
```json
{
  "scripts": {
    "prebuild": "node scripts/validate-env.js",
    "build": "next build"
  }
}
```
