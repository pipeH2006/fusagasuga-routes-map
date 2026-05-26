import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { geocodeAddresses } from "@/lib/geocode.functions";
import { computeRoutes } from "@/lib/routes.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

type NodeType = "hub" | "subhub" | "urbano" | "rural" | "critico" | "intermunicipal";
type RouteFilter = "all" | "urbana" | "rural_norte" | "rural_critica" | "intermunicipal";

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

interface PointMeta {
  km: number;
  min: number;
  costo: number;
  horario: string;
  frecuencia: string;
  via: string;
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
  { name: "P.S. Tibacuy", address: "Tibacuy, Cundinamarca", type: "intermunicipal", lat: 4.35111, lng: -72.45639 },
  { name: "P.S. Pasca", address: "Barrio Bellavista, Pasca, Cundinamarca", type: "intermunicipal", lat: 4.307545, lng: -74.301442 },
];

const pointMeta: Record<string, PointMeta> = {
  "Sede Principal": { km: 0, min: 0, costo: 0, horario: "24h", frecuencia: "Diaria", via: "N/A" },
  "CAA": { km: 2, min: 8, costo: 14000, horario: "L-V 8am-5pm, Sáb 8am-12m", frecuencia: "3x semana", via: "Pavimentada" },
  "P.S. El Obrero": { km: 1.5, min: 5, costo: 8000, horario: "L-V 7am-5pm, Sáb 8am-12m", frecuencia: "3x semana", via: "Pavimentada" },
  "P.S. El Progreso": { km: 2, min: 7, costo: 10000, horario: "L-V 7am-5pm, Sáb 8am-12m", frecuencia: "2x semana", via: "Pavimentada" },
  "P.S. La Venta": { km: 3, min: 9, costo: 14000, horario: "L-V 7am-5pm, Sáb 8am-12m", frecuencia: "2x semana", via: "Pavimentada" },
  "P.S. La Aguadita": { km: 8, min: 20, costo: 40000, horario: "L-V 7:30am-5:30pm, Sáb 8am-12m", frecuencia: "1x semana", via: "Pavimentada parcial" },
  "P.S. La Trinidad": { km: 12, min: 30, costo: 60000, horario: "L-V 7:30am-3:30pm, Sáb 8am-12m", frecuencia: "1x semana", via: "Mixta" },
  "P.S. Bosachoque": { km: 14, min: 40, costo: 70000, horario: "L-V 7:30am-3:30pm", frecuencia: "Quincenal", via: "Trocha ⚠" },
  "P.S. Novillero": { km: 16, min: 45, costo: 80000, horario: "L-V 7:30am-3:30pm", frecuencia: "Quincenal", via: "Trocha ⚠" },
  "P.S. Cumaca": { km: 18, min: 50, costo: 90000, horario: "L-V 7:30am-3:30pm", frecuencia: "Quincenal", via: "Sin asfaltar ⚠" },
  "P.S. Tibacuy": { km: 21, min: 50, costo: 110000, horario: "L-V 8am-5pm, Sáb 8am-12m", frecuencia: "1x semana", via: "Carretera departamental" },
  "P.S. Pasca": { km: 11, min: 23, costo: 55000, horario: "L-V 7am-5pm, Sáb 8am-3pm", frecuencia: "1x semana", via: "Pavimentada" },
};

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

const routeForType: Record<NodeType, { name: string; color: string; filter: RouteFilter } | null> = {
  hub: null,
  subhub: { name: "Ruta A — Urbana", color: "#185FA5", filter: "urbana" },
  urbano: { name: "Ruta A — Urbana", color: "#185FA5", filter: "urbana" },
  rural: { name: "Ruta B — Rural Norte", color: "#0F6E56", filter: "rural_norte" },
  critico: { name: "Ruta C — Rural Crítica", color: "#A32D2D", filter: "rural_critica" },
  intermunicipal: { name: "Ruta D — Intermunicipal", color: "#854F0B", filter: "intermunicipal" },
};

const filterLabels: Record<RouteFilter, string> = {
  all: "Todas",
  urbana: "Urbana",
  rural_norte: "Rural Norte",
  rural_critica: "Rural Crítica",
  intermunicipal: "Intermunicipal",
};

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

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
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<RouteFilter>("all");
  const geocode = useServerFn(geocodeAddresses);
  const fetchRoutes = useServerFn(computeRoutes);

  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<Map<string, any>>(new Map());

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

  // Geocode
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
        puntos.forEach((p) => {
          if (p.lat != null && p.lng != null) {
            resolved.push({ ...p, lat: p.lat, lng: p.lng });
          } else {
            const loc = locByAddress.get(p.address);
            if (loc) resolved.push({ ...p, lat: loc.lat, lng: loc.lng });
          }
        });
        setPoints(resolved);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error geocodificando direcciones");
      }
    })();
    return () => { cancelled = true; };
  }, [geocode]);

  // Render map + markers + routes
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

    const buildIcon = (p: Point, hovered: boolean) => ({
      path: g.SymbolPath.CIRCLE,
      scale: (p.type === "hub" ? 12 : 9) * (hovered ? 1.3 : 1),
      fillColor: typeColors[p.type],
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    });

    markersRef.current.clear();
    polylinesRef.current.clear();

    points.forEach((p) => {
      const marker = new g.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `${p.name} — ${pointMeta[p.name]?.km ?? "?"} km`,
        icon: buildIcon(p, false),
      });
      marker.addListener("click", () => setSelected(p.name));
      marker.addListener("mouseover", () => marker.setIcon(buildIcon(p, true)));
      marker.addListener("mouseout", () => marker.setIcon(buildIcon(p, false)));
      markersRef.current.set(p.name, marker);
    });

    const targets = points
      .filter((p) => p.type !== "hub" && routeForType[p.type])
      .map((p) => ({ point: p, color: routeForType[p.type]!.color }));

    let cancelled = false;
    (async () => {
      try {
        const { results } = await fetchRoutes({
          data: {
            origin: { lat: hub.lat, lng: hub.lng },
            destinations: targets.map((t) => ({ lat: t.point.lat, lng: t.point.lng })),
          },
        });
        if (cancelled) return;
        results.forEach((r, i) => {
          if (!r.polyline) return;
          const path = g.geometry.encoding.decodePath(r.polyline);
          const pl = new g.Polyline({
            map,
            path,
            strokeColor: targets[i].color,
            strokeWeight: 4,
            strokeOpacity: 0.85,
          });
          polylinesRef.current.set(targets[i].point.name, pl);
        });
      } catch (e) {
        console.error("Routes fetch failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      polylinesRef.current.forEach((p) => p.setMap(null));
      markersRef.current.clear();
      polylinesRef.current.clear();
    };
  }, [mapLoaded, points, fetchRoutes]);

  // Apply filter visibility
  useEffect(() => {
    if (!points) return;
    points.forEach((p) => {
      const marker = markersRef.current.get(p.name);
      if (!marker) return;
      const rt = routeForType[p.type];
      const visible = filter === "all" || p.type === "hub" || (rt && rt.filter === filter);
      marker.setMap(visible ? marker.getMap() ?? null : null);
      // Re-attach to map if needed
      if (visible && !marker.getMap()) {
        // no-op: keep referenced map via closure; we set null above so need to reattach
      }
    });
    polylinesRef.current.forEach((pl, name) => {
      const p = points.find((pt) => pt.name === name);
      if (!p) return;
      const rt = routeForType[p.type];
      const visible = filter === "all" || (rt && rt.filter === filter);
      pl.setVisible(!!visible);
    });
  }, [filter, points]);

  // Reattach markers when filter shows them (because setMap(null) loses ref)
  useEffect(() => {
    if (!points || !mapLoaded) return;
    // Build a map instance ref via existing marker if any
    const anyMarker = Array.from(markersRef.current.values())[0];
    const mapInstance = anyMarker?.getMap?.() ?? null;
    if (!mapInstance) return;
    points.forEach((p) => {
      const marker = markersRef.current.get(p.name);
      if (!marker) return;
      const rt = routeForType[p.type];
      const visible = filter === "all" || p.type === "hub" || (rt && rt.filter === filter);
      if (visible) marker.setMap(mapInstance);
      else marker.setMap(null);
    });
  }, [filter, points, mapLoaded]);

  const sortedRows = useMemo(() => {
    return puntos
      .map((p) => ({ ...p, meta: pointMeta[p.name] }))
      .sort((a, b) => (a.meta?.km ?? 0) - (b.meta?.km ?? 0));
  }, []);

  const exportCSV = () => {
    const header = ["Nodo", "Tipo", "Km", "Tiempo (min)", "Costo (COP)", "Frecuencia", "Vía"];
    const rows = sortedRows.map((r) => [
      r.name,
      typeLabels[r.type],
      r.meta?.km ?? "",
      r.meta?.min ?? "",
      r.meta?.costo ?? "",
      r.meta?.frecuencia ?? "",
      r.meta?.via ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "red-distribucion-medicamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedPoint = selected ? puntos.find((p) => p.name === selected) : null;
  const selectedMeta = selected ? pointMeta[selected] : null;
  const selectedRoute = selectedPoint ? routeForType[selectedPoint.type] : null;

  const filters: RouteFilter[] = ["all", "urbana", "rural_norte", "rural_critica", "intermunicipal"];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">
            E.S.E. Hospital San Rafael de Fusagasugá
          </h1>
          <p className="text-sm text-slate-500">
            Red de distribución de medicamentos — interactiva
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600 mr-1">Filtrar rutas:</span>
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {filterLabels[f]}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
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

          {/* Panel lateral */}
          <aside className="space-y-4">
            {selectedPoint && selectedMeta ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{selectedPoint.name}</h2>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: typeColors[selectedPoint.type] }}
                      />
                      <span className="text-xs text-slate-600">{typeLabels[selectedPoint.type]}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                    aria-label="Cerrar"
                  >×</button>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="Distancia" value={`${selectedMeta.km} km`} />
                  <Row label="Tiempo estimado" value={`${selectedMeta.min} min`} />
                  <Row label="Costo de flete" value={formatCOP(selectedMeta.costo)} />
                  <Row label="Horario" value={selectedMeta.horario} />
                  <Row label="Frecuencia" value={selectedMeta.frecuencia} />
                  <Row label="Estado vía" value={selectedMeta.via} />
                  {selectedRoute && <Row label="Ruta asignada" value={selectedRoute.name} />}
                </dl>
                <p className="mt-3 text-xs text-slate-500">{selectedPoint.address}</p>
              </section>
            ) : (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Haz click en un marcador para ver detalles.
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Rutas</h2>
              <ul className="space-y-2">
                {[
                  { name: "Ruta A — Urbana", color: "#185FA5" },
                  { name: "Ruta B — Rural Norte", color: "#0F6E56" },
                  { name: "Ruta C — Rural Crítica", color: "#A32D2D" },
                  { name: "Ruta D — Intermunicipal", color: "#854F0B" },
                ].map((r) => (
                  <li key={r.name} className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="inline-block h-1 w-6 rounded" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        {/* Tabla resumen */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Tabla resumen (ordenada por distancia)</h2>
            <Button size="sm" onClick={exportCSV}>Exportar CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nodo</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2 text-right">Km</th>
                  <th className="px-4 py-2 text-right">Tiempo</th>
                  <th className="px-4 py-2 text-right">Costo</th>
                  <th className="px-4 py-2">Frecuencia</th>
                  <th className="px-4 py-2">Vía</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const critical = r.type === "critico";
                  return (
                    <tr
                      key={r.name}
                      className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${critical ? "bg-red-50 text-red-900" : "text-slate-700"}`}
                      onClick={() => setSelected(r.name)}
                    >
                      <td className="px-4 py-2 font-medium">{r.name}</td>
                      <td className="px-4 py-2">{typeLabels[r.type]}</td>
                      <td className="px-4 py-2 text-right">{r.meta?.km ?? "—"}</td>
                      <td className="px-4 py-2 text-right">{r.meta?.min ?? "—"} min</td>
                      <td className="px-4 py-2 text-right">{r.meta ? formatCOP(r.meta.costo) : "—"}</td>
                      <td className="px-4 py-2">{r.meta?.frecuencia ?? "—"}</td>
                      <td className="px-4 py-2">{r.meta?.via ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
