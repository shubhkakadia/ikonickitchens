# CLAUDE.md - Ikoniq Kitchen and Cabinet

> **Project Overview**: Full-stack business management and portfolio platform for a kitchen and cabinet manufacturing company. Built with Next.js 15, React 19, Prisma ORM, and MySQL.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Tech Stack](#tech-stack)
3. [Coding Standards](#coding-standards)
4. [Common Commands](#common-commands)
5. [Project Workflows](#project-workflows)
6. [Core Files & Utilities](#core-files--utilities)
7. [Known Pitfalls](#known-pitfalls)
8. [Database Schema](#database-schema)
9. [Additional Documentation](#additional-documentation)

---

## Project Architecture

### High-Level Overview

This is a **dual-purpose application**:

1. **Public-facing portfolio website** - Showcases completed projects (kitchens, bathrooms, wardrobes, laundry)
2. **Admin dashboard** - Comprehensive business management system

### Key Features

- **Project Management**: Clients, projects, lots (work packages), stages, workflow tracking
- **Inventory Management**: Items (sheets, handles, hardware, accessories, edging tape) with category-specific details
- **Supplier Management**: Suppliers, contacts, purchase orders, statements, procurement workflow
- **Material Selection**: Versioned material selections with quote management
- **Document Management**: File uploads organized by lot tabs (architecture, site measurements, etc.)
- **Financial Tracking**: Purchase orders, supplier statements, stock transactions, Xero integration
- **HR Management**: Employee profiles, availability, banking details, stage assignments
- **Access Control**: Module-based permissions (24+ granular access controls)
- **Activity Logging**: Audit trail with user attribution

### Application Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # Backend API routes (59 endpoints)
│   │   ├── client/           # Client CRUD
│   │   ├── employee/         # Employee management
│   │   ├── project/          # Project management
│   │   ├── lot/              # Lot (work package) management
│   │   ├── stage/            # Workflow stages
│   │   ├── item/             # Inventory management
│   │   ├── supplier/         # Supplier management
│   │   ├── purchase_order/   # Purchase order management
│   │   ├── materials_to_order/ # Material requisitions
│   │   ├── material_selection/ # Material selections
│   │   ├── stock_transaction/ # Stock movements
│   │   ├── stock_tally/      # Bulk stock updates
│   │   ├── module_access/    # Permission management
│   │   ├── logs/             # Activity logs
│   │   ├── xero/             # Xero integration
│   │   ├── uploads/          # File serving
│   │   └── [signin, signout, signup]
│   ├── admin/                # Admin dashboard pages
│   │   ├── clients/
│   │   ├── employees/
│   │   ├── projects/
│   │   │   └── components/   # Project-specific components
│   │   ├── inventory/
│   │   │   └── components/
│   │   ├── suppliers/
│   │   │   └── components/
│   │   ├── logs/
│   │   └── settings/
│   └── [public pages: kitchens, bathrooms, wardrobes, laundry, portfolio]
├── components/               # Reusable UI components (16 base components)
│   ├── ProtectedRoute.jsx    # Route protection with module access
│   ├── TextEditor/           # TipTap rich text editor (TypeScript)
│   ├── Navbar.jsx
│   ├── sidebar.jsx
│   └── [Loader, tabs, Carousel, etc.]
├── lib/                      # Core utilities & middleware
│   ├── auth-middleware.js    # Authentication middleware
│   ├── session.js            # Session management
│   ├── fileHandler.js        # File operations (297 lines)
│   ├── db.ts                 # Prisma client singleton (TypeScript)
│   ├── withLogging.js        # Logging middleware
│   └── validators/           # Server-side validation
├── state/                    # Redux store
│   ├── store/
│   ├── reducer/              # loggedInUser, tabs, xeroCredentials
│   └── action/
├── contexts/                 # React Context (AuthContext)
├── hooks/                    # Custom React hooks
└── styles/                   # Global CSS and SCSS
prisma/
├── schema.prisma             # Database schema (33 models, 11 enums)
└── migrations/               # Database migrations
```

---

## Tech Stack

### Core Framework

- **Next.js 15.5.9** (App Router with Turbopack)
- **React 19.2.3** & **React DOM 19.2.3**

### Backend & Database

- **Prisma 6.19.0** (ORM with MySQL)
- **MySQL** (Relational database)
- **bcrypt 6.0.0** (Password hashing)
- **jsonwebtoken 9.0.2** (JWT tokens)

### State Management

- **@reduxjs/toolkit 2.9.0**
- **react-redux 9.2.0**
- **redux-persist 6.0.0**

### Styling

- **Tailwind CSS 4** (Utility-first CSS)
- **Sass 1.93.2** (SCSS preprocessing)
- **Framer Motion 12.23.24** (Animations)
- **AOS 2.3.4** (Animate on scroll)

### UI Components

- **Radix UI** (Accessible components: dropdown, popover, accordion)
- **lucide-react 0.543.0** (Icons)
- **react-icons 5.5.0** (Additional icons)
- **react-toastify 11.0.5** (Toast notifications)

### Rich Text & Documents

- **TipTap 3.7.0** (Rich text editor with multiple extensions)
- **react-pdf 10.2.0** (PDF viewing)
- **jspdf 3.0.4** (PDF generation)

### Data Handling

- **axios 1.11.0** (HTTP client)
- **xlsx 0.18.5** (Excel files)
- **zod 4.1.13** (Schema validation)
- **date-fns 4.1.0** (Date manipulation)
- **chart.js 4.5.1** & **recharts 3.3.0** (Data visualization)

### Integration

- **@emailjs/browser 4.4.1** (Email service)

---

## Coding Standards

### File Naming Conventions

- **API routes**: lowercase with hyphens or underscores (e.g., `materials_to_order/`, `stock_transaction/`)
- **Components**: PascalCase (e.g., `ProtectedRoute.jsx`, `TextEditor.tsx`)
- **Pages**: lowercase (e.g., `page.jsx`, `layout.jsx`)
- **Utilities/libraries**: camelCase (e.g., `fileHandler.js`, `auth-middleware.js`)

### Code Style

- **JavaScript/JSX** is the primary language
- **TypeScript** is used selectively (e.g., `db.ts`, `TextEditor.tsx`)
- **No semicolons** in most files (consistent with Next.js defaults)
- **Double quotes** for strings in JSX, single quotes acceptable in JS
- **Functional components** with hooks (React 19 style)
- **Path aliases**: Use `@/` for imports from `src/` (configured in `jsconfig.json`)

### Component Patterns

```jsx
// Preferred component structure
"use client"; // If using client-side features

import { useState, useEffect } from "react";
import ComponentName from "@/components/ComponentName";

export default function MyComponent() {
  const [state, setState] = useState(initial);

  useEffect(() => {
    // Side effects
  }, []);

  return <div className="tailwind-classes">{/* JSX */}</div>;
}
```

### API Route Pattern

```js
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";
import { withLogging } from "@/lib/withLogging";
import prisma from "@/lib/db";

async function handler(req) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated) {
      return NextResponse.json(authResult.response, { status: 401 });
    }

    // Business logic
    const data = await prisma.model.findMany();

    return NextResponse.json({
      status: true,
      message: "Success",
      data: data,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { status: false, message: "Server error" },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler, "Model", "FETCH");
```

### Database Access

- **Always use Prisma client** from `@/lib/db.ts` (singleton pattern)
- **Use transactions** for multi-model operations
- **Index foreign keys** and frequently queried fields
- **Soft delete**: Use `is_deleted` field, never hard delete critical data
- **UUIDs** for all primary keys via `@default(uuid())`

### Authentication & Authorization

- **Session-based authentication** (no JWT in cookies)
- Sessions stored in database with expiration
- **Module-based access control** via `module_access` table
- Use `ProtectedRoute` component for client-side protection
- Use `verifyAuth` middleware for API protection
- User types: `MASTER`, `ADMIN`, `MANAGER`

---

## Common Commands

### Development

```bash
# Start development server (with Turbopack, listening on all interfaces)
npm run dev

# Build for production (with Turbopack)
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Database (Prisma)

```bash
# Generate Prisma client (outputs to generated/prisma)
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Useful Development Tips

- Dev server runs on `http://localhost:3000` by default
- Dev server accepts connections from network (0.0.0.0)
- Prisma client outputs to `generated/prisma` (custom path)
- Hot reload enabled via Turbopack

---

## Project Workflows

### Git Workflow

- **Main branch**: Production-ready code
- Before committing, ensure dev server runs without errors
- Test critical flows (login, CRUD operations)

### Adding a New Feature

1. **Database Changes**

   - Update `prisma/schema.prisma`
   - Run `npx prisma migrate dev --name feature_name`
   - Generate client: `npx prisma generate`

2. **API Routes**

   - Create route in `src/app/api/[feature]/`
   - Use standard response format
   - Add authentication via `verifyAuth`
   - Add logging via `withLogging`
   - Update module access if needed

3. **Frontend Pages/Components**

   - Create page in `src/app/admin/[feature]/`
   - Use `ProtectedRoute` or `AdminRoute` wrapper
   - Follow component patterns
   - Use Tailwind for styling

4. **State Management** (if needed)
   - Add reducer in `src/state/reducer/`
   - Update store configuration

### Adding Module Access Controls

1. Add new boolean field to `module_access` model in schema
2. Run migration
3. Update `ProtectedRoute.jsx` to check the new permission
4. Update signup API to initialize the permission
5. Update module access API to allow editing
6. Update admin settings page to show the permission

### File Upload Workflow

- Use `fileHandler.js` utility for all file operations
- Files organized by entity type in root `uploads/` or `mediauploads/`
- Soft delete: Set `is_deleted` flag, move to deleted media management
- Serve files via `/api/uploads/lots/[...path]` route

### Testing Workflow

1. **Manual Testing**

   - Start dev server
   - Test CRUD operations on affected entities
   - Verify access control (try as different user types)
   - Test file uploads/downloads
   - Check for console errors

2. **Database Testing**
   - Use Prisma Studio to verify data
   - Check relationships are created correctly
   - Verify cascade deletes work as expected

---

## Core Files & Utilities

### Critical Files

| File                                | Purpose                     | Notes                                  |
| ----------------------------------- | --------------------------- | -------------------------------------- |
| `src/lib/db.ts`                     | Prisma client singleton     | Import for all DB operations           |
| `src/lib/auth-middleware.js`        | Authentication verification | Use `verifyAuth` in all protected APIs |
| `src/lib/session.js`                | Session management          | Create/validate/delete sessions        |
| `src/lib/fileHandler.js`            | File operations             | 297 lines, handles all file I/O        |
| `src/lib/withLogging.js`            | Activity logging middleware | Wrap API handlers for audit trail      |
| `src/components/ProtectedRoute.jsx` | Client route protection     | Checks user type & module access       |
| `src/contexts/AuthContext.js`       | Auth state provider         | Wraps Redux, provides auth hooks       |
| `prisma/schema.prisma`              | Database schema             | 33 models, 11 enums, source of truth   |

### Key Utilities

**Authentication**

```js
import { verifyAuth } from "@/lib/auth-middleware";
const authResult = await verifyAuth(req);
```

**Session Management**

```js
import { createSession, validateSession, deleteSession } from "@/lib/session";
```

**File Handling**

```js
import { saveFile, deleteFile, getFilePath } from "@/lib/fileHandler";
```

**Database Access**

```js
import prisma from "@/lib/db";
```

**Validation**

```js
import { validateEmail, validatePhone } from "@/lib/validators";
```

### Component Library

**Reusable Components**

- `<ProtectedRoute>` / `<AdminRoute>` / `<MasterAdminRoute>` - Route protection
- `<TextEditor>` - TipTap rich text editor
- `<Loader>` - Loading spinner
- `<DeleteConfirmation>` - Modal for delete confirmations
- `<Navbar>` / `<sidebar>` - Navigation
- `<Carousel>` - Image carousel
- `<StockTally>` - Bulk stock update modal

---

## Known Pitfalls

### 🚨 Critical Warnings

1. **Never hard delete data**

   - Use `is_deleted` flags for soft deletes
   - Exception: Session cleanup for expired sessions

2. **Prisma Client Import**

   - Always import from `@/lib/db` (or `@/lib/db.ts`)
   - Never instantiate `new PrismaClient()` directly
   - Custom output path: `generated/prisma`

3. **File Paths**

   - File uploads go to root-level directories (`uploads/`, `mediauploads/`)
   - Use `fileHandler.js` for all file operations
   - Never hardcode file paths

4. **Session Management**

   - Sessions expire after a set time
   - Clean up expired sessions via `/api/admin/cleanup-sessions`
   - Always verify session in protected routes

5. **Module Access**
   - Check both user type AND module permissions
   - `MASTER` type bypasses module checks
   - `MANAGER` and `ADMIN` types require module access checks

### 🔍 Common Issues

**"Prisma Client not found"**

- Run `npx prisma generate` after schema changes

**Authentication fails unexpectedly**

- Check session expiration
- Verify token is being sent in headers
- Check user's `is_active` status

**File upload returns 404**

- Check file serving route `/api/uploads/lots/[...path]`
- Verify file exists in uploads directory
- Check file permissions

**Module access denies access incorrectly**

- Verify user has corresponding module_access record
- Check if the specific permission field is true
- Master users should bypass module checks

### ⚠️ Performance Considerations

- **Large file uploads**: Files are stored on filesystem, not in database
- **Stock transactions**: Can grow large, index is critical
- **Lot files**: Use pagination when displaying
- **Activity logs**: Will grow indefinitely, consider archival strategy

---

## Database Schema

### Overview

- **33 models** organized into 10 domains
- **11 enums** for fixed values
- **MySQL** database with Prisma ORM
- UUIDs for all primary keys
- Comprehensive indexing strategy

### Key Models

**Authentication & Access**

- `users` - Login accounts (links to employees)
- `module_access` - 24+ granular permissions per user
- `sessions` - Session tokens with expiration

**Core Business Entities**

- `client` - Customer organizations
- `contact` - Polymorphic contacts (client or supplier)
- `project` - Top-level project container
- `lot` - Work packages within projects
- `stage` - Workflow steps with employee assignments

**Inventory & Procurement**

- `item` - Master inventory (5 categories)
- `sheet`, `handle`, `hardware`, `accessory`, `edging_tape` - Category details
- `supplier` - Supplier organizations
- `materials_to_order` - Material requisitions (MTO)
- `purchase_order` - Purchase orders with status workflow
- `stock_transaction` - Inventory movements (ADDED/USED/WASTED)

**Other**

- `material_selection` - Versioned material selections
- `lot_file` - Document management per lot tab
- `logs` - Activity audit trail
- `notification_config` - Per-user notification preferences

### Important Relationships

```
client → projects → lots → stages → employees
                  ↓
              materials_to_order → purchase_order
                  ↓
              stock_transaction → item

users → module_access (one-to-one)
     → sessions (one-to-many)
     → logs (one-to-many)
```

### Critical Enums

- `LogAction`: CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, UPLOAD, OTHER
- `LotStatus`: ACTIVE, COMPLETED, CANCELLED
- `StageStatus`: NOT_STARTED, IN_PROGRESS, DONE, NA
- `MTOStatus`: DRAFT, PARTIALLY_ORDERED, FULLY_ORDERED, CLOSED
- `PurchaseOrderStatus`: DRAFT, ORDERED, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED
- `Category`: SHEET, HANDLE, HARDWARE, ACCESSORY, EDGING_TAPE

For complete schema details, see `prisma/schema.prisma`.

---

## Additional Documentation

### Available Reference Files

| File                               | Description                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PROJECT_REPORT.md`                | Comprehensive 1,400+ line project analysis with metrics, architecture, API endpoints (59), and recommendations |
| `README.md`                        | Basic Next.js setup instructions                                                                               |
| `ADMIN_REPEATING_CODE_ANALYSIS.md` | Analysis of code patterns in admin dashboard                                                                   |
| `code_review.md`                   | Code quality review and suggestions                                                                            |

### Environment Configuration

The project uses a `.env` file for configuration (not in repo):

- `DATABASE_URL` - MySQL connection string
- Email service configuration
- Xero API credentials
- Other sensitive configuration

### Key Metrics (Current)

- **137 JS/JSX files** + **2 TypeScript files**
- **59 API endpoints**
- **27 admin pages** + **8 public pages**
- **27 components** (16 base, 11 feature-specific)
- **33 database models**
- **~650 MB** of uploaded files
- **~28,000+ lines** of application code

---

## Quick Start Checklist

When working on this codebase:

- [ ] Understand the module-based access control system
- [ ] Use Prisma client from `@/lib/db` exclusively
- [ ] Always add `withLogging` middleware to API routes that modify data
- [ ] Use `verifyAuth` for all protected API endpoints
- [ ] Soft delete with `is_deleted` flag, not hard deletes
- [ ] Follow the standard API response format
- [ ] Use `@/` path alias for imports from src/
- [ ] Run `npx prisma generate` after schema changes
- [ ] Test with different user types (MASTER, ADMIN, MANAGER)
- [ ] Check both user type AND module access permissions

---

**Last Updated**: 2026-01-15  
**Project Version**: 0.1.0  
**Next.js Version**: 15.5.9  
**Prisma Version**: 6.19.0
