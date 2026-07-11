import { sendSaleNotificationEmail } from "./email";
import { delay } from "./email-sender";
import { getPanneauConfig } from "./panneau-config-store";
import { getEffectivePanneauWidthPrice, getPanneauWidthDisplayLabel } from "./panneau-types";
import { getPriceData } from "./price-store";
import { getPromoNotificationEmails } from "./promo-subscriber-store";

export type { SaleNotificationContent as ActiveSaleSummary } from "./email";

export type SaleNotificationResult = {
  sent: number;
  failed: number;
  skipped: boolean;
  recipientCount: number;
};

const PROMO_NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000;
const PROMO_EMAIL_DELAY_MS = 1200;

let lastBulkNotificationAt = 0;
let lastBulkNotificationHash = "";

function hashSaleSummary(summary: Awaited<ReturnType<typeof buildActiveSaleSummary>>) {
  return JSON.stringify({
    store: summary.store ?? null,
    panneau: summary.panneau ?? null,
  });
}

export async function buildActiveSaleSummary() {
  const [priceData, panneauConfig] = await Promise.all([getPriceData(), getPanneauConfig()]);

  const summary = { hasActiveSale: false } as {
    hasActiveSale: boolean;
    store?: { listPrice: number; salePrice: number };
    panneau?: Array<{
      label: string;
      widthCm: number;
      listPrice: number;
      salePrice: number;
    }>;
  };

  if (
    priceData.isSaleActive === true &&
    typeof priceData.salePricePerM2 === "number" &&
    priceData.salePricePerM2 > 0 &&
    priceData.salePricePerM2 < priceData.pricePerM2
  ) {
    summary.hasActiveSale = true;
    summary.store = {
      listPrice: priceData.pricePerM2,
      salePrice: priceData.salePricePerM2,
    };
  }

  if (panneauConfig.isSaleActive === true) {
    const panneauOffers = panneauConfig.widths
      .map((width) => {
        const salePrice = getEffectivePanneauWidthPrice(width, true);
        if (salePrice >= width.price) {
          return null;
        }

        return {
          label: getPanneauWidthDisplayLabel(width),
          widthCm: width.widthCm,
          listPrice: width.price,
          salePrice,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (panneauOffers.length > 0) {
      summary.hasActiveSale = true;
      summary.panneau = panneauOffers;
    }
  }

  return summary;
}

export async function notifyPromoSubscribersOfCurrentSales(): Promise<SaleNotificationResult> {
  const summary = await buildActiveSaleSummary();
  if (!summary.hasActiveSale) {
    return { sent: 0, failed: 0, skipped: true, recipientCount: 0 };
  }

  const recipients = await getPromoNotificationEmails();
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, skipped: true, recipientCount: 0 };
  }

  const summaryHash = hashSaleSummary(summary);
  const now = Date.now();
  if (
    now - lastBulkNotificationAt < PROMO_NOTIFICATION_COOLDOWN_MS &&
    lastBulkNotificationHash === summaryHash
  ) {
    console.log("Skipping duplicate promo notification during cooldown.");
    return { sent: 0, failed: 0, skipped: true, recipientCount: recipients.length };
  }

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < recipients.length; index += 1) {
    if (index > 0) {
      await delay(PROMO_EMAIL_DELAY_MS);
    }

    const email = recipients[index];
    const result = await sendSaleNotificationEmail(email, summary);
    if (result.success) {
      sent += 1;
    } else {
      failed += 1;
      console.error("Sale notification failed for:", email, result.message);
    }
  }

  if (sent > 0) {
    lastBulkNotificationAt = now;
    lastBulkNotificationHash = summaryHash;
  }

  console.log(
    `Sale notifications: ${sent} sent, ${failed} failed, ${recipients.length} recipients`
  );

  return { sent, failed, skipped: false, recipientCount: recipients.length };
}

export async function notifyPromoSubscriberIfSalesActive(email: string) {
  const summary = await buildActiveSaleSummary();
  if (!summary.hasActiveSale) {
    return { sent: false, skipped: true };
  }

  const result = await sendSaleNotificationEmail(email, summary);
  return { sent: result.success, skipped: false, message: result.message };
}
