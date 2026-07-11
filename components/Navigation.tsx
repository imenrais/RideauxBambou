import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

import { useSimpleCart } from "../contexts/SimpleCartContext";
import { NAV_SECTIONS, scrollToSection, type NavSectionId } from "../lib/scroll-nav";

import DarkModeToggle from "./DarkModeToggle";

interface NavigationProps {
  showCartIcon?: boolean;
}

const SHOP_RELATED_PATHS = new Set([
  "/products",
  "/configurer",
  "/panier",
  "/paiement",
  "/commande-reussie",
]);

const CLIENT_ORDERING_PATHS = new Set([
  "/configurer",
  "/panier",
  "/paiement",
]);

const isNavSectionId = (value: string): value is NavSectionId =>
  Object.values(NAV_SECTIONS).includes(value as NavSectionId);

const getSectionFromPath = (path: string): NavSectionId => {
  if (SHOP_RELATED_PATHS.has(path)) {
    return NAV_SECTIONS.boutique;
  }
  return NAV_SECTIONS.accueil;
};

const CLIENT_MENU_ITEMS: { sectionId: NavSectionId; label: string }[] = [
  { sectionId: NAV_SECTIONS.accueil, label: "Accueil" },
  { sectionId: NAV_SECTIONS.boutique, label: "Produits" },
  { sectionId: NAV_SECTIONS.aPropos, label: "À propos" },
];

export default function Navigation({ showCartIcon = true }: NavigationProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSectionId>(NAV_SECTIONS.accueil);
  const { getTotalItems } = useSimpleCart();
  const isAdmin = session?.user?.role === "admin";

  const navigateToSection = useCallback(
    (sectionId: NavSectionId, closeMobileMenu = false) => {
      setActiveSection(sectionId);

      if (closeMobileMenu) {
        setIsMobileMenuOpen(false);
      }

      if (router.pathname === "/") {
        scrollToSection(sectionId);
        window.history.replaceState(null, "", `/#${sectionId}`);
        return;
      }

      void router.push(`/#${sectionId}`);
    },
    [router]
  );

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    setActiveSection(NAV_SECTIONS.accueil);
    if (router.pathname === "/") {
      e.preventDefault();
      scrollToSection(NAV_SECTIONS.accueil);
      window.history.replaceState(null, "", "/#accueil");
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isProfileOpen && !target.closest("[data-profile-dropdown]")) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    if (router.pathname !== "/") {
      void router.prefetch("/");
    }
  }, [router, router.pathname]);

  useEffect(() => {
    if (router.pathname !== "/") {
      setActiveSection(getSectionFromPath(router.pathname));
      return;
    }

    const hashSection = router.asPath.split("#")[1];
    if (hashSection && isNavSectionId(hashSection)) {
      setActiveSection(hashSection);
      return;
    }

    const updateSectionFromScroll = () => {
      const viewportAnchor = window.innerHeight * 0.28;
      let closestSection: NavSectionId = NAV_SECTIONS.accueil;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const item of CLIENT_MENU_ITEMS) {
        const section = document.getElementById(item.sectionId);
        if (!section) {
          continue;
        }

        const distance = Math.abs(section.getBoundingClientRect().top - viewportAnchor);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestSection = item.sectionId;
        }
      }

      setActiveSection((current) => (current === closestSection ? current : closestSection));
    };

    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateSectionFromScroll();
      });
    };

    updateSectionFromScroll();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [router.asPath, router.pathname]);

  if (CLIENT_ORDERING_PATHS.has(router.pathname)) {
    return null;
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 shadow-[0_1px_0_rgba(17,24,39,0.04)] backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/90">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="relative flex h-16 items-center justify-between">
          <div className="flex items-center">
            {/* Logo */}
            <Link
              href="/#accueil"
              onClick={handleLogoClick}
              className="group flex items-center gap-3"
            >
              <div className="relative h-10 w-10 overflow-hidden rounded-full">
                <Image
                  src="/logo.png"
                  alt="Rideaux Bambou Logo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <h1 className="hidden text-xl font-semibold text-gray-900 transition-colors duration-150 group-hover:text-gray-700 sm:block dark:text-white dark:group-hover:text-gray-200">
                Rideaux Bambou
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation (Centered) */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
            {CLIENT_MENU_ITEMS.map((item) => {
              const isActive = activeSection === item.sectionId;
              return (
                <a
                  key={item.sectionId}
                  href={`/#${item.sectionId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSection(item.sectionId);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative inline-flex cursor-pointer items-center px-1 py-2 text-[0.95rem] font-medium tracking-[0.01em] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/60 focus-visible:ring-offset-2 dark:focus-visible:ring-gray-100/70 dark:focus-visible:ring-offset-gray-900 ${
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
                </a>
              );
            })}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {showCartIcon && (
              <Link
                href="/panier"
                className="relative rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                {/* Cart count badge */}
                {getTotalItems() > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900">
                    {getTotalItems()}
                  </span>
                )}
              </Link>
            )}

            <DarkModeToggle />

            {/* Profile Dropdown (authenticated users only) */}
            {session && (
              <div className="relative" data-profile-dropdown>
                <button
                  onClick={toggleProfile}
                  className="flex items-center gap-2 rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
                >
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
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        <p className="font-medium">
                          {session.user?.firstName} {session.user?.lastName}
                        </p>
                        <p className="text-gray-500">{session.user?.email}</p>
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-700">
                        {isAdmin ? (
                          <>
                            <Link
                              href="/admin"
                              className="block px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              Tableau de Bord
                            </Link>
                            <Link
                              href="/admin/settings"
                              className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              Paramètres
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link
                              href="/profile/settings"
                              className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              Paramètres
                            </Link>
                            <Link
                              href="/profil/commandes"
                              className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              Mes Commandes
                            </Link>
                          </>
                        )}
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
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
                    {CLIENT_MENU_ITEMS.map((item) => {
                      const isActive = activeSection === item.sectionId;
                      return (
                        <a
                          key={item.sectionId}
                          href={`/#${item.sectionId}`}
                          aria-current={isActive ? "page" : undefined}
                          className={`block cursor-pointer rounded-xl border px-4 py-2.5 text-[0.95rem] font-medium transition-all duration-150 ease-out ${
                            isActive
                            ? "border-gray-300 bg-gray-100/90 text-gray-900 shadow-sm dark:border-gray-500 dark:bg-gray-700/40 dark:text-white"
                              : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateToSection(item.sectionId, true);
                          }}
                        >
                          {item.label}
                        </a>
                      );
                    })}
                  </div>

                  {session && (
                    <div className="border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                      {isAdmin ? (
                        <>
                          <Link
                            href="/admin"
                            className="block py-2 text-sm font-semibold text-gray-900 dark:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            Tableau de Bord
                          </Link>
                          <Link
                            href="/admin/settings"
                            className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            Paramètres
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/profile/settings"
                            className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            Paramètres
                          </Link>
                          <Link
                            href="/profil/commandes"
                            className="block py-2 text-sm text-gray-700 dark:text-gray-300"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            Mes Commandes
                          </Link>
                        </>
                      )}
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
        </div>
      </nav>

      {router.pathname === "/" && (
        <button
          type="button"
          onClick={() => navigateToSection(NAV_SECTIONS.boutique)}
          className="fixed bottom-4 right-4 z-[60] inline-flex min-w-[220px] items-center justify-center rounded-full bg-gradient-to-r from-green-600 to-green-700 px-8 py-3.5 text-lg font-extrabold text-white shadow-[0_12px_30px_rgba(22,163,74,0.35)] transition duration-200 hover:scale-105 hover:from-green-700 hover:to-green-800 sm:bottom-6 sm:right-6 sm:min-w-[280px] sm:px-10 sm:py-4 sm:text-xl lg:min-w-[320px] lg:px-12 lg:py-4 lg:text-2xl dark:from-white dark:to-gray-100 dark:text-gray-900 dark:shadow-[0_12px_28px_rgba(0,0,0,0.35)] dark:hover:from-gray-100 dark:hover:to-white"
        >
          Demander Devis
        </button>
      )}
    </>
  );
}
