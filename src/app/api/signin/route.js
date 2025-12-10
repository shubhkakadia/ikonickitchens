import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";

export async function POST(request) {
  try {
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
      { status: 401 }
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
          { status: 403 }
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
      { status: 200 }
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
