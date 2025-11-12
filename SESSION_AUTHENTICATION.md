# Session-Based Authentication System

This document explains the session-based authentication system implemented for the Ikoniq Kitchen and Cabinet application.

## Overview

The system uses database-stored sessions with proper validation to authenticate users. Each session is stored in the `sessions` table with a unique token, user information, and expiration time.

## Features

- ✅ Database-stored sessions for better security
- ✅ Session expiration (24 hours by default)
- ✅ User account status validation (is_active, is_verified)
- ✅ Proper error messages for different failure conditions
- ✅ Automatic session cleanup for expired sessions
- ✅ Middleware for protecting API routes
- ✅ Role-based access control

## Database Schema

### Sessions Table
```sql
model sessions {
  id         String   @id @default(uuid())
  user_id    String
  token      String
  user_type  String
  expires_at DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([user_id])
  @@index([token])
  @@index([user_type])
  @@index([expires_at])
}
```

## API Endpoints

### 1. Sign In - `POST /api/signin`

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "user_type": "string",
      "is_active": true,
      "is_verified": true,
      "employee_id": "string"
    },
    "token": "session_token_here",
    "jwtToken": "jwt_token_here",
    "sessionId": "session_uuid"
  }
}
```

**Error Responses (401):**
```json
// User not found or wrong password
{
  "status": false,
  "message": "Username or password is incorrect"
}

// Account not active
{
  "status": false,
  "message": "User account is not active"
}

// Account not verified
{
  "status": false,
  "message": "User account is not verified"
}
```

### 2. Sign Out - `POST /api/signout`

**Headers:**
```
Authorization: Bearer <session_token>
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Logout successful"
}
```

### 3. Session Validation in CRUD APIs

Session validation is integrated directly into each CRUD API. Each protected API will validate the session token and process the request only if the session is valid.

**How it works:**
1. Client sends request with session token in `Authorization: Bearer <token>` header
2. API uses `withAuth()` middleware to validate the session
3. If session is valid, the API processes the request with user context
4. If session is invalid, the API returns appropriate error message

**Benefits:**
- No separate verification step needed
- Each API is self-contained with authentication
- Automatic user context available in all protected routes
- Consistent error handling across all APIs

## Usage Examples

### 1. Basic Protected Route

```javascript
// src/app/api/protected/route.js
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";

export const GET = withAuth(async (request, sessionData) => {
  return NextResponse.json({
    message: "This is a protected route",
    user: sessionData.user
  });
});
```

### 2. CRUD API with Session Validation

```javascript
// Example: Create Project API
// src/app/api/projects/route.js
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";

export const POST = withAuth(async (request, sessionData) => {
  try {
    const projectData = await request.json();
    
    // Session is already validated by withAuth middleware
    // sessionData contains user information
    
    const project = await prisma.projects.create({
      data: {
        ...projectData,
        created_by: sessionData.userId, // Use session user ID
      },
    });

    return NextResponse.json({
      status: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    return NextResponse.json({
      status: false,
      message: "Failed to create project",
      error: error.message,
    }, { status: 500 });
  }
});

export const GET = withAuth(async (request, sessionData) => {
  try {
    const projects = await prisma.projects.findMany({
      where: {
        created_by: sessionData.userId, // Filter by user
      },
    });

    return NextResponse.json({
      status: true,
      data: projects,
    });
  } catch (error) {
    return NextResponse.json({
      status: false,
      message: "Failed to fetch projects",
      error: error.message,
    }, { status: 500 });
  }
});
```

### 3. Admin-Only Route

```javascript
// src/app/api/admin/route.js
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth-middleware";

export const GET = withAdminAuth(async (request, sessionData) => {
  return NextResponse.json({
    message: "This is an admin-only route",
    user: sessionData.user
  });
});
```

### 4. Master Admin Only Route

```javascript
// src/app/api/master-admin/route.js
import { NextResponse } from "next/server";
import { withMasterAdminAuth } from "@/lib/auth-middleware";

export const GET = withMasterAdminAuth(async (request, sessionData) => {
  return NextResponse.json({
    message: "This is a master admin-only route",
    user: sessionData.user
  });
});
```

### 5. Custom User Type Validation

```javascript
// src/app/api/employee/route.js
import { NextResponse } from "next/server";
import { withUserType } from "@/lib/auth-middleware";

export const GET = withUserType(['employee', 'admin'])(async (request, sessionData) => {
  return NextResponse.json({
    message: "This route is for employees and admins",
    user: sessionData.user
  });
});
```

## Frontend Integration

### 1. Login Request

```javascript
const loginUser = async (username, password) => {
  try {
    const response = await fetch('/api/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    
    if (data.status) {
      // Store the session token
      localStorage.setItem('session_token', data.data.token);
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};
```

### 2. Making Authenticated Requests

```javascript
const makeAuthenticatedRequest = async (url, options = {}) => {
  const sessionToken = localStorage.getItem('session_token');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${sessionToken}`,
    },
  });

  if (response.status === 401) {
    // Session expired or invalid
    localStorage.removeItem('session_token');
    // Redirect to login page
    window.location.href = '/login';
    return;
  }

  return response;
};
```

### 3. Logout

```javascript
const logoutUser = async () => {
  const sessionToken = localStorage.getItem('session_token');
  
  try {
    await fetch('/api/signout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('session_token');
    // Redirect to login page
    window.location.href = '/login';
  }
};
```

## Session Management

### Automatic Cleanup

Expired sessions are automatically cleaned up. You can also manually trigger cleanup:

```javascript
// Manual cleanup (admin only)
const cleanupSessions = async () => {
  const response = await fetch('/api/admin/cleanup-sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
  
  const data = await response.json();
  console.log(data.message);
};
```

### Session Validation

The system validates sessions by:
1. Checking if the session token exists in the database
2. Verifying the session hasn't expired
3. Ensuring the user account is still active and verified
4. Automatically deleting invalid sessions

## Security Features

1. **Secure Token Generation**: Uses `crypto.randomBytes()` for session tokens
2. **Session Expiration**: Sessions expire after 24 hours by default
3. **Account Status Validation**: Checks `is_active` and `is_verified` on every request
4. **Automatic Cleanup**: Expired sessions are automatically removed
5. **Role-Based Access**: Different middleware for different user types

## Error Handling

The system provides specific error messages for different failure conditions:

- `"Username or password is incorrect"` - When user doesn't exist or password is wrong
- `"User account is not active"` - When `is_active` is false
- `"User account is not verified"` - When `is_verified` is false
- `"Invalid or expired session"` - When session token is invalid or expired
- `"No valid session token provided"` - When no Authorization header is provided

## Configuration

### Environment Variables

Make sure you have the following environment variables set:

```env
DATABASE_URL="your_database_connection_string"
JWT_SECRET="your_jwt_secret_key"
```

### Session Expiration

To change session expiration time, modify the `expiresAt` calculation in `/api/signin/route.js`:

```javascript
// Current: 24 hours
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24);

// Example: 7 days
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7);
```

## Troubleshooting

### Common Issues

1. **Session not found**: Check if the session token is being sent correctly in the Authorization header
2. **User account not active**: Verify the user's `is_active` status in the database
3. **User account not verified**: Verify the user's `is_verified` status in the database
4. **Session expired**: Check the `expires_at` field in the sessions table

### Debugging

Enable detailed logging by checking the console for:
- Session validation errors
- Authentication failures
- Session cleanup logs

## Migration from JWT-Only to Session-Based

If you're migrating from a JWT-only system:

1. Update your frontend to store the session token instead of JWT
2. Update API calls to use the session token in Authorization header
3. Replace JWT validation with session validation in your middleware
4. Update logout functionality to call the signout API

The system is backward compatible and can work alongside existing JWT tokens if needed.

