import { next } from "@vercel/functions";
import { checkRateLimit } from "@vercel/firewall";

const CLARA_RATE_LIMIT_ID = "clara-public-api";

export const config = {
  matcher: ["/api/clara"],
};

export default async function middleware(request: Request) {
  if (request.method !== "POST") {
    return next();
  }

  try {
    const { rateLimited } = await checkRateLimit(CLARA_RATE_LIMIT_ID, {
      request,
    });

    if (rateLimited) {
      return Response.json(
        {
          code: "RATE_LIMITED",
          reply:
            "Antalet f\u00f6rfr\u00e5gningar har n\u00e5tt sin gr\u00e4ns just nu. F\u00f6rs\u00f6k igen om 10 minuter.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }
  } catch (error) {
    console.error("Clara rate limit error:", error);
  }

  return next();
}
