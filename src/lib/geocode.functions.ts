import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

// Simple in-memory cache (per Worker instance) to avoid re-geocoding on every call
const cache = new Map<string, { lat: number; lng: number } | null>();

export const geocodeAddresses = createServerFn({ method: "POST" })
  .inputValidator((input: { addresses: string[] }) => {
    if (!input || !Array.isArray(input.addresses)) {
      throw new Error("addresses must be an array");
    }
    return { addresses: input.addresses.slice(0, 50).map((a) => String(a)) };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    const results = await Promise.all(
      data.addresses.map(async (address) => {
        if (cache.has(address)) {
          return { address, location: cache.get(address)! };
        }
        const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          },
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Geocoding failed [${res.status}]: ${body}`);
        }
        const json = (await res.json()) as {
          status: string;
          results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
        };
        const loc = json.results?.[0]?.geometry?.location ?? null;
        cache.set(address, loc);
        return { address, location: loc };
      })
    );

    return { results };
  });
