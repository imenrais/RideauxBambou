import { useQuery } from "@tanstack/react-query";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import Card from "../ui/Card";
import Loading from "../ui/Loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
type TrendPeriod = "day" | "week" | "month" | "year";

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

  // Fetch orders data
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-orders-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/orders?page=1&limit=100&includeStats=true");
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
        const label = hour.toLocaleTimeString("fr-FR", { hour: "2-digit" });
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
  }, [orders, trendPeriod]);

  const lineChartOptions: ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: "#6b7280",
    },
    stroke: { curve: "smooth", width: 3 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: trendBuckets.map((d) => d.label),
      labels: {
        hideOverlappingLabels: false,
        rotate: trendPeriod === "month" || trendPeriod === "year" ? -35 : trendPeriod === "day" ? -45 : 0,
        trim: false,
        style: {
          fontSize: trendPeriod === "month" || trendPeriod === "day" ? "10px" : "12px",
        },
      },
    },
    yaxis: [
      {
        title: { text: "Commandes" },
      },
      {
        opposite: true,
        title: { text: "Revenus (TND)" },
      },
    ],
    colors: ["#16a34a", "#2563eb"],
    legend: { position: "top" },
    grid: { borderColor: "#e5e7eb" },
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
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      offsetY: 8,
      itemMargin: {
        horizontal: 14,
        vertical: 6,
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} commande${value > 1 ? "s" : ""}`,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "62%",
        },
      },
    },
  };

  const statusChartSeries = statusValues;
  const statusTotal = statusValues.reduce((sum, value) => sum + value, 0);

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50 p-0 shadow-md dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="p-5 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {ordersStats.totalOrders || 0}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Commandes Total
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-blue-100 dark:bg-blue-950/50">
              <div className="h-2 w-4/5 rounded-full bg-blue-500" />
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-0 shadow-md dark:from-purple-900/20 dark:to-fuchsia-900/20">
          <div className="p-5 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {products.length}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Produits</div>
            <div className="mt-3 h-2 w-full rounded-full bg-purple-100 dark:bg-purple-950/50">
              <div className="h-2 w-3/4 rounded-full bg-purple-500" />
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-orange-50 to-amber-50 p-0 shadow-md dark:from-orange-900/20 dark:to-amber-900/20">
          <div className="p-5 text-center">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {totalRevenue.toFixed(0)} TND
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Revenus Total
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-orange-100 dark:bg-orange-950/50">
              <div className="h-2 w-5/6 rounded-full bg-orange-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Trend Chart */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 bg-white shadow-md dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Tendances des Commandes et Revenus
          </h3>
          <Chart options={lineChartOptions} series={lineChartSeries as any} type="line" height={420} />
          <div className="mt-4 flex justify-center">
            <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
              {[
                { id: "day", label: "Jour" },
                { id: "week", label: "Semaine" },
                { id: "month", label: "Mois" },
                { id: "year", label: "Année" },
              ].map((period) => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setTrendPeriod(period.id as TrendPeriod)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    trendPeriod === period.id
                      ? "bg-green-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 bg-white shadow-md dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Distribution des Commandes</h3>
          {statusTotal > 0 ? (
            <Chart options={statusChartOptions} series={statusChartSeries} type="donut" height={300} />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              Aucune commande à afficher
            </div>
          )}
        </Card>

        {/* Recent Orders */}
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
                        : order.status === "processing" || order.status === "shipped"
                          ? "text-blue-600"
                          : order.status === "delivered"
                              ? "text-green-600"
                              : "text-red-600"
                    }`}
                  >
                    {order.status === "pending"
                      ? "En Attente"
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
