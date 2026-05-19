import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type LatLng = { lat: number; lng: number };

const cache = new Map<string, string | null>();

export const computeRoutes = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: LatLng; destinations: LatLng[] }) => {
    if (!input?.origin || !Array.isArray(input.destinations)) {
      throw new Error("origin and destinations required");
    }
    return {
      origin: { lat: Number(input.origin.lat), lng: Number(input.origin.lng) },
      destinations: input.destinations.slice(0, 50).map((d) => ({
        lat: Number(d.lat),
        lng: Number(d.lng),
      })),
    };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    const results = await Promise.all(
      data.destinations.map(async (dest) => {
        const key = `${data.origin.lat},${data.origin.lng}->${dest.lat},${dest.lng}`;
        if (cache.has(key)) {
          return { destination: dest, polyline: cache.get(key)! };
        }
        const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
            destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error("Routes API error", res.status, body);
          cache.set(key, null);
          return { destination: dest, polyline: null };
        }
        const json = (await res.json()) as {
          routes?: Array<{ polyline?: { encodedPolyline?: string } }>;
        };
        const poly = json.routes?.[0]?.polyline?.encodedPolyline ?? null;
        cache.set(key, poly);
        return { destination: dest, polyline: poly };
      })
    );

    return { results };
  });
