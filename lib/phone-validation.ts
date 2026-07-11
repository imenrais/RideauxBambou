import { z } from "zod";

export const PHONE_INVALID_ERROR = "Le numéro de téléphone doit contenir exactement 8 chiffres.";

export const normalizePhoneValue = (value: string) => value.replace(/\D/g, "").slice(0, 8);

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
