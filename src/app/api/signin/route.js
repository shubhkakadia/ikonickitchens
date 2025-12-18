import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";

// Configure rate limiter: 5 attempts per 15 minutes per IP
const signinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: "Too many signin attempts, please try again later.",
  keyGenerator: (request) => {
    // Use IP address for rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() :
      request.headers.get("x-real-ip") ||
      "unknown";
    return `signin:${ip}`;
  },
});

export async function POST(request) {
  try {
    // Check rate limit
    const rateLimitResult = await signinRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          status: false,
          message: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: rateLimitResult.status,
          headers: {
            "Retry-After": rateLimitResult.retryAfter.toString(),
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      );
    }

    const { username, password } = await request.json();

    // Find user
    const user = await prisma.users.findUnique({
      where: { username },
    });

    // Generic error message to prevent username enumeration
    // Always return the same message whether user exists or password is wrong
    const invalidCredentialsResponse = NextResponse.json(
      {
        status: false,
        message: "Invalid username or password",
      },
      {
        status: 401,
        headers: {
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );

    // Check if user exists and password is valid
    // Use dummy hash comparison if user doesn't exist to prevent timing attacks
    let isValidPassword = false;
    if (user) {
      isValidPassword = await bcrypt.compare(password, user.password);

      // Check if user account is active
      if (!user.is_active) {
        return NextResponse.json(
          {
            status: false,
            message: "User account is not active",
          },
          {
            status: 403,
            headers: {
              "X-RateLimit-Limit": "5",
              "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
              "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
            },
          }
        );
      }
    } else {
      // Perform dummy bcrypt comparison to prevent timing attacks
      // Use a valid bcrypt hash format to ensure consistent timing
      // This ensures similar response times whether user exists or not
      const dummyHash = "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuv";
      await bcrypt.compare(password, dummyHash);
    }

    if (!user || !isValidPassword) {
      return invalidCredentialsResponse;
    }

    // Generate session token (using random bytes for better security)
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // Set session expiry (1 month from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store session in database
    const session = await prisma.sessions.create({
      data: {
        user_id: user.id,
        token: sessionToken,
        user_type: user.user_type,
        expires_at: expiresAt,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            username: user.username,
            user_type: user.user_type,
            is_active: user.is_active,
            is_verified: user.is_verified,
            employee_id: user.employee_id,
          },
          token: sessionToken, // Use session token as the main token
          sessionId: session.id,
        },
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error("Signin error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
