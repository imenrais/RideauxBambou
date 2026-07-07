export const NAV_SECTIONS = {
  accueil: "accueil",
  boutique: "boutique",
  aPropos: "a-propos",
} as const;

export type NavSectionId = (typeof NAV_SECTIONS)[keyof typeof NAV_SECTIONS];

export function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
