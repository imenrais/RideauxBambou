import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

import { useSimpleCart } from "../contexts/SimpleCartContext";
import { NAV_SECTIONS, scrollToSection, type NavSectionId } from "../lib/scroll-nav";

import CartPopover from "./CartPopover";
import DarkModeToggle from "./DarkModeToggle";
import MobileMenuButton from "./MobileMenuButton";
import { MobileNavLinkAccent, MobileNavPanel, mobileNavLinkClass } from "./MobileNavPanel";
import { useDarkMode } from "../contexts/DarkModeContext";

interface NavigationProps {
  showCartIcon?: boolean;
}

const BOUTIQUE_HIGHLIGHT_PATHS = new Set(["/products", "/configurer"]);

const NO_NAV_HIGHLIGHT_PATHS = new Set(["/panier", "/paiement", "/commande-reussie"]);

const getSectionFromPath = (path: string): NavSectionId | null => {
  if (NO_NAV_HIGHLIGHT_PATHS.has(path)) {
    return null;
  }
  if (BOUTIQUE_HIGHLIGHT_PATHS.has(path)) {
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
  const [activeSection, setActiveSection] = useState<NavSectionId | null>(NAV_SECTIONS.accueil);
  const { getTotalItems, isCartOpen, toggleCart, closeCart } = useSimpleCart();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
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
    closeCart();
    setIsProfileOpen(!isProfileOpen);
  };

  const handleToggleCart = () => {
    setIsProfileOpen(false);
    toggleCart();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close profile / cart dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isProfileOpen && !target.closest("[data-profile-dropdown]")) {
        setIsProfileOpen(false);
      }
      if (isCartOpen && !target.closest("[data-cart-dropdown]")) {
        closeCart();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen, isCartOpen, closeCart]);

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

    const updateSectionFromScroll = () => {
      // Offset below sticky nav — last section that has crossed this line wins.
      const viewportAnchor = 96;
      let currentSection: NavSectionId = NAV_SECTIONS.accueil;

      for (const item of CLIENT_MENU_ITEMS) {
        const section = document.getElementById(item.sectionId);
        if (!section) {
          continue;
        }

        if (section.getBoundingClientRect().top <= viewportAnchor) {
          currentSection = item.sectionId;
        }
      }

      setActiveSection((previous) =>
        previous === currentSection ? previous : currentSection
      );
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
  }, [router.pathname]);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 w-full border-b border-gray-200/80 bg-gray-100/90 shadow-[0_1px_0_rgba(17,24,39,0.04)] backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/90">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between">
          <div className="flex min-w-0 items-center">
            {/* Logo */}
            <Link
              href="/#accueil"
              onClick={handleLogoClick}
              className="group flex min-w-0 items-center gap-2 sm:gap-3"
            >
              <Image
                src="/images/logo.png"
                alt="Rideaux Bambou Logo"
                width={80}
                height={80}
                className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10"
                quality={100}
                priority
              />
              <h1 className="truncate text-base font-semibold text-gray-900 transition-colors duration-150 group-hover:text-gray-700 sm:text-xl dark:text-white dark:group-hover:text-gray-200">
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
          <div className="flex shrink-0 items-center gap-1 lg:gap-2">
            {showCartIcon && (
              <div className="relative z-10" data-cart-dropdown>
                <button
                  type="button"
                  onClick={handleToggleCart}
                  className="relative rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
                  aria-label="Ouvrir le panier"
                  aria-expanded={isCartOpen}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  {getTotalItems() > 0 && (
                    <span className="absolute -right-1 -top-1 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
                      {getTotalItems()}
                    </span>
                  )}
                </button>
                <CartPopover />
              </div>
            )}

            {!isAdmin && <DarkModeToggle />}

            {/* Profile Dropdown (authenticated users only) */}
            {session && (
              <div className="relative" data-profile-dropdown>
                <button
                  onClick={toggleProfile}
                  className="flex items-center gap-1 rounded-full border border-transparent p-2 text-gray-600 transition-all duration-150 hover:border-gray-200 hover:bg-gray-100/80 hover:text-gray-900 lg:gap-2 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/80 dark:hover:text-white"
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
                      className="absolute right-0 z-[70] mt-2 w-56 overflow-hidden rounded-xl border border-gray-200/80 bg-white/95 py-1 shadow-xl shadow-gray-900/10 ring-1 ring-black/5 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95 dark:shadow-black/20"
                    >
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        <p className="font-medium">
                          {session.user?.firstName} {session.user?.lastName}
                        </p>
                        <p className="break-anywhere text-gray-500">{session.user?.email}</p>
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

            <MobileMenuButton open={isMobileMenuOpen} onClick={toggleMobileMenu} />
          </div>
          </div>

          {/* Mobile menu */}
          <MobileNavPanel open={isMobileMenuOpen}>
            {CLIENT_MENU_ITEMS.map((item, index) => {
              const isActive = activeSection === item.sectionId;
              return (
                <motion.a
                  key={item.sectionId}
                  href={`/#${item.sectionId}`}
                  aria-current={isActive ? "page" : undefined}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.04 + index * 0.04 }}
                  className={mobileNavLinkClass(isActive)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSection(item.sectionId, true);
                  }}
                >
                  <MobileNavLinkAccent isActive={isActive} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-white/80 dark:bg-gray-900/70"
                    />
                  )}
                </motion.a>
              );
            })}
          </MobileNavPanel>
        </div>
      </nav>
      {/* Reserves the fixed navbar height so page content stays aligned */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {router.pathname === "/" && (
        <button
          type="button"
          onClick={() => navigateToSection(NAV_SECTIONS.boutique)}
          className="fixed bottom-4 right-4 z-[60] inline-flex min-w-0 items-center justify-center rounded-full bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(17,24,39,0.28)] transition duration-200 hover:scale-105 hover:from-gray-800 hover:to-gray-700 sm:bottom-6 sm:right-6 sm:min-w-[200px] sm:px-8 sm:py-3.5 sm:text-lg sm:font-extrabold lg:min-w-[260px] lg:px-10 lg:py-4 lg:text-xl dark:from-white dark:to-gray-100 dark:text-gray-900 dark:shadow-[0_12px_28px_rgba(0,0,0,0.35)] dark:hover:from-gray-100 dark:hover:to-white"
        >
          Demander Devis
        </button>
      )}
    </>
  );
}
