import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect, useCallback } from "react";

import DarkModeToggle from "./DarkModeToggle";
import { useSimpleCart } from "../contexts/SimpleCartContext";
import { NAV_SECTIONS, scrollToSection, type NavSectionId } from "../lib/scroll-nav";

export default function Navigation() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { getTotalItems } = useSimpleCart();

  const navigateToSection = useCallback(
    (sectionId: NavSectionId, closeMobileMenu = false) => {
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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const menuItems: { sectionId: NavSectionId; label: string }[] = [
    { sectionId: NAV_SECTIONS.accueil, label: "Accueil" },
    { sectionId: NAV_SECTIONS.boutique, label: "Produits" },
    { sectionId: NAV_SECTIONS.aPropos, label: "À propos" },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="relative flex h-16 items-center justify-between">
          <div className="flex items-center">
            {/* Logo */}
            <Link
              href="/#accueil"
              onClick={handleLogoClick}
              className="group flex items-center space-x-3"
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
              <h1 className="hidden text-lg font-bold text-gray-900 transition-colors group-hover:text-gray-700 sm:block lg:text-2xl dark:text-white dark:group-hover:text-gray-300">
                Rideaux Bambou
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation (Centered) */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center space-x-8 lg:flex">
            {menuItems.map((item) => (
              <a
                key={item.sectionId}
                href={`/#${item.sectionId}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToSection(item.sectionId);
                }}
                className="cursor-pointer font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* Cart Icon */}
            <Link
              href="/simple-cart"
              className="relative rounded-full p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
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
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white dark:bg-white dark:text-gray-900">
                  {getTotalItems()}
                </span>
              )}
            </Link>

            {/* Profile Dropdown (authenticated users only) */}
            {session && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={toggleProfile}
                  className="flex items-center space-x-2 rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
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
                  <span className="hidden text-sm font-medium lg:block">
                    {session.user?.firstName && session.user?.lastName
                      ? `${session.user.firstName} ${session.user.lastName}`
                      : session.user?.name || "Utilisateur"}
                  </span>
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
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        <p className="font-medium">
                          {session.user?.firstName} {session.user?.lastName}
                        </p>
                        <p className="text-gray-500">{session.user?.email}</p>
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-700">
                        {session.user?.role === "admin" && (
                          <Link
                            href="/admin"
                            className="block px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            Tableau de Bord
                          </Link>
                        )}
                        <Link
                          href="/profile/settings"
                          className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Paramètres
                        </Link>
                        {session.user?.role !== "admin" && (
                          <Link
                            href="/profile/orders"
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            Mes Commandes
                          </Link>
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

            {/* Dark mode toggle */}
            <DarkModeToggle />

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
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
                    {menuItems.map((item) => (
                      <a
                        key={item.sectionId}
                        href={`/#${item.sectionId}`}
                        className="block cursor-pointer px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        onClick={(e) => {
                          e.preventDefault();
                          navigateToSection(item.sectionId, true);
                        }}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>

                  {session?.user?.role === "admin" && (
                    <div className="border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                      <Link
                        href="/admin"
                        className="block rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Aller au Tableau de Bord
                      </Link>
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
          className="fixed bottom-4 right-4 z-[60] rounded-full bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(22,163,74,0.35)] transition duration-200 hover:scale-105 hover:from-green-700 hover:to-green-800 sm:bottom-6 sm:right-6 sm:px-6 sm:py-3.5 sm:text-base dark:from-white dark:to-gray-100 dark:text-gray-900 dark:shadow-[0_12px_28px_rgba(0,0,0,0.35)] dark:hover:from-gray-100 dark:hover:to-white"
        >
          Demander Devis
        </button>
      )}
    </>
  );
}
