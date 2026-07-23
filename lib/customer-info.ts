import { z } from "zod";

import { optionalEmailSchema } from "./email-validation";
import {
  getMatriculeFiscaleValidationError,
  normalizeMatriculeFiscale,
} from "./matricule-fiscale";
import { requiredPhoneSchema } from "./phone-validation";

export const CUSTOMER_TYPES = ["person", "company"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  person: "Particulier",
  company: "Entreprise",
};

const createCustomerInfoSchema = (addressMinLength: number) =>
  z
    .object({
      customerType: z.enum(CUSTOMER_TYPES).default("person"),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      companyName: z.string().optional(),
      matriculeFiscale: z.string().optional(),
      taxId: z.string().optional(),
      email: optionalEmailSchema.optional(),
      phone: requiredPhoneSchema,
      address: z
        .string()
        .min(
          addressMinLength,
          addressMinLength >= 10
            ? "L'adresse doit contenir au moins 10 caractères"
            : "L'adresse est requise"
        ),
      city: z.string().min(2, "La ville est requise"),
      state: z.string().min(2, "La région est requise"),
      postalCode: z.string().min(4, "Le code postal doit contenir au moins 4 caractères"),
      notes: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.customerType === "person") {
        if (!data.firstName || data.firstName.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Le prénom doit contenir au moins 2 caractères",
            path: ["firstName"],
          });
        }
        if (!data.lastName || data.lastName.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Le nom doit contenir au moins 2 caractères",
            path: ["lastName"],
          });
        }
        return;
      }

      if (!data.companyName || data.companyName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Le nom de l'entreprise doit contenir au moins 2 caractères",
          path: ["companyName"],
        });
      }
      const matriculeFiscale = normalizeMatriculeFiscale(data.matriculeFiscale || data.taxId || "");
      const matriculeError = getMatriculeFiscaleValidationError(matriculeFiscale);
      if (matriculeError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: matriculeError,
          path: ["matriculeFiscale"],
        });
      }
    });

export const checkoutCustomerInfoSchema = createCustomerInfoSchema(10);
export const adminCustomerInfoSchema = createCustomerInfoSchema(5);

export type CheckoutCustomerInfo = z.infer<typeof checkoutCustomerInfoSchema>;

export const resolveCustomerType = (value: unknown): CustomerType =>
  value === "company" ? "company" : "person";

export const serializeCustomerInfo = (info: CheckoutCustomerInfo) => {
  const base = {
    customerType: info.customerType,
    email: info.email || "",
    phone: info.phone,
    address: info.address.trim(),
    city: info.city.trim(),
    state: info.state.trim(),
    postalCode: info.postalCode.trim(),
  };

  if (info.customerType === "company") {
    const matriculeFiscale = normalizeMatriculeFiscale(info.matriculeFiscale || info.taxId || "");
    return {
      ...base,
      companyName: info.companyName?.trim() || "",
      matriculeFiscale,
      taxId: matriculeFiscale,
      firstName: "",
      lastName: "",
    };
  }

  return {
    ...base,
    firstName: info.firstName?.trim() || "",
    lastName: info.lastName?.trim() || "",
    companyName: "",
    matriculeFiscale: "",
    taxId: "",
  };
};

export const readMatriculeFiscale = (customerInfo?: Record<string, unknown>) => {
  const info = customerInfo || {};
  const raw =
    typeof info.matriculeFiscale === "string"
      ? info.matriculeFiscale
      : typeof info.taxId === "string"
        ? info.taxId
        : "";
  return normalizeMatriculeFiscale(raw);
};

export const getCustomerDisplayName = (customerInfo?: Record<string, unknown>) => {
  const info = customerInfo || {};
  const customerType = resolveCustomerType(info.customerType);

  if (customerType === "company") {
    const companyName = typeof info.companyName === "string" ? info.companyName.trim() : "";
    return companyName || "Entreprise";
  }

  const firstName = typeof info.firstName === "string" ? info.firstName.trim() : "";
  const lastName = typeof info.lastName === "string" ? info.lastName.trim() : "";
  const legacyName = typeof info.name === "string" ? info.name.trim() : "";
  return `${firstName} ${lastName}`.trim() || legacyName || "Client";
};

export const getCustomerTypeLabel = (customerInfo?: Record<string, unknown>) =>
  CUSTOMER_TYPE_LABELS[resolveCustomerType(customerInfo?.customerType)];
