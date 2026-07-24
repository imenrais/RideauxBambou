import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FiMinus, FiPlus } from "react-icons/fi";

import {
  normalizeGovernorate,
  resolveGovernorateName,
  TUNISIAN_GOVERNORATES,
} from "../../lib/tunisia-locations";

export type GovernorateOrderPoint = {
  name: string;
  count: number;
  revenue: number;
};

export type GovernorateBreakdownRow = GovernorateOrderPoint & {
  percent: number;
  color: string;
  trackClass: string;
};

type OrdersByGovernorateMapProps = {
  points: GovernorateOrderPoint[];
  breakdown?: GovernorateBreakdownRow[];
};

type GeoFeature = {
  type: string;
  properties: {
    shapeName?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type GeoCollection = {
  type: string;
  features: GeoFeature[];
};

const VIEW = { width: 420, height: 680 };
const BOUNDS = { minLon: 7.52, maxLon: 11.6, minLat: 30.23, maxLat: 37.55 };
const BORDER = "#ffffff";

const REGION_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
  "#0ea5e9",
  "#65a30d",
  "#d946ef",
  "#eab308",
  "#2563eb",
  "#db2777",
  "#059669",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#4f46e5",
  "#16a34a",
];

/** Nudge crowded northern labels so names stay readable. */
const LABEL_OFFSETS: Record<string, { dx: number; dy: number; fontSize?: number }> = {
  Tunis: { dx: 2, dy: -10, fontSize: 11 },
  Ariana: { dx: 8, dy: -16, fontSize: 11 },
  "Ben Arous": { dx: 14, dy: 8, fontSize: 10 },
  Manouba: { dx: -16, dy: 2, fontSize: 11 },
  Zaghouan: { dx: 0, dy: 4, fontSize: 11 },
  Nabeul: { dx: 10, dy: 0, fontSize: 11.5 },
  Bizerte: { dx: 0, dy: -4, fontSize: 12 },
  Sousse: { dx: 6, dy: 0, fontSize: 12 },
  Monastir: { dx: 10, dy: 6, fontSize: 11 },
  Mahdia: { dx: 8, dy: 2, fontSize: 11.5 },
  Kairouan: { dx: -2, dy: 0, fontSize: 12 },
  Sfax: { dx: 4, dy: 0, fontSize: 13 },
  Gabès: { dx: 2, dy: 0, fontSize: 12 },
  Médenine: { dx: 4, dy: 0, fontSize: 12 },
  Tataouine: { dx: 0, dy: 8, fontSize: 13 },
  Kébili: { dx: -4, dy: 0, fontSize: 12 },
  Tozeur: { dx: -6, dy: 0, fontSize: 12 },
  Gafsa: { dx: 0, dy: 0, fontSize: 12 },
  "Sidi Bouzid": { dx: 0, dy: 2, fontSize: 11 },
  Kasserine: { dx: -4, dy: 0, fontSize: 12 },
  Kef: { dx: -6, dy: 0, fontSize: 12 },
  Siliana: { dx: 0, dy: 0, fontSize: 12 },
  "Béja": { dx: 0, dy: -2, fontSize: 12 },
  Jendouba: { dx: -4, dy: 0, fontSize: 11.5 },
};

const project = (lon: number, lat: number) => {
  const x = ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * VIEW.width;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * VIEW.height;
  return { x, y };
};

const ringArea = (ring: number[][]) => {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(area / 2);
};

/** Keep only the mainland polygon so islands don’t look like stray bits. */
const largestPolygon = (geometry: GeoFeature["geometry"]): number[][][] => {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as number[][][];
  }
  const polygons = geometry.coordinates as number[][][][];
  let best = polygons[0];
  let bestArea = 0;
  for (const polygon of polygons) {
    const area = ringArea(polygon[0] || []);
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  return best;
};

const ringToPath = (ring: number[][]) =>
  ring
    .map(([lon, lat], index) => {
      const { x, y } = project(lon, lat);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";

const polygonToPath = (polygon: number[][][]) => polygon.map(ringToPath).join(" ");

const polygonCentroid = (polygon: number[][][]) => {
  const ring = polygon[0] || [];
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
    count += 1;
  }
  if (count === 0) {
    return { x: 0, y: 0 };
  }
  return project(sumLon / count, sumLat / count);
};

const matchGovernorateName = (shapeName: string) => {
  const normalized = normalizeGovernorate(shapeName);
  if (normalized === "el kef" || normalized === "le kef") {
    return "Kef";
  }
  const resolved = resolveGovernorateName(shapeName);
  if ((TUNISIAN_GOVERNORATES as readonly string[]).includes(resolved)) {
    return resolved;
  }
  return (
    TUNISIAN_GOVERNORATES.find((name) => normalizeGovernorate(name) === normalized) || shapeName
  );
};

const formatRevenue = (value: number) =>
  `${value.toLocaleString("fr-TN", { maximumFractionDigits: 0 })} TND`;

export default function OrdersByGovernorateMap({
  points,
  breakdown = [],
}: OrdersByGovernorateMapProps) {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampPan = (next: { x: number; y: number }, nextZoom = zoom) => {
    if (nextZoom <= 1) {
      return { x: 0, y: 0 };
    }
    const maxX = (VIEW.width * (nextZoom - 1)) / 2 + 40;
    const maxY = (VIEW.height * (nextZoom - 1)) / 2 + 40;
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = Math.max(0.85, Math.min(2.4, Number(nextZoom.toFixed(1))));
    setZoom(clampedZoom);
    setPan((current) => clampPan(current, clampedZoom));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/maps/tunisia-governorates.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("map_load_failed");
        }
        return response.json();
      })
      .then((data: GeoCollection) => {
        if (!cancelled) {
          setGeo(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statsByName = useMemo(() => {
    const map = new Map<string, GovernorateOrderPoint>();
    for (const point of points) {
      map.set(point.name, point);
    }
    return map;
  }, [points]);

  const regions = useMemo(() => {
    if (!geo) {
      return [];
    }
    return geo.features.map((feature, index) => {
      const shapeName = String(feature.properties.shapeName || "");
      const name = matchGovernorateName(shapeName);
      const mainland = largestPolygon(feature.geometry);
      const stats = statsByName.get(name);
      const offset = LABEL_OFFSETS[name] || { dx: 0, dy: 0, fontSize: 9 };
      const centroid = polygonCentroid(mainland);
      return {
        id: `${name}-${index}`,
        name,
        path: polygonToPath(mainland),
        color: REGION_COLORS[index % REGION_COLORS.length],
        centroid,
        labelX: centroid.x + offset.dx,
        labelY: centroid.y + offset.dy,
        fontSize: offset.fontSize ?? 12,
        count: stats?.count || 0,
        revenue: stats?.revenue || 0,
      };
    });
  }, [geo, statsByName]);

  const markedRegions = useMemo(
    () => regions.filter((region) => region.count > 0),
    [regions]
  );

  const hoveredRegion = regions.find((region) => region.name === hovered) ?? null;

  const tooltip = useMemo(() => {
    if (!hoveredRegion) {
      return null;
    }
    const width = Math.max(118, hoveredRegion.name.length * 7.2 + 24);
    const height = 58;
    let x = hoveredRegion.centroid.x - width / 2;
    let y = hoveredRegion.centroid.y - height - 18;
    x = Math.max(8, Math.min(VIEW.width - width - 8, x));
    y = Math.max(8, Math.min(VIEW.height - height - 8, y));
    return { x, y, width, height, region: hoveredRegion };
  }, [hoveredRegion]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (zoom <= 1) {
      return;
    }
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag?.active) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
      setHovered(null);
    }
    setPan(clampPan({ x: drag.originX + dx, y: drag.originY + dy }));
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      dragRef.current.moved = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
    setIsDragging(false);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950/40">
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_0.85fr]">
        <div className="relative min-w-0">
          <div className="absolute left-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-slate-700 shadow-sm dark:border-gray-600">
            <button
              type="button"
              onClick={() => updateZoom(zoom + 0.2)}
              className="flex h-8 w-8 items-center justify-center text-white transition hover:bg-slate-600"
              aria-label="Zoom avant"
            >
              <FiPlus className="h-4 w-4" />
            </button>
            <div className="h-px bg-slate-500" />
            <button
              type="button"
              onClick={() => updateZoom(zoom - 0.2)}
              className="flex h-8 w-8 items-center justify-center text-white transition hover:bg-slate-600"
              aria-label="Zoom arrière"
            >
              <FiMinus className="h-4 w-4" />
            </button>
          </div>

          {zoom > 1 ? (
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-800/80 px-3 py-1 text-[11px] text-white">
              Glissez pour déplacer la carte
            </div>
          ) : null}

          <div className="flex min-h-[308px] items-center justify-center p-2 sm:min-h-[528px] sm:p-3">
            {loadError ? (
              <p className="text-sm text-red-500">Impossible de charger la carte</p>
            ) : !geo ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chargement de la carte...</p>
            ) : (
              <svg
                viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
                className={`h-[308px] w-full max-w-[440px] touch-none sm:h-[528px] ${
                  zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
                }`}
                role="img"
                aria-label="Carte des commandes par gouvernorat"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
            <defs>
              <clipPath id="tunisia-map-clip">
                <rect x="0" y="0" width={VIEW.width} height={VIEW.height} />
              </clipPath>
              <filter id="tooltip-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
              </filter>
            </defs>
            <g
              transform={`translate(${VIEW.width / 2 + pan.x} ${VIEW.height / 2 + pan.y}) scale(${zoom}) translate(${-VIEW.width / 2} ${-VIEW.height / 2})`}
            >
              <g clipPath="url(#tunisia-map-clip)">
                {regions.map((region) => {
                  const isActive = hovered === region.name;
                  return (
                    <path
                      key={region.id}
                      d={region.path}
                      fill={region.color}
                      fillOpacity={isActive ? 1 : 0.88}
                      stroke={BORDER}
                      strokeWidth={isActive ? 2.2 : 1.3}
                      strokeLinejoin="round"
                      className={zoom > 1 ? "cursor-grab" : "cursor-pointer"}
                      onMouseEnter={() => {
                        if (!dragRef.current?.moved) {
                          setHovered(region.name);
                        }
                      }}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })}
              </g>

              {regions.map((region) => (
                <text
                  key={`label-${region.id}`}
                  x={region.labelX}
                  y={region.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fontSize={region.fontSize}
                  fontWeight={700}
                  fill="#111827"
                  stroke="#ffffff"
                  strokeWidth={3}
                  paintOrder="stroke"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {region.name}
                </text>
              ))}

              {markedRegions.map((region) => (
                <g
                  key={`marker-${region.id}`}
                  className={zoom > 1 ? "cursor-grab" : "cursor-pointer"}
                  onMouseEnter={() => {
                    if (!dragRef.current?.moved) {
                      setHovered(region.name);
                    }
                  }}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle
                    cx={region.centroid.x}
                    cy={region.centroid.y + 10}
                    r={8}
                    fill="#4b5563"
                    opacity={hovered === region.name ? 1 : 0.92}
                  />
                  <circle
                    cx={region.centroid.x}
                    cy={region.centroid.y + 10}
                    r={4}
                    fill="#ffffff"
                  />
                </g>
              ))}

              {tooltip ? (
                <g
                  transform={`translate(${tooltip.x}, ${tooltip.y})`}
                  className="pointer-events-none"
                  filter="url(#tooltip-shadow)"
                >
                  <rect
                    width={tooltip.width}
                    height={tooltip.height}
                    rx={8}
                    fill="#ffffff"
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                  <text
                    x={12}
                    y={18}
                    fontSize={11}
                    fontWeight={700}
                    fill="#1f2937"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {tooltip.region.name}
                  </text>
                  <text
                    x={12}
                    y={34}
                    fontSize={10}
                    fill="#4b5563"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {tooltip.region.count} commande{tooltip.region.count > 1 ? "s" : ""}
                  </text>
                  <text
                    x={12}
                    y={48}
                    fontSize={10}
                    fontWeight={600}
                    fill="#059669"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {formatRevenue(tooltip.region.revenue)}
                  </text>
                </g>
              ) : null}
            </g>
          </svg>
            )}
          </div>
        </div>

        <div className="flex justify-start p-4 pt-5 sm:p-6 sm:pt-6 lg:justify-end lg:pt-8">
          {breakdown.length > 0 ? (
            <div className="max-h-[240px] w-full max-w-[240px] space-y-2 overflow-y-auto sm:max-h-[480px] sm:max-w-[280px] sm:space-y-5 lg:max-w-[320px]">
              {breakdown.map((row) => (
                <div key={row.name}>
                  <div className="mb-1 flex items-center gap-2 sm:mb-2 sm:gap-3">
                    <div className={`h-1.5 flex-1 overflow-hidden rounded-full sm:h-2.5 ${row.trackClass}`}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${row.percent}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs font-bold text-gray-900 sm:w-12 sm:text-sm dark:text-white">
                      {row.percent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium text-sky-600 dark:text-sky-400">{row.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {row.count} commande{row.count > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[140px] items-center justify-center text-xs text-gray-500 sm:min-h-[160px] sm:text-sm dark:text-gray-400">
              Aucune commande avec gouvernorat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
