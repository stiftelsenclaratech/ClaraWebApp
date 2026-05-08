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
            "För många frågor har skickats från samma anslutning. Vänta en stund och försök igen.",
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
