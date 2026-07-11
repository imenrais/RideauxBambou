const EMAIL_SENDER_NAME = "Rideaux Bambou";

export function getShopUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getEmailFromAddress() {
  const smtpUser = process.env.EMAIL_SERVER_USER?.trim();

  // SMTP providers (especially Gmail) reject or spam-box mismatched From addresses.
  if (smtpUser) {
    return `${EMAIL_SENDER_NAME} <${smtpUser}>`;
  }

  const configuredFrom = process.env.EMAIL_FROM?.trim();
  if (configuredFrom?.includes("@")) {
    return `${EMAIL_SENDER_NAME} <${configuredFrom}>`;
  }

  return `${EMAIL_SENDER_NAME} <noreply@rideaux-bambou.com>`;
}

export function buildPromoUnsubscribeUrl(email: string) {
  return `${getShopUrl()}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function buildPromoEmailHeaders(recipientEmail: string) {
  const unsubscribeUrl = buildPromoUnsubscribeUrl(recipientEmail);
  const replyMailbox = process.env.EMAIL_SERVER_USER?.trim() || process.env.EMAIL_FROM?.trim();

  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>${replyMailbox ? `, <mailto:${replyMailbox}?subject=Desabonnement%20newsletter>` : ""}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
