import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

type NodeType = "hub" | "subhub" | "urbano" | "rural" | "critico" | "intermunicipal";

interface Point {
  name: string;
  lat: number;
  lng: number;
  type: NodeType;
  color: string;
}

const points: Point[] = [
  { name: "Sede Principal", lat: 4.338, lng: -74.364, type: "hub", color: "purple" },
  { name: "CAA (sub-hub)", lat: 4.3368, lng: -74.3628, type: "subhub", color: "blue" },
  { name: "P.S. El Obrero", lat: 4.3351, lng: -74.3558, type: "urbano", color: "green" },
  { name: "P.S. El Progreso", lat: 4.3463, lng: -74.3601, type: "urbano", color: "green" },
  { name: "P.S. La Venta", lat: 4.329, lng: -74.352, type: "urbano", color: "green" },
  { name: "P.S. La Aguadita", lat: 4.378, lng: -74.365, type: "rural", color: "orange" },
  { name: "P.S. La Trinidad", lat: 4.312, lng: -74.39, type: "rural", color: "orange" },
  { name: "P.S. Bosachoque", lat: 4.355, lng: -74.415, type: "critico", color: "red" },
  { name: "P.S. Novillero", lat: 4.362, lng: -74.428, type: "critico", color: "red" },
  { name: "P.S. Cumaca", lat: 4.301, lng: -74.375, type: "critico", color: "red" },
  { name: "P.S. Tibacuy", lat: 4.3485, lng: -74.442, type: "intermunicipal", color: "yellow" },
  { name: "P.S. Pasca", lat: 4.3072, lng: -74.3006, type: "intermunicipal", color: "yellow" },
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

// Haversine distance in km
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      setError("Falta la clave de Google Maps.");
      return;
    }

    window.initHospitalMap = () => setLoaded(true);

    if (window.google?.maps) {
      setLoaded(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-gmaps]");
    if (existing) return;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initHospitalMap${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.defer = true;
    script.dataset.gmaps = "true";
    script.onerror = () => setError("No se pudo cargar Google Maps.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || !window.google?.maps) return;
    const g = window.google.maps;

    const map = new g.Map(mapRef.current, {
      center: { lat: 4.338, lng: -74.364 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    const hub = points[0];
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
        <div style="font-family: ui-sans-serif, system-ui; min-width: 200px;">
          <div style="font-weight:600; font-size:14px; color:#0f172a;">${p.name}</div>
          <div style="margin-top:4px; font-size:12px; color:#475569;">
            <div><b>Tipo:</b> ${typeLabels[p.type]}</div>
            <div><b>Ruta:</b> ${route ? route.name : "—"}</div>
            <div><b>Distancia desde sede:</b> ${dist} km</div>
          </div>
        </div>`;

      marker.addListener("click", () => {
        infoWindow.setContent(content);
        infoWindow.open({ anchor: marker, map });
      });
    });

    points.slice(1).forEach((p) => {
      const route = routeForType[p.type];
      if (!route) return;
      new g.Polyline({
        path: [
          { lat: hub.lat, lng: hub.lng },
          { lat: p.lat, lng: p.lng },
        ],
        geodesic: true,
        strokeColor: route.color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      });
    });
  }, [loaded]);

  const nodeLegend: { type: NodeType }[] = [
    { type: "hub" },
    { type: "subhub" },
    { type: "urbano" },
    { type: "rural" },
    { type: "critico" },
    { type: "intermunicipal" },
  ];

  const routeLegend = [
    { name: "Ruta A — Urbana", color: "#185FA5" },
    { name: "Ruta B — Rural Norte", color: "#0F6E56" },
    { name: "Ruta C — Rural Occidente", color: "#A32D2D" },
    { name: "Ruta D — Intermunicipal", color: "#854F0B" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">
            E.S.E. Hospital San Rafael de Fusagasugá
          </h1>
          <p className="text-sm text-slate-500">
            Red de distribución de medicamentos — 12 puntos
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
            {!loaded && !error && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-slate-500">
                Cargando mapa…
              </div>
            )}
            <div ref={mapRef} className="h-full w-full" />
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Tipos de nodo</h2>
              <ul className="space-y-2">
                {nodeLegend.map((n) => (
                  <li key={n.type} className="flex items-center gap-3 text-sm text-slate-700">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: typeColors[n.type] }}
                    />
                    {typeLabels[n.type]}
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
                {points.map((p) => (
                  <li key={p.name} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: typeColors[p.type] }}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-slate-400">
                      {distanceKm(points[0], p).toFixed(1)} km
                    </span>
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
