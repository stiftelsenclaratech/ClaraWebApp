import posthog from "posthog-js";

// Kompletterar @vercel/analytics med riktig uppföljning av antal frågor,
// följdfrågor och nöjdhet - Vercels egen vy för det kräver ett betalande
// Pro-team. Helt anonymt: inget kontoinnehåll, ingen identifierare kopplad
// till en person, bara händelsenamn (samma händelser som redan skickas
// till @vercel/analytics).
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim();
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (!POSTHOG_KEY || initialized || typeof window === "undefined") {
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    disable_session_recording: true,
    autocapture: false,
  });

  initialized = true;
}

export function captureEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
) {
  if (!initialized) {
    return;
  }

  try {
    posthog.capture(name, properties);
  } catch {
    // mätning får aldrig störa samtalet
  }
}
