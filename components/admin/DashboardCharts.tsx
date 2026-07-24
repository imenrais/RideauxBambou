import { useQuery } from "@tanstack/react-query";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiMenu } from "react-icons/fi";

import { CUSTOMER_TYPE_LABELS, resolveCustomerType } from "../../lib/customer-info";
import { resolveGovernorateName, TUNISIAN_GOVERNORATES } from "../../lib/tunisia-locations";
import Card from "../ui/Card";
import Loading from "../ui/Loading";
import OrdersByGovernorateMap from "./OrdersByGovernorateMap";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
type TrendPeriod = "day" | "week" | "month" | "year";

const PERIOD_OPTIONS: Array<{ id: TrendPeriod; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "year", label: "Année" },
];

function ChartPeriodHeader({
  title,
  period,
  onPeriodChange,
  legend,
}: {
  title: string;
  period: TrendPeriod;
  onPeriodChange: (period: TrendPeriod) => void;
  legend: Array<{ label: string; color: string }>;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentLabel = PERIOD_OPTIONS.find((option) => option.id === period)?.label ?? period;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="mb-4">
      <div className="flex items-start justify-between gap-2 sm:h-auto sm:items-center sm:gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-700 sm:text-lg dark:text-white">
          {title}
        </h3>
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-violet-300 bg-white px-2.5 text-xs font-medium text-violet-600 transition hover:bg-violet-50 sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-sm dark:border-violet-400/60 dark:bg-transparent dark:text-violet-300 dark:hover:bg-violet-950/40"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            {currentLabel}
            <FiChevronDown className={`h-3.5 w-3.5 transition sm:h-4 sm:w-4 ${open ? "rotate-180" : ""}`} />
          </button>
          {open ? (
            <div
              role="listbox"
              className="absolute right-0 z-20 mt-1.5 min-w-full overflow-hidden rounded-xl border border-violet-200 bg-white py-1 shadow-lg dark:border-violet-500/30 dark:bg-gray-900"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={period === option.id}
                  onClick={() => {
                    onPeriodChange(option.id);
                    setOpen(false);
                  }}
                  className={`block w-full px-3.5 py-2 text-left text-sm transition ${
                    period === option.id
                      ? "bg-violet-50 font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                      : "text-slate-600 hover:bg-violet-50 dark:text-slate-300 dark:hover:bg-violet-950/30"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
        <div className="flex min-h-9 flex-row items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-slate-300"
            aria-label="Options du graphique"
          >
            <FiMenu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const localDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const localHourKey = (date: Date) => `${localDayKey(date)}-${String(date.getHours()).padStart(2, "0")}`;

const localMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default function DashboardCharts() {
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("week");
  const [conversionPeriod, setConversionPeriod] = useState<TrendPeriod>("year");
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Fetch orders data (dedicated key so orders-page optimistic cache cannot blank this chart)
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-dashboard-charts-orders"],
    queryFn: async () => {
      const response = await fetch("/api/admin/orders?page=1&limit=1000&includeStats=true");
      const data = await response.json();
      return data.success ? data.data : { orders: [], stats: {} };
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Fetch products data
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/products");
      const data = await response.json();
      return data.success ? data.data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Fetch delivery fees data
  const { isLoading: deliveryFeesLoading } = useQuery({
    queryKey: ["admin-delivery-fees-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/delivery-fees");
      const data = await response.json();
      return data.success ? data.data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const orders = ordersData?.orders || [];
  const ordersStats = ordersData?.stats || {};
  const products = productsData || [];

  // Calculate recent orders (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentOrders = orders.filter((order: any) => new Date(order.createdAt) >= sevenDaysAgo);

  // Calculate total revenue
  const totalRevenue = orders.reduce(
    (sum: number, order: any) => sum + (order.totalAmount || 0),
    0
  );

  const getCustomerFullName = (order: any) => {
    const firstName = order?.customerInfo?.firstName?.trim() || "";
    const lastName = order?.customerInfo?.lastName?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || order?.userId?.name || "Client";
  };

  const trendBuckets = useMemo(() => {
    const now = new Date();
    const buckets: Array<{ key: string; label: string; orders: number; revenue: number }> = [];

    if (trendPeriod === "day") {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      for (let i = 0; i < 24; i += 1) {
        const hour = new Date(base);
        hour.setHours(i, 0, 0, 0);
        const key = localHourKey(hour);
        const label = isCompact
          ? `${hour.getHours()}h`
          : hour.toLocaleTimeString("fr-FR", { hour: "2-digit" });
        buckets.push({ key, label, orders: 0, revenue: 0 });
      }
    } else if (trendPeriod === "week") {
      // 7 derniers jours complets (aujourd'hui inclus)
      for (let i = 6; i >= 0; i -= 1) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const key = localDayKey(day);
        const label = day.toLocaleDateString("fr-FR", { weekday: "short" });
        buckets.push({ key, label, orders: 0, revenue: 0 });
      }
    } else if (trendPeriod === "month") {
      // Tous les jours du mois courant
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), dayNumber, 0, 0, 0, 0);
        const key = localDayKey(day);
        const label = day.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        buckets.push({ key, label, orders: 0, revenue: 0 });
      }
    } else {
      // 12 mois de l'année courante
      for (let i = 0; i < 12; i += 1) {
        const month = new Date(now.getFullYear(), i, 1);
        const key = localMonthKey(month);
        const label = month.toLocaleDateString("fr-FR", { month: "short" });
        buckets.push({ key, label, orders: 0, revenue: 0 });
      }
    }

    for (const order of orders) {
      const date = new Date(order.createdAt);
      let key = "";
      if (trendPeriod === "day") {
        key = localHourKey(date);
      } else if (trendPeriod === "year") {
        key = localMonthKey(date);
      } else {
        key = localDayKey(date);
      }
      const target = buckets.find((bucket) => bucket.key === key);
      if (target) {
        target.orders += 1;
        target.revenue += order.totalAmount || 0;
      }
    }

    return buckets;
  }, [orders, trendPeriod, isCompact]);

  const conversionMetrics = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (conversionPeriod === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (conversionPeriod === "week") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (conversionPeriod === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }

    let successful = 0;
    let cancelled = 0;

    for (const order of orders) {
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime()) || date < start || date > end) {
        continue;
      }

      const status = String(order.status || "")
        .trim()
        .toLowerCase();

      if (status === "confirmed" || status === "processing" || status === "shipped" || status === "delivered") {
        successful += 1;
      } else if (status === "cancelled") {
        cancelled += 1;
      }
    }

    const decided = successful + cancelled;
    const percent = decided > 0 ? Number(((successful / decided) * 100).toFixed(1)) : 0;

    return { successful, cancelled, decided, percent };
  }, [orders, conversionPeriod]);
  const lineChartOptions: ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: "#6b7280",
      fontFamily: "inherit",
      parentHeightOffset: 0,
    },
    stroke: { curve: "smooth", width: isCompact ? 2.5 : 3 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: trendBuckets.map((d) => d.label),
      tickPlacement: "on",
      labels: {
        hideOverlappingLabels: false,
        showDuplicates: false,
        rotate:
          trendPeriod === "week"
            ? 0
            : isCompact
              ? trendPeriod === "year"
                ? -40
                : -55
              : trendPeriod === "month" || trendPeriod === "year"
                ? -35
                : trendPeriod === "day"
                  ? -45
                  : 0,
        rotateAlways: isCompact && trendPeriod !== "week",
        trim: false,
        offsetY: isCompact && trendPeriod !== "week" ? 4 : 0,
        maxHeight: isCompact ? 72 : 120,
        style: {
          fontSize: isCompact ? "11px" : trendPeriod === "month" || trendPeriod === "day" ? "10px" : "12px",
          fontWeight: 500,
          cssClass: "trend-xaxis-label",
        },
      },
    },
    yaxis: [
      {
        title: { text: "Commandes" },
        labels: {
          style: { fontSize: isCompact ? "11px" : "12px" },
        },
      },
      {
        opposite: true,
        title: { text: "Revenus (TND)" },
        labels: {
          style: { fontSize: isCompact ? "11px" : "12px" },
        },
      },
    ],
    colors: ["#16a34a", "#2563eb"],
    legend: { show: false },
    grid: {
      borderColor: "#e5e7eb",
      padding: {
        left: isCompact ? 8 : 10,
        right: isCompact ? 8 : 10,
        bottom: isCompact && trendPeriod !== "week" ? 12 : 0,
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      custom: ({ series, dataPointIndex, w }) => {
        const category =
          w.globals.categoryLabels?.[dataPointIndex] ??
          w.globals.labels?.[dataPointIndex] ??
          "";
        const colors = w.globals.colors || ["#16a34a", "#2563eb"];
        const names = w.globals.seriesNames || ["Commandes", "Revenus"];
        const rows = names
          .map((name: string, index: number) => {
            const raw = series?.[index]?.[dataPointIndex];
            if (raw === undefined || raw === null) {
              return "";
            }
            const value =
              index === 1
                ? `${Number(raw).toFixed(2)} TND`
                : `${raw} commande${Number(raw) > 1 ? "s" : ""}`;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:4px;">
              <span style="display:flex;align-items:center;gap:6px;color:${colors[index]};font-weight:600;">
                <span style="width:8px;height:8px;border-radius:9999px;background:${colors[index]};display:inline-block;"></span>
                ${name}
              </span>
              <span style="color:#111827;font-weight:600;">${value}</span>
            </div>`;
          })
          .join("");
        return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;box-shadow:0 4px 12px rgba(0,0,0,.08);">
          <div style="color:#111827;font-weight:700;margin-bottom:4px;">${category}</div>
          ${rows}
        </div>`;
      },
    },
  };

  const lineChartSeries = [
    { name: "Commandes", type: "line", data: trendBuckets.map((d) => d.orders) },
    {
      name: "Revenus",
      type: "line",
      data: trendBuckets.map((d) => Number(d.revenue.toFixed(2))),
    },
  ];

  const statusLabels = ["En attente", "Confirmées", "En cours", "Livrées", "Annulées"];
  const statusLegendColors = ["#f59e0b", "#3b82f6", "#8b5cf6", "#22c55e", "#ef4444"];
  const statusValues = [
    ordersStats.pendingOrders || 0,
    ordersStats.confirmedOrders || 0,
    ordersStats.processingOrders || 0,
    ordersStats.deliveredOrders || 0,
    ordersStats.cancelledOrders || 0,
  ];

  const statusChartOptions: ApexOptions = {
    chart: { foreColor: "#6b7280" },
    labels: statusLabels,
    dataLabels: { enabled: true },
    colors: statusLegendColors,
    legend: { show: false },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} commande${value > 1 ? "s" : ""}`,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
        },
      },
    },
  };

  const statusChartSeries = statusValues;
  const statusTotal = statusValues.reduce((sum, value) => sum + value, 0);

  const sideChartHeight = isCompact ? 240 : 300;
  const distributionChartHeight = isCompact ? 220 : 260;
  const trendNeedsScroll =
    isCompact && (trendPeriod === "day" || trendPeriod === "month" || trendPeriod === "year");
  const trendChartMinWidth = trendNeedsScroll
    ? trendPeriod === "day"
      ? Math.max(trendBuckets.length * 40, 720)
      : trendPeriod === "month"
        ? Math.max(trendBuckets.length * 52, 980)
        : Math.max(trendBuckets.length * 56, 600)
    : undefined;
  const trendChartHeight = isCompact
    ? trendPeriod === "week"
      ? 260
      : 310
    : 420;

  const conversionAccent = "#7c3aed";

  const conversionRadialOptions: ApexOptions = {
    chart: {
      type: "radialBar",
      toolbar: { show: false },
      foreColor: "#6b7280",
    },
    colors: [conversionAccent],
    plotOptions: {
      radialBar: {
        hollow: {
          size: "70%",
        },
        track: {
          background: "#e5e7eb",
          strokeWidth: "100%",
          margin: 0,
        },
        dataLabels: {
          name: {
            show: false,
          },
          value: {
            show: true,
            fontSize: "42px",
            fontWeight: 700,
            color: conversionAccent,
            offsetY: 8,
            formatter: (value: number) => `${Math.round(value)}%`,
          },
        },
      },
    },
    stroke: {
      lineCap: "round",
    },
    labels: ["Converties"],
    legend: { show: false },
    tooltip: {
      enabled: true,
      y: {
        formatter: () =>
          `${conversionMetrics.successful} commande${conversionMetrics.successful > 1 ? "s" : ""} convertie${conversionMetrics.successful > 1 ? "s" : ""} (${Math.round(conversionMetrics.percent)}%)`,
      },
    },
  };

  const conversionRadialSeries = [conversionMetrics.percent];

  const clientTypeBreakdown = useMemo(() => {
    let company = 0;
    let person = 0;

    for (const order of orders) {
      if (resolveCustomerType(order?.customerInfo?.customerType) === "company") {
        company += 1;
      } else {
        person += 1;
      }
    }

    const total = company + person;
    const rows = [
      {
        key: "company" as const,
        label: CUSTOMER_TYPE_LABELS.company,
        count: company,
        color: "#0d9488",
        trackClass: "bg-teal-100 dark:bg-teal-950/50",
      },
      {
        key: "person" as const,
        label: CUSTOMER_TYPE_LABELS.person,
        count: person,
        color: "#3b82f6",
        trackClass: "bg-blue-100 dark:bg-blue-950/50",
      },
    ];

    return {
      total,
      rows: rows.map((row) => ({
        ...row,
        percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
      })),
    };
  }, [orders]);

  const ordersByGovernorate = useMemo(() => {
    const counts = new Map<string, { count: number; revenue: number }>();
    const known = new Set<string>(TUNISIAN_GOVERNORATES);

    for (const order of orders) {
      const rawState = String(order?.customerInfo?.state || "").trim();
      if (!rawState) {
        continue;
      }
      const name = resolveGovernorateName(rawState);
      if (!name || !known.has(name)) {
        continue;
      }
      const current = counts.get(name) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(order.totalAmount) || 0;
      counts.set(name, current);
    }

    return Array.from(counts.entries())
      .map(([name, stats]) => ({ name, count: stats.count, revenue: stats.revenue }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  }, [orders]);

  const governorateBreakdown = useMemo(() => {
    const totalOrders = orders.length;
    const palette = [
      "#0d9488",
      "#3b82f6",
      "#f59e0b",
      "#a855f7",
      "#ef4444",
      "#06b6d4",
      "#84cc16",
      "#ec4899",
      "#6366f1",
      "#f97316",
    ];
    return ordersByGovernorate.map((row, index) => ({
      ...row,
      percent: totalOrders > 0 ? Math.round((row.count / totalOrders) * 100) : 0,
      color: palette[index % palette.length],
      trackClass:
        index % 2 === 0 ? "bg-teal-100 dark:bg-teal-950/50" : "bg-blue-100 dark:bg-blue-950/50",
    }));
  }, [orders.length, ordersByGovernorate]);

  if (ordersLoading || productsLoading || deliveryFeesLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Loading text="Chargement des statistiques..." />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          {
            key: "orders",
            value: String(ordersStats.totalOrders || 0),
            suffix: null as string | null,
            label: "Commandes",
            labelFull: "Commandes Total",
            accent: "border-t-blue-500",
            valueClass: "text-blue-600 dark:text-blue-400",
            soft: "bg-blue-50/70 dark:bg-blue-950/20",
          },
          {
            key: "products",
            value: String(products.length),
            suffix: null as string | null,
            label: "Produits",
            labelFull: "Produits",
            accent: "border-t-teal-500",
            valueClass: "text-teal-600 dark:text-teal-400",
            soft: "bg-teal-50/70 dark:bg-teal-950/20",
          },
          {
            key: "revenue",
            value: totalRevenue.toFixed(0),
            suffix: "TND",
            label: "Revenus",
            labelFull: "Revenus Total",
            accent: "border-t-amber-500",
            valueClass: "text-amber-600 dark:text-amber-400",
            soft: "bg-amber-50/70 dark:bg-amber-950/20",
          },
        ].map((stat) => (
          <div
            key={stat.key}
            className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border border-gray-200/80 border-t-[3px] ${stat.accent} ${stat.soft} px-1.5 py-2.5 text-center shadow-sm dark:border-gray-700/70 sm:min-h-[5.5rem] sm:rounded-2xl sm:px-3 sm:py-3.5`}
          >
            <p
              className={`flex h-7 items-baseline justify-center gap-0.5 text-lg font-bold leading-none tracking-tight sm:h-9 sm:text-2xl ${stat.valueClass}`}
            >
              <span>{stat.value}</span>
              {stat.suffix ? (
                <span className="text-[9px] font-semibold opacity-80 sm:text-xs">{stat.suffix}</span>
              ) : null}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-gray-600 dark:text-gray-300 sm:mt-1.5 sm:text-xs">
              <span className="sm:hidden">{stat.label}</span>
              <span className="hidden sm:inline">{stat.labelFull}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Main Trend Chart */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 bg-white shadow-md dark:bg-gray-900">
          <ChartPeriodHeader
            title="Tendances des Commandes et Revenus"
            period={trendPeriod}
            onPeriodChange={setTrendPeriod}
            legend={[
              { label: "Commandes", color: "#16a34a" },
              { label: "Revenus", color: "#2563eb" },
            ]}
          />
          <div
            className={
              trendNeedsScroll
                ? "-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]"
                : undefined
            }
          >
            <div style={trendChartMinWidth ? { minWidth: trendChartMinWidth } : undefined}>
              <Chart
                key={`trend-${trendPeriod}-${isCompact ? "compact" : "wide"}`}
                options={lineChartOptions}
                series={lineChartSeries as any}
                type="line"
                height={trendChartHeight}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full min-h-[300px] flex-col border-0 bg-white shadow-md sm:min-h-[420px] dark:bg-gray-900">
          <ChartPeriodHeader
            title="Taux de conversion"
            period={conversionPeriod}
            onPeriodChange={setConversionPeriod}
            legend={[{ label: "Confirmées · En cours · Livrées", color: conversionAccent }]}
          />
          {conversionMetrics.decided > 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <Chart
                key={`conversion-radial-${conversionPeriod}-${conversionMetrics.successful}-${conversionMetrics.cancelled}`}
                options={conversionRadialOptions}
                series={conversionRadialSeries}
                type="radialBar"
                height={sideChartHeight}
              />
            </div>
          ) : (
            <div
              className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
              style={{ minHeight: sideChartHeight }}
            >
              Aucune commande convertie ou annulée sur cette période
            </div>
          )}
        </Card>

        <Card className="flex h-full min-h-[280px] flex-col border-0 bg-white shadow-md sm:min-h-[420px] dark:bg-gray-900">
          <div className="mb-[27px] sm:mb-4">
            <div className="flex items-center justify-between gap-3 sm:h-10">
              <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-700 sm:text-lg sm:leading-none dark:text-white">
                Distribution des Commandes
              </h3>
              <span className="invisible hidden h-9 w-[5.5rem] shrink-0 sm:block" aria-hidden="true" />
            </div>
            <div className="mt-3 hidden border-t border-transparent pt-3 sm:block" aria-hidden="true">
              <div className="min-h-9" />
            </div>
          </div>
          {statusTotal > 0 ? (
            <div className="flex flex-1 flex-col items-center justify-start pt-1.5 sm:justify-center sm:pt-0">
              <Chart
                options={statusChartOptions}
                series={statusChartSeries}
                type="donut"
                height={distributionChartHeight}
              />
              <div className="mt-3 flex min-h-[24px] w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 px-1 text-xs font-medium text-slate-500 sm:mt-10 sm:flex-nowrap sm:text-sm dark:text-slate-400">
                {statusLabels.map((label, index) => (
                  <div key={label} className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: statusLegendColors[index] }}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
              style={{ minHeight: distributionChartHeight }}
            >
              Aucune commande à afficher
            </div>
          )}
        </Card>
      </div>

      <Card className="border-0 bg-white shadow-md dark:bg-gray-900">
        <div className="mb-4 border-b border-gray-200 pb-3 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-white">
            Commandes par gouvernorat
          </h3>
        </div>
        <OrdersByGovernorateMap points={ordersByGovernorate} breakdown={governorateBreakdown} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 bg-white shadow-md dark:bg-gray-900">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Commandes par type de client
            </h3>
          </div>
          {clientTypeBreakdown.total > 0 ? (
            <div className="space-y-5">
              {clientTypeBreakdown.rows.map((row) => (
                <div key={row.key}>
                  <div className="mb-2 flex items-center gap-3">
                    <div className={`h-2.5 flex-1 overflow-hidden rounded-full ${row.trackClass}`}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${row.percent}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-bold text-gray-900 dark:text-white">
                      {row.percent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-sky-600 dark:text-sky-400">{row.label}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {row.count} commande{row.count > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[160px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              Aucune commande à afficher
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Commandes Récentes
          </h3>
          <div className="space-y-3">
            {recentOrders.slice(0, 5).map((order: any) => (
              <div
                key={order._id}
                className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    Commande #{order._id.slice(-8)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {getCustomerFullName(order)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {order.totalAmount?.toFixed(2)} TND
                  </div>
                  <div
                    className={`text-sm ${
                      order.status === "pending"
                        ? "text-yellow-600"
                        : order.status === "confirmed"
                          ? "text-green-600"
                          : order.status === "processing" || order.status === "shipped"
                            ? "text-blue-600"
                            : order.status === "delivered"
                              ? "text-green-600"
                              : "text-red-600"
                    }`}
                  >
                    {order.status === "pending"
                      ? "En Attente"
                      : order.status === "confirmed"
                        ? "Confirmée"
                        : order.status === "processing" || order.status === "shipped"
                          ? "En Cours"
                          : order.status === "delivered"
                            ? "Livrée"
                            : "Annulée"}
                  </div>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                Aucune commande récente
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
