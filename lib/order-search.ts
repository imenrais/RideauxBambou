import { matchesPhoneSearch } from "./phone-validation";

export type OrderSearchMode = "id" | "name" | "phone";

const normalizeSearchText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const classifyOrderSearchMode = (normalizedSearch: string): OrderSearchMode => {
  const trimmed = normalizedSearch.trim();
  const compact = trimmed.replace(/\s/g, "");
  const digitsOnly = compact.replace(/\D/g, "");

  // Phone: only digits / phone punctuation (from the first digit typed).
  const isPhoneLike = /^\+?[\d\s().-]+$/.test(trimmed) && digitsOnly.length >= 1;
  if (isPhoneLike) {
    return "phone";
  }

  const idCandidate = compact.replace(/^#/, "").replace(/-/g, "");

  // Explicit short ID from the table (`#xxxxxxxx`), or cuid-like fragment (letters + digits).
  if (compact.startsWith("#") && idCandidate.length >= 1) {
    return "id";
  }

  // Order ids are cuid() values — not hex-only. Treat compact alphanumeric with a digit as an ID.
  if (/^[0-9a-z]+$/i.test(idCandidate) && /\d/.test(idCandidate) && idCandidate.length >= 1) {
    return "id";
  }

  return "name";
};

export const matchesOrderIdSearch = (orderId: string, query: string): boolean => {
  const normalizedQuery = query.replace(/^#/, "").replace(/\s/g, "").toLowerCase();
  if (normalizedQuery.length < 1) {
    return false;
  }

  const normalizedOrderId = orderId.toLowerCase().replace(/-/g, "");
  const shortOrderId = normalizedOrderId.slice(-8);

  // Prefer the displayed short ID (`#xxxxxxxx`); also allow full-id substring matches.
  return (
    shortOrderId.startsWith(normalizedQuery) ||
    shortOrderId.includes(normalizedQuery) ||
    normalizedOrderId.includes(normalizedQuery)
  );
};

export const matchesCustomerNameSearch = (
  customerInfo: Record<string, unknown>,
  normalizedSearch: string
): boolean => {
  const searchTokens = normalizedSearch
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 1 && /[a-z]/.test(token));

  if (searchTokens.length === 0) {
    return false;
  }

  const firstName = normalizeSearchText(customerInfo.firstName);
  const lastName = normalizeSearchText(customerInfo.lastName);
  const legacyName = normalizeSearchText(customerInfo.name);
  const companyName = normalizeSearchText(customerInfo.companyName);
  const fullName = `${firstName} ${lastName}`.trim();

  const nameParts = [
    ...new Set(
      [firstName, lastName, fullName, legacyName, companyName]
        .flatMap((name) => name.split(/\s+/))
        .filter((part) => part.length > 0)
    ),
  ];

  return searchTokens.every((token) =>
    nameParts.some((part) => part === token || part.startsWith(token))
  );
};

export const matchesOrderSearch = (
  order: { id: string; customerInfo: unknown },
  normalizedSearch: string
): boolean => {
  const mode = classifyOrderSearchMode(normalizedSearch);
  const customerInfo = (order.customerInfo || {}) as Record<string, unknown>;
  const compactSearch = normalizedSearch.replace(/\s/g, "");

  switch (mode) {
    case "phone":
      return matchesPhoneSearch(customerInfo.phone, normalizedSearch);
    case "id":
      return matchesOrderIdSearch(order.id, compactSearch);
    case "name": {
      if (matchesCustomerNameSearch(customerInfo, normalizedSearch)) {
        return true;
      }

      // Letter-only cuid prefixes are classified as names; still match displayed short IDs.
      const idCandidate = compactSearch.replace(/^#/, "");
      if (
        !normalizedSearch.includes(" ") &&
        /^[0-9a-z]+$/i.test(idCandidate) &&
        idCandidate.length >= 3 &&
        matchesOrderIdSearch(order.id, idCandidate)
      ) {
        return true;
      }

      return false;
    }
  }
};

export const normalizeOrderSearchText = normalizeSearchText;
