import { requiredEmailSchema } from "./email-validation";
import { prisma } from "./prisma";

export type PromoSubscriberSource = "newsletter" | "order";

function extractValidEmailFromCustomerInfo(customerInfo: unknown): string | null {
  if (!customerInfo || typeof customerInfo !== "object") {
    return null;
  }

  const email = (customerInfo as { email?: unknown }).email;
  if (typeof email !== "string") {
    return null;
  }

  const validation = requiredEmailSchema.safeParse(email);
  return validation.success ? validation.data : null;
}

export async function subscribePromoEmail(
  email: string,
  source: PromoSubscriberSource
): Promise<{ subscribed: boolean; email?: string }> {
  const validation = requiredEmailSchema.safeParse(email);
  if (!validation.success) {
    return { subscribed: false };
  }

  const normalizedEmail = validation.data;

  await prisma.promoSubscriber.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      source,
      isActive: true,
    },
    update: {
      isActive: true,
    },
  });

  return { subscribed: true, email: normalizedEmail };
}

export async function syncPromoSubscribersFromOrderEmails(): Promise<number> {
  const orders = await prisma.order.findMany({
    select: { customerInfo: true },
  });

  const emails = new Set<string>();
  for (const order of orders) {
    const email = extractValidEmailFromCustomerInfo(order.customerInfo);
    if (email) {
      emails.add(email);
    }
  }

  let synced = 0;
  for (const email of emails) {
    const result = await subscribePromoEmail(email, "order");
    if (result.subscribed) {
      synced += 1;
    }
  }

  return synced;
}

export async function getActivePromoSubscriberEmails(): Promise<string[]> {
  const subscribers = await prisma.promoSubscriber.findMany({
    where: { isActive: true },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  return subscribers.map((subscriber) => subscriber.email);
}

export async function getPromoNotificationEmails(): Promise<string[]> {
  await syncPromoSubscribersFromOrderEmails();

  const subscribers = await prisma.promoSubscriber.findMany({
    where: { isActive: true },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  return [...new Set(subscribers.map((subscriber) => subscriber.email))];
}

export async function unsubscribePromoEmail(email: string): Promise<boolean> {
  const validation = requiredEmailSchema.safeParse(email);
  if (!validation.success) {
    return false;
  }

  await prisma.promoSubscriber.updateMany({
    where: { email: validation.data },
    data: { isActive: false },
  });

  return true;
}
