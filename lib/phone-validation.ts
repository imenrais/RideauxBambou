import { z } from "zod";

export const PHONE_INVALID_ERROR = "Le numéro de téléphone doit contenir exactement 8 chiffres.";

export const normalizePhoneValue = (value: string) => value.replace(/\D/g, "").slice(0, 8);

export const normalizePhoneForSearch = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length >= 8) {
    return digits.slice(-8);
  }
  return digits;
};

export const extractPhoneSearchDigits = (searchText: string) => String(searchText).replace(/\D/g, "");

export const matchesPhoneSearch = (phoneValue: unknown, searchText: string) => {
  const queryDigits = extractPhoneSearchDigits(searchText);
  if (queryDigits.length < 1) {
    return false;
  }

  const normalizedQuery = normalizePhoneForSearch(queryDigits);
  const phoneDigits = normalizePhoneForSearch(phoneValue);

  if (!phoneDigits) {
    return false;
  }

  return phoneDigits.includes(normalizedQuery);
};

export const requiredPhoneSchema = z
  .string()
  .transform(normalizePhoneValue)
  .refine((value) => /^\d{8}$/.test(value), PHONE_INVALID_ERROR);

export const optionalPhoneSchema = z
  .string()
  .transform(normalizePhoneValue)
  .refine((value) => value === "" || /^\d{8}$/.test(value), PHONE_INVALID_ERROR);

export const getPhoneValidationError = (
  value: string,
  options: { required?: boolean } = {}
): string => {
  const schema = options.required ? requiredPhoneSchema : optionalPhoneSchema;
  const result = schema.safeParse(value);
  if (result.success) {
    return "";
  }
  return result.error.issues[0]?.message || PHONE_INVALID_ERROR;
};
