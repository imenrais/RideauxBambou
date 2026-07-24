import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

import MobileMenuButton from "./MobileMenuButton";
import { MobileNavLinkAccent, MobileNavPanel, mobileNavLinkClass } from "./MobileNavPanel";
import { useDarkMode } from "../contexts/DarkModeContext";

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
  const { isDarkMode, toggleDarkMode } = useDarkMode();
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
    for (const item of ADMIN_MENU_ITEMS) {
      void router.prefetch(item.href);
    }
    void router.prefetch("/admin/settings");
  }, [router]);

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
    setIsMobileMenuOpen((open) => {
      const next = !open;
      if (next) {
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
      }
      return next;
    });
  };

  // Close dropdowns / mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isProfileOpen && !target.closest("[data-profile-dropdown]")) {
        setIsProfileOpen(false);
      }
      if (isNotificationsOpen && !target.closest("[data-notification-dropdown]")) {
        setIsNotificationsOpen(false);
      }
      if (isMobileMenuOpen && !target.closest("[data-mobile-menu]")) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen, isNotificationsOpen, isMobileMenuOpen]);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 w-full border-b border-gray-200/80 bg-white/90 shadow-[0_1px_0_rgba(17,24,39,0.04)] backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/90">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/admin" className="group flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full sm:h-10 sm:w-10">
              <Image
                src="/images/logo.png"
                alt="Rideaux Bambou Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <h1 className="truncate text-base font-semibold leading-tight text-gray-900 transition-colors duration-150 group-hover:text-gray-700 sm:text-xl dark:text-white dark:group-hover:text-gray-200">
                Rideaux Bambou
              </h1>
              <span className="text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-gray-500 sm:text-[11px] sm:tracking-[0.14em] dark:text-gray-400">
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
          <div className="flex shrink-0 items-center gap-1 lg:gap-2">
            {/* Notifications */}
            <div className="relative z-10" data-notification-dropdown>
              <button
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileOpen(false);
                  setIsMobileMenuOpen(false);
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
                  <span className="absolute -right-1 -top-1 z-20 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                    {notifications.filter((item) => !item.read).length > 9
                      ? "9+"
                      : notifications.filter((item) => !item.read).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed right-3 top-[4.5rem] z-[60] flex max-h-[min(70vh,26rem)] w-[min(17.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-xl shadow-gray-900/10 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95 dark:shadow-black/30 sm:absolute sm:right-0 sm:top-auto sm:mt-2 sm:w-[26rem] sm:max-w-[calc(100vw-1.5rem)]"
                  >
                    <div className="flex shrink-0 flex-col gap-2 border-b border-gray-200/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 dark:border-gray-700/80">
                      <h3 className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                        Notifications
                      </h3>
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:ml-auto sm:flex-nowrap">
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="whitespace-nowrap text-xs font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                          Tout marquer comme lu
                        </button>
                        <button
                          type="button"
                          onClick={deleteAllNotifications}
                          className="whitespace-nowrap text-xs font-medium text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Tout supprimer
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
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
                              className={`group relative w-full cursor-pointer border-b border-gray-100 text-left last:border-b-0 dark:border-gray-700/80 ${
                                isUnread
                                  ? "bg-gray-900/[0.04] dark:bg-white/[0.06]"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                              }`}
                            >
                              {isUnread && (
                                <span
                                  className="absolute inset-y-2 left-1.5 w-1 rounded-full bg-gray-900 dark:bg-white"
                                  aria-hidden="true"
                                />
                              )}
                              <div className="flex items-start gap-2.5 px-3 py-2.5 pl-4">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={`truncate text-[13px] ${
                                        isUnread
                                          ? "font-semibold text-gray-900 dark:text-white"
                                          : "font-medium text-gray-700 dark:text-gray-200"
                                      }`}
                                    >
                                      Commande #{item.orderId?.slice(-8)}
                                    </p>
                                    {isUnread && (
                                      <span className="shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-gray-900">
                                        Nouveau
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-300">
                                    {item.customerName || "Client"}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                    {item.totalAmount?.toFixed(2)} TND
                                    <span className="mx-1" aria-hidden="true">
                                      ·
                                    </span>
                                    {new Date(item.createdAt).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(item.orderId);
                                  }}
                                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                  aria-label="Supprimer la notification"
                                  title="Supprimer"
                                >
                                  <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
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

            {/* User Profile Dropdown */}
            <div className="relative" data-profile-dropdown>
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationsOpen(false);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 lg:gap-2 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
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
                  className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${isProfileOpen ? "rotate-180" : ""}`}
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
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200/80 bg-white/95 py-1 shadow-xl shadow-gray-900/10 ring-1 ring-black/5 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95 dark:shadow-black/20"
                  >
                    {session ? (
                      <>
                        <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">
                            {session.user?.firstName} {session.user?.lastName}
                          </p>
                          <p className="break-anywhere text-gray-500">{session.user?.email}</p>
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
                            type="button"
                            onClick={toggleDarkMode}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <span>{isDarkMode ? "Mode clair" : "Mode sombre"}</span>
                            <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">
                              {isDarkMode ? (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                  />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                                  />
                                </svg>
                              )}
                            </span>
                          </button>
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
                      <div className="border-t border-gray-100 px-0 py-1 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={toggleDarkMode}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <span>{isDarkMode ? "Mode clair" : "Mode sombre"}</span>
                          <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">
                            {isDarkMode ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                                />
                              </svg>
                            )}
                          </span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div data-mobile-menu className="lg:hidden">
              <MobileMenuButton open={isMobileMenuOpen} onClick={toggleMenu} />
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div data-mobile-menu>
          <MobileNavPanel open={isMobileMenuOpen}>
          {ADMIN_MENU_ITEMS.map((item, index) => {
            const isActive = isAdminRouteActive(router.pathname, item.href);
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.04 + index * 0.035 }}
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={mobileNavLinkClass(isActive)}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <MobileNavLinkAccent isActive={isActive} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-white/80 dark:bg-gray-900/70"
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </MobileNavPanel>
        </div>
      </div>
    </nav>
      {/* Reserves the fixed navbar height so page content stays aligned */}
      <div className="h-16 shrink-0" aria-hidden="true" />
    </>
  );
}
