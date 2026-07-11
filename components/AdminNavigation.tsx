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

const ADMIN_MENU_ITEMS = [
  { href: "/admin", label: "Tableau de Bord" },
  { href: "/admin/orders", label: "Commandes" },
  { href: "/admin/products", label: "Produits" },
  { href: "/admin/users", label: "Employés" },
  { href: "/admin/delivery-fees", label: "Frais de Livraison" },
  { href: "/admin/reviews", label: "Avis" },
] as const;

const isAdminRouteActive = (pathname: string, href: string) => {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

const NOTIFICATIONS_STORAGE_KEY = "admin-order-notifications";
const DISMISSED_NOTIFICATIONS_KEY = "admin-order-notifications-dismissed";

const readDismissedNotificationIds = (): Set<string> => {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const saved = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
    if (!saved) {
      return new Set();
    }

    const parsed = JSON.parse(saved);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
};

const writeDismissedNotificationIds = (ids: Set<string>) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify([...ids]));
};

export default function AdminNavigation() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminOrderNotification[]>([]);
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);

  const { data: recentOrdersData } = useQuery({
    queryKey: ["admin-notification-center-orders"],
    queryFn: async () => {
      const response = await fetch("/api/admin/orders?page=1&limit=10");
      const data = await response.json();
      return data.success ? data.data : { orders: [] };
    },
    enabled: session?.user?.role === "admin",
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const dismissedIds = readDismissedNotificationIds();
          setNotifications(parsed.filter((item) => !dismissedIds.has(item.orderId)));
        }
      } catch {
        setNotifications([]);
      }
    }

    setNotificationsHydrated(true);
  }, []);

  useEffect(() => {
    if (!notificationsHydrated) {
      return;
    }

    if (!session?.user?.role || session.user.role !== "admin") {
      return;
    }

    const incomingOrders = recentOrdersData?.orders || [];
    if (!incomingOrders.length) {
      return;
    }

    setNotifications((prev) => {
      const dismissedIds = readDismissedNotificationIds();
      const merged = prev.filter((item) => !dismissedIds.has(item.orderId));

      for (const order of incomingOrders) {
        const orderId = order._id as string;
        if (dismissedIds.has(orderId)) {
          continue;
        }

        const existingIndex = merged.findIndex((n) => n.orderId === orderId);
        const incomingPayload: AdminOrderNotification = {
          orderId,
          customerName: `${order.customerInfo?.firstName || ""} ${order.customerInfo?.lastName || ""}`.trim(),
          totalAmount: Number(order.totalAmount || 0),
          createdAt: order.createdAt,
          status: order.status || "pending",
          read: false,
        };

        if (existingIndex === -1) {
          merged.unshift(incomingPayload);
          continue;
        }

        const existing = merged[existingIndex];
        merged[existingIndex] = {
          ...existing,
          customerName: incomingPayload.customerName,
          totalAmount: incomingPayload.totalAmount,
          createdAt: incomingPayload.createdAt,
          status: incomingPayload.status,
          read: existing.read,
        };
      }

      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, [notificationsHydrated, recentOrdersData, session?.user?.role]);

  const markOrderAsRead = (orderId: string) => {
    setNotifications((prev) => {
      const updated = prev.map((item) =>
        item.orderId === orderId ? { ...item, read: true } : item
      );
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, read: true }));
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteNotification = (orderId: string) => {
    const dismissedIds = readDismissedNotificationIds();
    dismissedIds.add(orderId);
    writeDismissedNotificationIds(dismissedIds);

    setNotifications((prev) => {
      const updated = prev.filter((item) => item.orderId !== orderId);
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteAllNotifications = () => {
    setNotifications((prev) => {
      const dismissedIds = readDismissedNotificationIds();
      prev.forEach((item) => dismissedIds.add(item.orderId));
      writeDismissedNotificationIds(dismissedIds);
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
      return [];
    });
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

  useEffect(() => {
    for (const item of ADMIN_MENU_ITEMS) {
      void router.prefetch(item.href);
    }
  }, [router]);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 shadow-[0_1px_0_rgba(17,24,39,0.04)] backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/90">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/admin" className="group flex items-center gap-3">
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
              <h1 className="hidden text-xl font-semibold text-gray-900 transition-colors duration-150 group-hover:text-gray-700 sm:block dark:text-white dark:group-hover:text-gray-200">
                Rideaux Bambou
              </h1>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500 sm:block dark:text-gray-400">
                Admin
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-6 lg:flex">
            {ADMIN_MENU_ITEMS.map((item) => {
              const isActive = isAdminRouteActive(router.pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative inline-flex items-center px-1 py-2 text-[0.92rem] font-medium tracking-[0.01em] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/60 focus-visible:ring-offset-2 dark:focus-visible:ring-gray-100/70 dark:focus-visible:ring-offset-gray-900 ${
                    isActive
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-[-0.45rem] inset-y-1 rounded-md bg-gray-900/10 transition-opacity duration-150 ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    } dark:bg-gray-100/10`}
                  />
                  <span className="relative">{item.label}</span>
                  <span
                    className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-center rounded-full bg-gray-900 transition-transform duration-150 ease-out dark:bg-gray-100 ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-75"
                    }`}
                  />
                </Link>
              );
            })}
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
                className="relative rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
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
                    className="absolute right-0 mt-2 w-[92vw] max-w-sm overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-xl shadow-gray-900/10 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95 dark:shadow-black/20"
                  >
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Notifications
                      </h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
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
                                void router.push(`/admin/orders?orderId=${item.orderId}`);
                              }}
                              className={`w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40 ${
                                isUnread ? "bg-gray-100/80 dark:bg-gray-700/30" : ""
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
                                  {isUnread && (
                                    <span className="h-2.5 w-2.5 rounded-full bg-gray-900 dark:bg-gray-100" />
                                  )}
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
                className="flex items-center gap-2 rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
              >
                {session ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/90 text-white dark:bg-gray-100 dark:text-gray-900">
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
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200/80 bg-white/95 py-1 shadow-xl shadow-gray-900/10 ring-1 ring-black/5 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95 dark:shadow-black/20"
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
                            href={router.pathname.startsWith("/admin") ? "/" : "/admin"}
                            className="block px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            {router.pathname.startsWith("/admin") ? "Site Web" : "Tableau de Bord"}
                          </Link>
                          <Link
                            href="/admin/settings"
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            Paramètres
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
                          href="/connexion"
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
              className="rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white lg:hidden"
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
              className="border-t border-gray-200/80 py-4 dark:border-gray-700/80 lg:hidden"
            >
              <div className="space-y-4">
                {/* Mobile Navigation Links */}
                <div className="space-y-2">
                  {ADMIN_MENU_ITEMS.map((item) => {
                    const isActive = isAdminRouteActive(router.pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`block rounded-xl border px-4 py-2.5 text-[0.95rem] font-medium transition-all duration-150 ease-out ${
                          isActive
                            ? "border-gray-300 bg-gray-100/90 text-gray-900 shadow-sm dark:border-gray-500 dark:bg-gray-700/40 dark:text-white"
                            : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80"
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                {/* Mobile Profile Actions */}
                {session && (
                  <div className="border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                    <Link
                      href={router.pathname.startsWith("/admin") ? "/" : "/admin"}
                      className="block py-2 text-sm font-semibold text-gray-900 dark:text-white"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {router.pathname.startsWith("/admin") ? "Site Web" : "Tableau de Bord"}
                    </Link>
                    <Link
                      href="/admin/settings"
                      className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Paramètres
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
