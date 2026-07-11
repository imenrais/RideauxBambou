import { z } from "zod";

export const EMAIL_REQUIRED_ERROR = "L'adresse email est requise.";
export const EMAIL_INVALID_ERROR = "Veuillez saisir une adresse email valide.";

export const normalizeEmailValue = (value: string) => value.trim().toLowerCase();

export const requiredEmailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_REQUIRED_ERROR)
  .max(254, EMAIL_INVALID_ERROR)
  .email(EMAIL_INVALID_ERROR)
  .transform(normalizeEmailValue);

export const optionalEmailSchema = z
  .string()
  .trim()
  .max(254, EMAIL_INVALID_ERROR)
  .refine((value) => value === "" || z.string().email().safeParse(value).success, EMAIL_INVALID_ERROR)
  .transform((value) => (value ? normalizeEmailValue(value) : ""));

export const getEmailValidationError = (
  value: string,
  options: { required?: boolean } = {}
): string => {
  const schema = options.required ? requiredEmailSchema : optionalEmailSchema;
  const result = schema.safeParse(value);
  if (result.success) {
    return "";
  }
  return result.error.issues[0]?.message || EMAIL_INVALID_ERROR;
};

export const isValidEmailValue = (value: string, options: { required?: boolean } = {}): boolean =>
  !getEmailValidationError(value, options);
