import "server-only"

import bcrypt from "bcrypt"
import crypto from "crypto"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api/response"
import { rateLimit } from "@/lib/rateLimit"

const signinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many signin attempts, please try again later.",
  keyGenerator: (request) => {
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "unknown"

    return `signin:${ip}`
  },
})

function rateLimitHeaders(rateLimitResult) {
  return {
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
    "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
  }
}

export async function signin(request) {
  try {
    const rateLimitResult = await signinRateLimit(request)

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
            "X-RateLimit-Reset": new Date(
              rateLimitResult.resetTime,
            ).toISOString(),
          },
        },
      )
    }

    const { username, password } = await request.json()
    const user = await prisma.users.findUnique({ where: { username } })
    const headers = rateLimitHeaders(rateLimitResult)

    let isValidPassword = false
    if (user) {
      isValidPassword = await bcrypt.compare(password, user.password)

      if (!user.is_active) {
        return apiError("User account is not active", 403, undefined, headers)
      }
    } else {
      const dummyHash =
        "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuv"
      await bcrypt.compare(password, dummyHash)
    }

    if (!user || !isValidPassword) {
      return apiError("Invalid username or password", 401, undefined, headers)
    }

    const sessionToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const session = await prisma.sessions.create({
      data: {
        user_id: user.id,
        token: sessionToken,
        user_type: user.user_type,
        expires_at: expiresAt,
      },
    })

    return apiSuccess(
      {
        user: {
          id: user.id,
          username: user.username,
          user_type: user.user_type,
          is_active: user.is_active,
          is_verified: user.is_verified,
          employee_id: user.employee_id,
        },
        token: sessionToken,
        sessionId: session.id,
      },
      "Login successful",
      200,
      headers,
    )
  } catch (error) {
    console.error("Signin error:", error)
    return apiError("Internal server error")
  }
}
