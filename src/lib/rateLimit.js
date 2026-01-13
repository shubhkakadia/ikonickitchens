// Rate limiter utility for Next.js App Router
// Uses in-memory store (for production, consider Redis or similar)

const rateLimitStore = new Map();

/**
 * Rate limiter middleware for Next.js API routes
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum number of requests per window (default: 5)
 * @param {string} options.message - Error message when limit is exceeded
 * @param {Function} options.keyGenerator - Function to generate unique key for each request
 * @returns {Function} Middleware function
 */
export function rateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 5, // 5 requests per window
    message = "Too many requests, please try again later.",
    keyGenerator = (request) => {
      // Default: use IP address
      const forwarded = request.headers.get("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0].trim() :
        request.headers.get("x-real-ip") ||
        "unknown";
      return ip;
    },
  } = options;

  return async (request) => {
    const key = keyGenerator(request);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    entry.count += 1;
    rateLimitStore.set(key, entry);

    // Clean up old entries periodically (every 5 minutes)
    if (Math.random() < 0.01) { // 1% chance on each request
      const cutoff = now - windowMs;
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < cutoff) {
          rateLimitStore.delete(k);
        }
      }
    }

    // Check if limit exceeded
    if (entry.count > max) {
      const retryAfter = Math.max(0, Math.ceil((entry.resetTime - now) / 1000));
      return {
        success: false,
        status: 429,
        message,
        retryAfter,
        resetTime: entry.resetTime,
      };
    }

    return {
      success: true,
      remaining: max - entry.count,
      resetTime: entry.resetTime,
    };
  };
}
