# Deployment changes

Kora `npm run deployments:changes` for att visa den har listan i terminalen.

## 2026-04-10

- `clara-webapp-gemini-719zj2nq3-juniperhills-projects.vercel.app`
  - Forsta produktionsdeployen i den har sessionen.
  - Grundlaggande fallback for API-fel i frontend.

- `clara-webapp-gemini-37e4vpvil-juniperhills-projects.vercel.app`
  - Tog bort tillfallig kvot-specialhantering i backend.

- `clara-webapp-gemini-1glioyoaz-juniperhills-projects.vercel.app`
  - Forbattrad tillganglighet for VoiceOver/TalkBack.
  - Bättre semantik, live region och fokus pa nytt svar.

- `clara-webapp-gemini-jxxrxbk1w-juniperhills-projects.vercel.app`
  - Uppdaterad språkregel i prompten (nämn inte språk i onödan).

- `clara-webapp-gemini-ca86obbcl-juniperhills-projects.vercel.app`
  - Skarpare språkregel: undvik gissningar om språkstöd.

- `clara-webapp-gemini-n917cqkr4-juniperhills-projects.vercel.app`
  - Prompt justerad igen till mer balanserad detaljnivå.

- `clara-webapp-gemini-8ub5lxxri-juniperhills-projects.vercel.app`
  - Krav på konkreta teknikexempel med länkar i svaret.

- `clara-webapp-gemini-ka4k3a6ly-juniperhills-projects.vercel.app`
  - Klickbara länkar i UI.
  - Kortare länktext (t.ex. App Store iOS / Google Play Android).
  - Skarpt krav att forsta steg bor vara inbyggda mobilfunktioner
    (rostassistent, OCR/textigenkanning, forstorare, upplasning) nar mojligt.
