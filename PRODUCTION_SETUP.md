# Clara production setup

## 1. Environment variable

Set this variable in the new Vercel project:

```env
GOOGLE_GENERATIVE_AI_API_KEY=...
```

Only Gemini is used. No OpenAI key is needed.

## 2. Local secrets

Do not commit `.env`.

Use `.env.example` as the template for local setup.

If an older development key has ever been committed or shared, rotate it before launch.

## 3. Vercel rate limiting

The app code expects a Vercel Firewall rate limit with the id:

```txt
clara-public-api
```

Create the rule in the new Vercel account and apply it to `POST /api/clara`.

There is no app-side request counter anymore.

Clara relies on the Vercel Firewall rule alone for public request rate limiting.

Suggested starting limit:

- 12 requests per 10 minutes per IP

If you expect heavier legitimate use, raise it carefully after observing traffic.

## 4. Public error handling

The backend now returns specific JSON error codes for:

- `RATE_LIMITED`
- `BUDGET_EXCEEDED`
- `MISCONFIGURED`
- `SERVICE_UNAVAILABLE`
- `SERVER_ERROR`

The frontend shows the user-friendly `reply` text from these responses directly in the conversation UI.

## 5. Cost controls

The Gemini request is now hardened with:

- `maxOutputTokens: 900`
- `thinkingBudget: 0`
- `maxRetries: 0`
- selective Google Search grounding instead of always-on search
- shortened conversation context before prompt construction
