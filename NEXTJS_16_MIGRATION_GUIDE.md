# Next.js 16 Migration Guide

This guide will help you migrate your Ikoniq Kitchens project from Next.js 15.5.2 to Next.js 16.

## Pre-Migration Checklist

- [ ] Ensure all current features are working
- [ ] Create a backup branch
- [ ] Review Next.js 16 release notes
- [ ] Check for breaking changes in dependencies

---

## Migration Steps

### Step 1: Create a Backup

```bash
git add .
git commit -m "Backup before Next.js 16 migration"
git checkout -b nextjs-16-migration
```

### Step 2: Verify Next.js 16 Availability

Before proceeding, check if Next.js 16 is released:

- Visit: https://github.com/vercel/next.js/releases
- Visit: https://nextjs.org/docs

**Note:** As of January 2025, verify the latest stable version. If Next.js 16 is not released, wait for the official release.

### Step 3: Update Next.js and Related Packages

```bash
npm install next@16 eslint-config-next@16
```

If you encounter peer dependency issues, use:

```bash
npm install next@16 eslint-config-next@16 --legacy-peer-deps
```

### Step 4: Check React Compatibility

Next.js 16 may require specific React versions. Your project currently uses React 19.1.0.

```bash
# Check if React update is needed
npm info next@16 peerDependencies

# Update React if required
npm install react@latest react-dom@latest
```

### Step 5: Update Other Dependencies

```bash
# Update Prisma
npm install @prisma/client@latest prisma@latest

# Regenerate Prisma Client
npx prisma generate

# Update other Next.js related packages
npm update
```

### Step 6: Review Configuration Files

#### next.config.mjs

Your current config is minimal. Review the Next.js 16 documentation for any new options or deprecated features:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

**Check for:**
- Turbopack changes (you're using `--turbopack` flag)
- New experimental features
- Deprecated options

#### package.json Scripts

Your current scripts:
```json
"scripts": {
  "dev": "next dev -p 4000 --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint": "eslint"
}
```

Verify if `--turbopack` flag syntax has changed in Next.js 16.

### Step 7: Review Breaking Changes

Check the official migration guide for breaking changes in:

#### App Router Changes
- [ ] Server Components behavior
- [ ] Client Components ("use client" directive)
- [ ] Route handlers (API routes)
- [ ] Loading and error boundaries
- [ ] Metadata API

#### Font Loading (src/app/layout.jsx)
- [ ] Verify `next/font/google` compatibility
- [ ] Check Geist font loading

#### Image Component
- [ ] Review `next/image` changes
- [ ] Check image optimization settings

#### Link Component
- [ ] Review `next/link` changes
- [ ] Check navigation behavior

### Step 8: Test Build

```bash
npm run build
```

**Fix any errors:**
- Type errors
- ESLint warnings
- Build failures
- Deprecation warnings

**Common issues to check:**
- Import statements
- API route handlers
- Server/Client component boundaries
- Dynamic imports

### Step 9: Test Development Mode

```bash
npm run dev
```

**Test all routes:**
- [ ] Home page (/)
- [ ] Kitchen page (/kitchens)
- [ ] Bathroom page (/bathroom)
- [ ] Laundry page (/laundry)
- [ ] Wardrobes page (/wardrobes)
- [ ] Portfolio page (/portfolio)
- [ ] Admin pages (/admin)
- [ ] Simple pages (/simple)
- [ ] Inquiry pages (/inquiries)

### Step 10: Test Core Features

#### Authentication
- [ ] Login functionality
- [ ] Logout functionality
- [ ] JWT token handling
- [ ] Protected routes
- [ ] AuthContext provider

#### Database (Prisma)
- [ ] Database connections
- [ ] CRUD operations
- [ ] Data fetching in Server Components

#### File Uploads
- [ ] Image uploads
- [ ] File storage in `/uploads`
- [ ] Public file access

#### State Management (Redux)
- [ ] Redux store initialization
- [ ] Redux persist
- [ ] State updates
- [ ] Providers setup

#### Email Functionality
- [ ] EmailJS integration
- [ ] Contact forms
- [ ] Email sending

#### Rich Text Editor (TipTap)
- [ ] Editor rendering
- [ ] Content saving
- [ ] All extensions working

#### PDF & Excel
- [ ] PDF generation (react-pdf)
- [ ] Excel exports (xlsx)

#### UI Components
- [ ] Radix UI components
- [ ] Dropdown menus
- [ ] Popovers
- [ ] Carousel (embla-carousel)

### Step 11: Test Production Build

```bash
npm run build
npm start
```

**Test in production mode:**
- [ ] Page loading speed
- [ ] Image optimization
- [ ] Static generation
- [ ] Server-side rendering
- [ ] API routes
- [ ] File uploads
- [ ] Authentication

### Step 12: Check Tailwind CSS v4 Compatibility

Your project uses Tailwind CSS v4 with Next.js. Verify:

- [ ] PostCSS configuration
- [ ] Tailwind classes rendering correctly
- [ ] Custom styles working
- [ ] Responsive design intact

```bash
# If issues occur, check:
npm list tailwindcss
npm list @tailwindcss/postcss
```

### Step 13: Review Console Warnings

- [ ] Check browser console for warnings
- [ ] Review server console for deprecation notices
- [ ] Fix hydration errors if any

### Step 14: Update Documentation

- [ ] Update README.md with new Next.js version
- [ ] Update any version-specific documentation
- [ ] Document any code changes made during migration

### Step 15: Performance Testing

- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals
- [ ] Test loading times
- [ ] Verify image optimization

### Step 16: Commit Changes

```bash
git add .
git commit -m "Migrate to Next.js 16"
git push origin nextjs-16-migration
```

### Step 17: Create Pull Request

- [ ] Create PR from migration branch
- [ ] Review all changes
- [ ] Get team approval
- [ ] Merge to master

---

## Rollback Plan

If issues occur and you need to rollback:

```bash
# Rollback npm packages
git checkout package.json package-lock.json
npm install

# Or restore from backup commit
git log  # Find your backup commit
git reset --hard <backup-commit-hash>
```

---

## Common Issues and Solutions

### Issue: Turbopack Compatibility

**Problem:** `--turbopack` flag not working

**Solution:**
```bash
# Check if Turbopack is stable in Next.js 16
# If not, remove --turbopack flag temporarily
npm run dev  # Without turbopack
```

### Issue: React 19 Compatibility

**Problem:** Next.js 16 doesn't support React 19

**Solution:**
```bash
# Downgrade to compatible React version
npm install react@18 react-dom@18
```

### Issue: Prisma Client Errors

**Problem:** Prisma client not working after migration

**Solution:**
```bash
npx prisma generate
npx prisma db push  # If needed
```

### Issue: Hydration Errors

**Problem:** Client/server mismatch

**Solution:**
- Check for `suppressHydrationWarning` usage
- Verify Server Component boundaries
- Review dynamic imports

### Issue: Redux Persist Errors

**Problem:** Redux persist not working

**Solution:**
- Check if `redux-persist` is compatible
- Review providers setup in `src/app/providers.jsx`
- Verify localStorage access

---

## Post-Migration Checklist

- [ ] All pages render correctly
- [ ] Authentication works
- [ ] Database operations work
- [ ] File uploads work
- [ ] Emails send successfully
- [ ] Admin panel accessible
- [ ] No console errors
- [ ] Performance metrics acceptable
- [ ] Tests pass (if any)
- [ ] Documentation updated

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/messages/version-16-upgrade-guide)
- [Next.js GitHub Releases](https://github.com/vercel/next.js/releases)
- [Next.js Discord Community](https://discord.gg/nextjs)

---

## Important Notes

**Warning:** As of January 2025, Next.js 16 may not be officially released yet. Always check the official Next.js website and GitHub repository for the latest stable version before proceeding with the migration.

**Current Project Details:**
- Current Next.js version: 15.5.2
- React version: 19.1.0
- Using Turbopack
- Using Tailwind CSS v4
- Using App Router
- Using Prisma ORM

---

## Need Help?

If you encounter issues:
1. Check Next.js documentation
2. Search GitHub issues: https://github.com/vercel/next.js/issues
3. Ask on Next.js Discord
4. Review this project's specific implementations

Good luck with your migration!