export const NAV_SECTIONS = {
  accueil: "accueil",
  boutique: "boutique",
  aPropos: "a-propos",
} as const;

export type NavSectionId = (typeof NAV_SECTIONS)[keyof typeof NAV_SECTIONS];

interface ScrollToSectionOptions {
  durationMs?: number;
  offsetPx?: number;
}

export function scrollToSection(sectionId: string, options: ScrollToSectionOptions = {}) {
  const element = document.getElementById(sectionId);
  if (!element) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = Math.max(160, options.durationMs ?? 320);
  const offsetPx = options.offsetPx ?? 76;
  const startY = window.scrollY;
  const targetY = Math.max(0, element.getBoundingClientRect().top + startY - offsetPx);
  const distance = targetY - startY;

  if (Math.abs(distance) < 2 || reducedMotion) {
    window.scrollTo({ top: targetY, behavior: "auto" });
    return;
  }

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  let animationStart = 0;

  const animate = (timestamp: number) => {
    if (!animationStart) {
      animationStart = timestamp;
    }

    const elapsed = timestamp - animationStart;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = easeOutCubic(progress);

    window.scrollTo({ top: startY + distance * eased, behavior: "auto" });

    if (progress < 1) {
      window.requestAnimationFrame(animate);
    }
  };

  window.requestAnimationFrame(animate);
}
