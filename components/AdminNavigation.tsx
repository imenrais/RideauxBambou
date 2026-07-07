import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

import DarkModeToggle from "./DarkModeToggle";

interface AdminOrderNotification {
  orderId: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  status: string;
  read: boolean;
}

export default function AdminNavigation() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminOrderNotification[]>([]);

  const { data: recentOrdersData } = useQuery({
    queryKey: ["admin-notification-center-orders"],
    queryFn: async () => {
      const response = await fetch("/api/admin/orders?page=1&limit=10");
      const data = await response.json();
      return data.success ? data.data : { orders: [] };
    },
    enabled: session?.user?.role === "admin",
    refetchInterval: 20000,
  });

  useEffect(() => {
    const saved = localStorage.getItem("admin-order-notifications");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setNotifications(parsed);
      }
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.role || session.user.role !== "admin") {
      return;
    }

    const incomingOrders = recentOrdersData?.orders || [];
    if (!incomingOrders.length) {
      return;
    }

    setNotifications((prev) => {
      const merged = [...prev];

      for (const order of incomingOrders) {
        const existingIndex = merged.findIndex((n) => n.orderId === order._id);
        const incomingPayload: AdminOrderNotification = {
          orderId: order._id,
          customerName: `${order.customerInfo?.firstName || ""} ${order.customerInfo?.lastName || ""}`.trim(),
          totalAmount: Number(order.totalAmount || 0),
          createdAt: order.createdAt,
          status: order.status || "pending",
          read: false,
        };

        if (existingIndex === -1) {
          merged.unshift(incomingPayload);
        } else {
          merged[existingIndex] = {
            ...merged[existingIndex],
            ...incomingPayload,
            read: merged[existingIndex].read,
          };
        }
      }

      localStorage.setItem("admin-order-notifications", JSON.stringify(merged));
      return merged;
    });
  }, [recentOrdersData, session?.user?.role]);

  const persistNotifications = (items: AdminOrderNotification[]) => {
    setNotifications(items);
    localStorage.setItem("admin-order-notifications", JSON.stringify(items));
  };

  const markOrderAsRead = (orderId: string) => {
    const updated = notifications.map((item) =>
      item.orderId === orderId ? { ...item, read: true } : item
    );
    persistNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((item) => ({ ...item, read: true }));
    persistNotifications(updated);
  };

  const deleteNotification = (orderId: string) => {
    const updated = notifications.filter((item) => item.orderId !== orderId);
    persistNotifications(updated);
  };

  const deleteAllNotifications = () => {
    persistNotifications([]);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const toggleMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isProfileOpen) {
        if (!target.closest("[data-profile-dropdown]")) {
          setIsProfileOpen(false);
        }
      }
      if (isNotificationsOpen && !target.closest("[data-notification-dropdown]")) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen, isNotificationsOpen]);

  const adminMenuItems = [
    { href: "/admin", label: "Tableau de Bord" },
    { href: "/admin/orders", label: "Commandes" },
    { href: "/admin/products", label: "Produits" },
    { href: "/admin/users", label: "Travailleurs" },
    { href: "/admin/delivery-fees", label: "Frais de Livraison" },
    { href: "/admin/reviews", label: "Avis" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center space-x-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full">
              <Image
                src="/logo.png"
                alt="Rideaux Bambou Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <h1 className="hidden text-lg font-bold text-gray-900 transition-colors group-hover:text-gray-700 sm:block lg:text-2xl dark:text-white dark:group-hover:text-gray-300">
                Rideaux Bambou
              </h1>
              <span className="hidden text-xs text-gray-500 sm:block dark:text-gray-400">Admin</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-6 lg:flex">
            {adminMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* Notifications */}
            <div className="relative" data-notification-dropdown>
              <button
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileOpen(false);
                }}
                className="relative rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Notifications"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {notifications.filter((item) => !item.read).length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                    {notifications.filter((item) => !item.read).length > 9
                      ? "9+"
                      : notifications.filter((item) => !item.read).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-[92vw] max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Notifications
                      </h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-medium text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                        >
                          Tout marquer comme lu
                        </button>
                        <button
                          onClick={deleteAllNotifications}
                          className="text-xs font-medium text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Tout supprimer
                        </button>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                          Aucune notification.
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const isUnread = !item.read;
                          return (
                            <div
                              key={item.orderId}
                              onClick={() => {
                                markOrderAsRead(item.orderId);
                                setIsNotificationsOpen(false);
                                router.push("/admin/orders");
                              }}
                              className={`w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40 ${
                                isUnread ? "bg-green-50/60 dark:bg-green-900/20" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                    Commande #{item.orderId?.slice(-8)}
                                  </p>
                                  <p className="truncate text-xs text-gray-600 dark:text-gray-300">
                                    {item.customerName || "Client"}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.totalAmount?.toFixed(2)} TND
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {isUnread && <span className="h-2.5 w-2.5 rounded-full bg-green-600" />}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(item.orderId);
                                    }}
                                    className="text-[11px] font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    Supprimer
                                  </button>
                                  <span className="text-[11px] text-gray-400">
                                    {new Date(item.createdAt).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dark mode toggle */}
            <DarkModeToggle />

            {/* User Profile Dropdown */}
            <div className="relative" data-profile-dropdown>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {session ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                    <span className="text-sm font-medium">
                      {session.user?.firstName?.charAt(0).toUpperCase() ||
                        session.user?.name?.charAt(0).toUpperCase() ||
                        "U"}
                      {session.user?.lastName?.charAt(0).toUpperCase() ||
                        session.user?.name?.split(" ")[1]?.charAt(0).toUpperCase() ||
                        ""}
                    </span>
                  </div>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                )}
                <svg
                  className={`h-4 w-4 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-48 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800"
                  >
                    {session ? (
                      <>
                        <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">
                            {session.user?.firstName} {session.user?.lastName}
                          </p>
                          <p className="text-gray-500">{session.user?.email}</p>
                        </div>
                        <div className="border-t border-gray-100 dark:border-gray-700">
                          <Link
                            href="/admin/settings"
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            Paramètres
                          </Link>
                          {/* Smart button: Dashboard when on client site, Site Web when on admin pages */}
                          <Link
                            href={router.pathname.startsWith("/admin") ? "/" : "/admin"}
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            {router.pathname.startsWith("/admin") ? "Site Web" : "Tableau de Bord"}
                          </Link>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setIsProfileOpen(false);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Se déconnecter
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="px-4 py-2">
                        <Link
                          href="/login"
                          className="block text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Se connecter
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
              aria-label="Toggle mobile menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 py-4 dark:border-gray-700 lg:hidden"
            >
              <div className="space-y-4">
                {/* Mobile Navigation Links */}
                <div className="space-y-2">
                  {adminMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Mobile Profile Actions */}
                {session && (
                  <div className="border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                    <Link
                      href="/admin/settings"
                      className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Paramètres
                    </Link>
                    {/* Smart button: Dashboard when on client site, Site Web when on admin pages */}
                    <Link
                      href={router.pathname.startsWith("/admin") ? "/" : "/admin"}
                      className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {router.pathname.startsWith("/admin") ? "Site Web" : "Tableau de Bord"}
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsMobileMenuOpen(false);
                      }}
                      className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
