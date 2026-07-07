import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import Navigation from "../../components/Navigation";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Loading from "../../components/ui/Loading";

interface UserOrdersProps {
  title: string;
}

export default function UserOrders({ title }: UserOrdersProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login?callbackUrl=/profile/orders");
    }
  }, [session, status, router]);

  // Fetch user orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["user-orders"],
    queryFn: async () => {
      const response = await fetch("/api/orders");
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: !!session,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "warning";
      case "processing":
      case "shipped":
        return "info";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "processing":
      case "shipped":
        return "Processing";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const filteredOrders =
    ordersData?.filter(
      (order: any) =>
        selectedStatus === "all" ||
        order.status === selectedStatus ||
        (selectedStatus === "processing" && order.status === "shipped")
    ) || [];

  if (status === "loading" || isLoading) {
    return <Loading fullScreen text="Loading..." />;
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="My Orders - Dream Décor" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Orders</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Track and manage your orders</p>
            </div>

            {/* Filter */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Order History
                </h2>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 sm:w-auto dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </Card>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto max-w-md">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    No orders found
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {selectedStatus === "all"
                      ? "You haven't placed any orders yet."
                      : `No ${selectedStatus} orders found.`}
                  </p>
                  <div className="mt-6">
                    <Button
                      onClick={() => router.push("/#boutique")}
                      className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      Start Shopping
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {filteredOrders.map((order: any) => (
                  <Card key={order._id} className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Order #{order._id.slice(-8)}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Placed on {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Total Amount
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {order.totalAmount?.toFixed(2)} TND
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Items
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {order.items?.length || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Delivery
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {order.customerInfo?.city || "N/A"}
                            </p>
                          </div>
                        </div>

                        {/* Order Items */}
                        {order.items && order.items.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Items:
                            </h4>
                            <div className="mt-2 space-y-2">
                              {order.items.map((item: any, index: number) => (
                                <div key={index} className="flex items-center space-x-3">
                                  <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {item.curtainTypeName || "Curtain"}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {item.dimensions} - {item.totalCost?.toFixed(2)} TND
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 lg:ml-6">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full lg:w-auto"
                          onClick={() => router.push(`/orders/${order._id}`)}
                        >
                          View Details
                        </Button>
                        {order.status === "delivered" && (
                          <Button variant="secondary" size="sm" className="w-full lg:w-auto">
                            Reorder
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "My Orders - Dream Décor",
    },
  };
};
