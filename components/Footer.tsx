import Image from "next/image";
import Link from "next/link";
import {
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineWrenchScrewdriver,
  HiOutlineShieldCheck,
} from "react-icons/hi2";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    services: [
      { label: "À propos", href: "/#a-propos" },
      { label: "FAQ", href: "/faq" },
    ],
    privacyTerms: [
      { label: "Conditions Générales", href: "/terms" },
      { label: "Retours & Remboursements", href: "/returns" },
    ],
  };

  const socialLinks = [
    {
      name: "Facebook",
      href: "https://www.facebook.com/rideauxbambou",
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      name: "Instagram",
      href: "https://www.instagram.com/rideaux_bambou/?hl=en",
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
    {
      name: "TikTok",
      href: "https://www.tiktok.com/@rideaux.bambou",
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.34-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="border-t border-gray-200 bg-gray-100 pb-[env(safe-area-inset-bottom,0px)] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-6 sm:pt-12 lg:px-8">
        <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-start lg:gap-40 xl:gap-48">
          {/* Logo and Social */}
          <div className="w-fit max-w-full shrink-0 space-y-2.5 sm:space-y-4">
            <Link
              href="/#accueil"
              className="group inline-flex flex-nowrap items-center gap-2.5 sm:gap-3"
            >
              <Image
                src="/images/logo.jpeg"
                alt="Rideaux Bambou Logo"
                width={80}
                height={80}
                className="h-8 w-8 shrink-0 rounded-full object-cover sm:h-10 sm:w-10"
                quality={100}
              />
              <h3 className="whitespace-nowrap text-base font-semibold tracking-tight transition-colors duration-150 group-hover:text-gray-600 dark:group-hover:text-gray-200 sm:text-2xl">
                Rideaux Bambou
              </h3>
            </Link>
            <div className="space-y-2 sm:space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-300 sm:text-sm">Suivez-nous</p>
              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Adresse / Contact / Services */}
          <div className="grid w-full flex-1 grid-cols-2 gap-x-2.5 gap-y-6 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-8 lg:gap-x-12">
            {/* Address */}
            <div className="order-1 min-w-0 sm:col-span-1">
              <div>
                <h4 className="mb-3 flex min-h-[2.75rem] items-end gap-1 text-xs font-semibold leading-snug sm:mb-4 sm:min-h-0 sm:items-center sm:gap-2 sm:text-lg">
                  <HiOutlineMapPin className="h-3.5 w-3.5 shrink-0 sm:mt-0.5 sm:h-5 sm:w-5" aria-hidden="true" />
                  <span>Adresse</span>
                </h4>
                <ul className="space-y-2 pl-4 sm:pl-7">
                  <li className="text-[10px] text-gray-600 dark:text-gray-300 sm:text-sm sm:leading-relaxed">
                    11 rue 15 octobre
                  </li>
                  <li className="text-[10px] text-gray-600 dark:text-gray-300 sm:text-sm sm:leading-relaxed">
                    Ben Arous, Ben Arous
                  </li>
                </ul>
              </div>

              <div className="mt-8 hidden sm:mt-12 sm:block">
                <h4 className="mb-3 flex items-start gap-2 text-sm font-semibold leading-snug sm:mb-4 sm:whitespace-nowrap sm:text-base lg:text-lg">
                  <HiOutlineShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Confidentialité & Conditions</span>
                </h4>
                <ul className="space-y-2 pl-7">
                  {footerLinks.privacyTerms.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Contact */}
            <div className="order-2 min-w-0 sm:col-span-1">
              <h4 className="mb-3 flex min-h-[2.75rem] items-end gap-1 text-xs font-semibold leading-snug sm:mb-4 sm:min-h-0 sm:items-center sm:gap-2 sm:text-lg">
                <HiOutlinePhone className="h-3.5 w-3.5 shrink-0 sm:mt-0.5 sm:h-5 sm:w-5" aria-hidden="true" />
                <span>Contact</span>
              </h4>
              <ul className="space-y-2 pl-4 sm:space-y-3 sm:pl-7">
                <li>
                  <a
                    href="tel:+21651590770"
                    className="whitespace-nowrap text-[10px] text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white sm:text-sm"
                  >
                    Téléphone : 51 590 770
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:rideauxbambou@gmail.com"
                    className="whitespace-nowrap text-[10px] text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white sm:text-sm"
                  >
                    Email : rideauxbambou@gmail.com
                  </a>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div className="order-3 min-w-0 sm:ml-10 lg:ml-16">
              <h4 className="mb-3 flex min-h-[2.75rem] items-end gap-1 text-xs font-semibold leading-snug sm:mb-4 sm:min-h-0 sm:items-center sm:gap-2 sm:text-lg">
                <HiOutlineWrenchScrewdriver className="h-3.5 w-3.5 shrink-0 sm:mt-0.5 sm:h-5 sm:w-5" aria-hidden="true" />
                <span>Services</span>
              </h4>
              <ul className="space-y-2 pl-4 sm:space-y-2 sm:pl-7">
                {footerLinks.services.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[10px] text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white sm:text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Privacy — phone only (after Services); desktop keeps it under Adresse */}
            <div className="order-4 min-w-0 sm:hidden">
              <h4 className="mb-3 flex min-h-[2.75rem] items-end gap-1 text-xs font-semibold leading-snug">
                <HiOutlineShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Confidentialité & Conditions</span>
              </h4>
              <ul className="space-y-2 pl-4">
                {footerLinks.privacyTerms.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[10px] text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-5 border-t border-gray-200 py-3 dark:border-gray-700 sm:mt-8 sm:py-5">
          <div className="flex items-center justify-center">
            <p className="text-center text-[11px] text-gray-500 dark:text-gray-400 sm:text-sm">
              ©{currentYear} Rideaux Bambou. Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
