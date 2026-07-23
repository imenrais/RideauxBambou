import { resolveCustomerType, type CustomerType } from "./customer-info";

export const TVA_RATE = 0.19;
export const FODEC_RATE = 0.01;
export const TIMBRE_FISCAL_AMOUNT = 1;

const roundAmount = (value: number) => Math.round(value * 1000) / 1000;

export interface OrderInvoiceTotals {
  customerType: CustomerType;
  productsSubtotal: number;
  deliveryFee: number;
  installationFee: number;
  /** Merchandise used for FODEC (products only). */
  fodecBase: number;
  /** Products + pose (before FODEC / delivery). Kept for reference; not used in company Total H.T. */
  merchandiseSubtotal: number;
  /** Base HT stored on the order (products + delivery + pose). */
  baseHt: number;
  /**
   * Displayed Total H.T.
   * Company / admin particulier fiscal invoice: products + FODEC (pose and delivery excluded).
   * Person (client-facing): full base including delivery and pose.
   */
  totalHt: number;
  fodec: number;
  tva: number;
  timbreFiscal: number;
  totalTtc: number;
}

export interface InvoiceSummaryLine {
  label: string;
  amount: number;
  emphasis?: boolean;
  /** Overrides formatted currency (e.g. "Gratuit"). */
  displayText?: string;
}

export interface OrderSummaryOptions {
  /** Show delivery line only after a governorate is selected. */
  regionSelected?: boolean;
  isFreeDeliveryActive?: boolean;
}

export interface InvoiceTotalsOptions {
  /**
   * Admin printed invoices: apply company FODEC / H.T / TTC math for particuliers too.
   * Does not change checkout or client-facing totals.
   */
  applyCompanyFiscalBreakdown?: boolean;
}

export interface PrintedInvoiceOptions {
  /** Particulier only — add TVA + timbre (+ FODEC) on admin printed invoices. */
  includePersonTax?: boolean;
}

export const getOrderCustomerType = (customerInfo?: Record<string, unknown>): CustomerType =>
  resolveCustomerType(customerInfo?.customerType);

/**
 * `totalAmount` is the HT base (products + delivery + installation).
 *
 * Company (and admin particulier invoices with `applyCompanyFiscalBreakdown`):
 *   FODEC = 1% of products only
 *   Total H.T = products + FODEC (pose and delivery excluded)
 *   TVA = 19% of Total H.T
 *   TTC = Total H.T + TVA + timbre + pose + delivery
 *
 * Particulier (stored / client-facing totals):
 *   Total H.T = base (products + delivery + pose)
 *   TVA / timbre computed for optional fiscal invoices only.
 */
export const calculateOrderInvoiceTotals = (
  order: {
    totalAmount: number;
    deliveryFee?: number;
    installationFee?: number;
    customerInfo?: Record<string, unknown>;
  },
  options: InvoiceTotalsOptions = {}
): OrderInvoiceTotals => {
  const customerType = getOrderCustomerType(order.customerInfo);
  const useCompanyFiscal =
    customerType === "company" || options.applyCompanyFiscalBreakdown === true;
  const deliveryFee = order.deliveryFee ?? 0;
  const installationFee = order.installationFee ?? 0;
  const storedTotal = order.totalAmount ?? 0;
  const productsSubtotal = roundAmount(storedTotal - deliveryFee - installationFee);
  const merchandiseSubtotal = roundAmount(productsSubtotal + installationFee);
  const baseHt = roundAmount(storedTotal);
  const fodecBase = productsSubtotal;
  const fodec = useCompanyFiscal ? roundAmount(fodecBase * FODEC_RATE) : 0;
  const totalHt = useCompanyFiscal
    ? roundAmount(productsSubtotal + fodec)
    : baseHt;
  const tva = roundAmount(totalHt * TVA_RATE);
  const timbreFiscal = TIMBRE_FISCAL_AMOUNT;
  const totalTtc = useCompanyFiscal
    ? roundAmount(totalHt + tva + timbreFiscal + installationFee + deliveryFee)
    : roundAmount(totalHt + tva + timbreFiscal);

  return {
    customerType,
    productsSubtotal,
    deliveryFee,
    installationFee,
    fodecBase,
    merchandiseSubtotal,
    baseHt,
    totalHt,
    fodec,
    tva,
    timbreFiscal,
    totalTtc,
  };
};

/** Amount shown in checkout, confirmation, and admin lists. */
export const getOrderDisplayTotal = (order: {
  totalAmount: number;
  deliveryFee?: number;
  installationFee?: number;
  customerInfo?: Record<string, unknown>;
}) => {
  const totals = calculateOrderInvoiceTotals(order);
  return totals.customerType === "company" ? totals.totalTtc : totals.totalHt;
};

const appendInstallationLine = (
  lines: InvoiceSummaryLine[],
  totals: OrderInvoiceTotals
) => {
  if (totals.installationFee <= 0) {
    return;
  }

  lines.push({
    label: "Frais de pose",
    amount: totals.installationFee,
  });
};

const appendDeliveryLine = (
  lines: InvoiceSummaryLine[],
  totals: OrderInvoiceTotals,
  options: OrderSummaryOptions
) => {
  if (!options.regionSelected) {
    return;
  }

  const isFree =
    options.isFreeDeliveryActive === true || totals.deliveryFee === 0;
  lines.push({
    label: "Frais de livraison",
    amount: totals.deliveryFee,
    displayText: isFree ? "Gratuit" : undefined,
  });
};

/** Checkout / order-success / admin order preview — no TVA/timbre for particuliers. */
export const getOrderSummaryLines = (
  totals: OrderInvoiceTotals,
  options: OrderSummaryOptions = {}
): InvoiceSummaryLine[] => {
  if (totals.customerType === "person") {
    const lines: InvoiceSummaryLine[] = [
      { label: "Sous-total", amount: totals.productsSubtotal },
    ];
    appendInstallationLine(lines, totals);
    appendDeliveryLine(lines, totals, options);
    lines.push({ label: "Total", amount: totals.totalHt, emphasis: true });
    return lines;
  }

  const lines: InvoiceSummaryLine[] = [
    { label: "Sous-total", amount: totals.productsSubtotal },
    { label: "FODEC 1%", amount: totals.fodec },
    { label: "Total H.T", amount: totals.totalHt },
    { label: "T.V.A 19%", amount: totals.tva },
    { label: "Timbre fiscale", amount: totals.timbreFiscal },
  ];
  appendInstallationLine(lines, totals);
  appendDeliveryLine(lines, totals, options);
  lines.push({ label: "Prix T.T.C", amount: totals.totalTtc, emphasis: true });
  return lines;
};

/** Printed invoice in admin — particulier gets the same fiscal lines as companies (FODEC, TVA, timbre). */
export const getPrintedInvoiceLines = (
  totals: OrderInvoiceTotals,
  options: PrintedInvoiceOptions = {}
): InvoiceSummaryLine[] => {
  const includePersonTax = options.includePersonTax ?? false;
  const useCompanyFiscalLines =
    totals.customerType === "company" || includePersonTax;

  if (!useCompanyFiscalLines) {
    return [{ label: "Total H.T", amount: totals.totalHt, emphasis: true }];
  }

  const lines: InvoiceSummaryLine[] = [
    { label: "FODEC 1%", amount: totals.fodec },
    { label: "Total H.T", amount: totals.totalHt },
    { label: "T.V.A 19%", amount: totals.tva },
    { label: "Timbre fiscale", amount: totals.timbreFiscal },
  ];
  if (totals.installationFee > 0) {
    lines.push({ label: "Frais de pose", amount: totals.installationFee });
  }
  if (totals.deliveryFee > 0) {
    lines.push({ label: "Frais de livraison", amount: totals.deliveryFee });
  }
  lines.push({ label: "Prix T.T.C", amount: totals.totalTtc, emphasis: true });
  return lines;
};

export const getPrintedInvoiceGrandTotal = (
  totals: OrderInvoiceTotals,
  options: PrintedInvoiceOptions = {}
) => {
  const includePersonTax = options.includePersonTax ?? false;
  if (totals.customerType === "company" || includePersonTax) {
    return totals.totalTtc;
  }
  return totals.totalHt;
};

/** @deprecated use getOrderSummaryLines or getPrintedInvoiceLines */
export const getInvoiceSummaryLines = getOrderSummaryLines;

/** @deprecated use getOrderSummaryLines */
export const getCompanyInvoiceSummaryLines = getOrderSummaryLines;
