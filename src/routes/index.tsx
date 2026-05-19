import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { geocodeAddresses } from "@/lib/geocode.functions";
import { computeRoutes } from "@/lib/routes.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

type NodeType = "hub" | "subhub" | "urbano" | "rural" | "critico" | "intermunicipal";

interface PointInput {
  name: string;
  address: string;
  type: NodeType;
  lat?: number;
  lng?: number;
}

interface Point extends PointInput {
  lat: number;
  lng: number;
}

const puntos: PointInput[] = [
  { name: "Sede Principal", address: "Diagonal 23 #12-64, Barrio San Mateo, Fusagasugá, Cundinamarca", type: "hub" },
  { name: "CAA", address: "Transversal 12 #22-42, Fusagasugá, Cundinamarca", type: "subhub" },
  { name: "P.S. El Obrero", address: "Transversal 3 #23-21, Barrio Obrero, Fusagasugá, Cundinamarca", type: "urbano", lat: 4.326458, lng: -74.365414 },
  { name: "P.S. El Progreso", address: "Carrera 3 #3-09, Fusagasugá, Cundinamarca", type: "urbano", lat: 4.351506, lng: -74.362327 },
  { name: "P.S. La Venta", address: "Carrera 64 #21A-90, Fusagasugá, Cundinamarca", type: "urbano" },
  { name: "P.S. La Aguadita", address: "Carrera 3 #6-25, Fusagasugá, Cundinamarca", type: "rural", lat: 4.387639, lng: -74.325444 },
  { name: "P.S. La Trinidad", address: "Sector La Trinidad, Fusagasugá, Cundinamarca", type: "rural", lat: 4.292547, lng: -74.388391 },
  { name: "P.S. Bosachoque", address: "Vereda Bosachoque, Fusagasugá, Cundinamarca", type: "critico" },
  { name: "P.S. Novillero", address: "Vereda Novillero, Fusagasugá, Cundinamarca", type: "critico", lat: 4.358168, lng: -74.395405 },
  { name: "P.S. Cumaca", address: "Vereda Cumaca, Fusagasugá, Cundinamarca", type: "critico" },
  { name: "P.S. Tibacuy", address: "Tibacuy, Cundinamarca", type: "intermunicipal", lat: 3.349346, lng: -74.452667 },
  { name: "P.S. Pasca", address: "Barrio Bellavista, Pasca, Cundinamarca", type: "intermunicipal", lat: 4.307545, lng: -74.301442 },
];

const typeLabels: Record<NodeType, string> = {
  hub: "Hub central",
  subhub: "Sub-hub",
  urbano: "Urbano",
  rural: "Rural",
  critico: "Crítico",
  intermunicipal: "Intermunicipal",
};

const typeColors: Record<NodeType, string> = {
  hub: "#9333ea",
  subhub: "#2563eb",
  urbano: "#16a34a",
  rural: "#ea580c",
  critico: "#dc2626",
  intermunicipal: "#eab308",
};

const routeForType: Record<NodeType, { name: string; color: string } | null> = {
  hub: null,
  subhub: { name: "Ruta A — Urbana", color: "#185FA5" },
  urbano: { name: "Ruta A — Urbana", color: "#185FA5" },
  rural: { name: "Ruta B — Rural Norte", color: "#0F6E56" },
  critico: { name: "Ruta C — Rural Occidente", color: "#A32D2D" },
  intermunicipal: { name: "Ruta D — Intermunicipal", color: "#854F0B" },
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

declare global {
  interface Window {
    google: any;
    initHospitalMap?: () => void;
  }
}

function Index() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const geocode = useServerFn(geocodeAddresses);
  const fetchRoutes = useServerFn(computeRoutes);

  // Load Google Maps JS
  useEffect(() => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      setError("Falta la clave de Google Maps.");
      return;
    }
    window.initHospitalMap = () => setMapLoaded(true);
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }
    if (document.querySelector("script[data-gmaps]")) return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=geometry&callback=initHospitalMap${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.defer = true;
    script.dataset.gmaps = "true";
    script.onerror = () => setError("No se pudo cargar Google Maps.");
    document.head.appendChild(script);
  }, []);

  // Geocode addresses
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const toGeocode = puntos.filter((p) => p.lat == null || p.lng == null);
        const { results } = toGeocode.length
          ? await geocode({ data: { addresses: toGeocode.map((p) => p.address) } })
          : { results: [] as Array<{ address: string; location: { lat: number; lng: number } | null }> };
        if (cancelled) return;
        const locByAddress = new Map(results.map((r) => [r.address, r.location]));
        const resolved: Point[] = [];
        const missing: string[] = [];
        puntos.forEach((p) => {
          if (p.lat != null && p.lng != null) {
            resolved.push({ ...p, lat: p.lat, lng: p.lng });
          } else {
            const loc = locByAddress.get(p.address);
            if (loc) resolved.push({ ...p, lat: loc.lat, lng: loc.lng });
            else missing.push(p.name);
          }
        });
        if (missing.length) {
          console.warn("No se pudieron geocodificar:", missing);
        }
        setPoints(resolved);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error geocodificando direcciones");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geocode]);

  // Render markers + routes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google?.maps || !points || points.length === 0) return;
    const g = window.google.maps;

    const hub = points.find((p) => p.type === "hub") ?? points[0];

    const map = new g.Map(mapRef.current, {
      center: { lat: hub.lat, lng: hub.lng },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    const infoWindow = new g.InfoWindow();

    points.forEach((p) => {
      const marker = new g.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.name,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: p.type === "hub" ? 12 : 9,
          fillColor: typeColors[p.type],
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      const route = routeForType[p.type];
      const dist = distanceKm(hub, p).toFixed(2);
      const content = `
        <div style="font-family: ui-sans-serif, system-ui; min-width: 220px;">
          <div style="font-weight:600; font-size:14px; color:#0f172a;">${p.name}</div>
          <div style="margin-top:4px; font-size:12px; color:#475569;">
            <div><b>Tipo:</b> ${typeLabels[p.type]}</div>
            <div><b>Ruta:</b> ${route ? route.name : "—"}</div>
            <div><b>Distancia desde sede:</b> ${dist} km</div>
            <div style="margin-top:4px; color:#64748b;">${p.address}</div>
          </div>
        </div>`;
      marker.addListener("click", () => {
        infoWindow.setContent(content);
        infoWindow.open({ anchor: marker, map });
      });
    });

    const trazarRuta = (
      destino: { lat: number; lng: number },
      color: string
    ) => {
      const service = new g.DirectionsService();
      const renderer = new g.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: color,
          strokeWeight: 3,
          strokeOpacity: 0.8,
        },
      });
      service.route(
        {
          origin: { lat: hub.lat, lng: hub.lng },
          destination: { lat: destino.lat, lng: destino.lng },
          travelMode: g.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === "OK" && result) {
            renderer.setDirections(result);
          } else {
            console.warn("Directions request failed:", status);
          }
        }
      );
    };

    points
      .filter((p) => p.type !== "hub")
      .forEach((p) => {
        const route = routeForType[p.type];
        if (!route) return;
        trazarRuta({ lat: p.lat, lng: p.lng }, route.color);
      });
  }, [mapLoaded, points]);

  const nodeLegend: NodeType[] = ["hub", "subhub", "urbano", "rural", "critico", "intermunicipal"];
  const routeLegend = [
    { name: "Ruta A — Urbana", color: "#185FA5" },
    { name: "Ruta B — Rural Norte", color: "#0F6E56" },
    { name: "Ruta C — Rural Occidente", color: "#A32D2D" },
    { name: "Ruta D — Intermunicipal", color: "#854F0B" },
  ];

  const hubPoint = points?.find((p) => p.type === "hub");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">
            E.S.E. Hospital San Rafael de Fusagasugá
          </h1>
          <p className="text-sm text-slate-500">
            Red de distribución de medicamentos — direcciones geocodificadas en vivo
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="relative h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-6 text-center text-sm text-red-600">
                {error}
              </div>
            )}
            {!error && (!mapLoaded || !points) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-slate-500">
                {points ? "Cargando mapa…" : "Geocodificando direcciones…"}
              </div>
            )}
            <div ref={mapRef} className="h-full w-full" />
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Tipos de nodo</h2>
              <ul className="space-y-2">
                {nodeLegend.map((t) => (
                  <li key={t} className="flex items-center gap-3 text-sm text-slate-700">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: typeColors[t] }}
                    />
                    {typeLabels[t]}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Rutas</h2>
              <ul className="space-y-2">
                {routeLegend.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 text-sm text-slate-700">
                    <span
                      className="inline-block h-1 w-6 rounded"
                      style={{ backgroundColor: r.color }}
                    />
                    {r.name}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Puntos</h2>
              <ul className="max-h-64 space-y-1.5 overflow-auto pr-1 text-xs text-slate-600">
                {(points ?? []).map((p) => (
                  <li key={p.name} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: typeColors[p.type] }}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    {hubPoint && (
                      <span className="text-slate-400">
                        {distanceKm(hubPoint, p).toFixed(1)} km
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
