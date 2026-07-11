import nodemailer from "nodemailer";

import {
  buildPromoEmailHeaders,
  buildPromoUnsubscribeUrl,
  getEmailFromAddress,
  getShopUrl,
} from "./email-sender";
import {
  escapeHtml,
  renderAlertBanner,
  renderBadge,
  renderDataTable,
  renderEmailLayout,
  renderFeatureList,
  renderHighlightCard,
  renderKeyValueCard,
  renderParagraph,
  renderPriceLine,
  renderPrimaryButton,
  renderSectionTitle,
  renderStatGrid,
  renderSteps,
  renderSummaryBox,
  renderTwoColumnCards,
} from "./email-templates";

const createTransporter = () => {
  const emailUser = process.env.EMAIL_SERVER_USER?.trim();
  const emailPassword = process.env.EMAIL_SERVER_PASSWORD?.replace(/\s+/g, "");
  const emailPort = parseInt((process.env.EMAIL_SERVER_PORT || "587").trim(), 10);

  if (!emailUser || !emailPassword) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || "smtp.gmail.com",
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email not configured. Welcome email would be sent to:", userEmail);
    return { success: false, message: "Email not configured" };
  }

  const shopUrl = getShopUrl();
  const safeName = escapeHtml(userName);
  const body = [
    renderParagraph(`Bonjour <strong>${safeName}</strong>,`),
    renderParagraph(
      "Merci de vous être inscrit(e) sur Rideaux Bambou. Nous sommes ravis de vous accueillir dans notre boutique de rideaux en bambou sur mesure."
    ),
    renderSectionTitle("Ce que vous pouvez faire"),
    renderFeatureList([
      { icon: "🛍️", text: "Parcourir notre collection de références" },
      { icon: "📏", text: "Configurer vos rideaux selon vos dimensions exactes" },
      { icon: "🌿", text: "Profiter de matériaux naturels et élégants" },
      { icon: "🚚", text: "Recevoir votre commande directement chez vous" },
    ]),
    `<div style="text-align:center;">${renderPrimaryButton(`${shopUrl}/configurer`, "Configurer mon rideau")}</div>`,
    renderParagraph("Une question ? Répondez simplement à cet email, notre équipe est là pour vous aider."),
  ].join("");

  const mailOptions = {
    from: getEmailFromAddress(),
    to: userEmail,
    subject: "Bienvenue chez Rideaux Bambou",
    html: renderEmailLayout({
      preheader: "Bienvenue dans la boutique Rideaux Bambou",
      title: "Bienvenue !",
      subtitle: "Votre compte est prêt. Découvrez nos rideaux en bambou sur mesure.",
      body,
      recipientEmail: userEmail,
    }),
    text: `
Bienvenue chez Rideaux Bambou

Bonjour ${userName},

Merci de vous être inscrit(e) sur notre plateforme.

Configurer un rideau: ${shopUrl}/configurer

Cordialement,
L'équipe Rideaux Bambou
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Welcome email sent successfully" };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, message: "Failed to send welcome email" };
  }
};

export const sendOrderConfirmationEmail = async (
  userEmail: string,
  userName: string,
  orderData: {
    orderId: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      dimensions: string;
    }>;
    totalAmount: number;
    shippingAddress: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
    orderDate: string;
    wantsInstallation?: boolean;
    installationFee?: number;
    deliveryFee?: number;
  }
) => {
  const transporter = createTransporter();
  const cleanedEmail = userEmail.trim().toLowerCase();

  if (!transporter) {
    console.log("Email not configured. Order confirmation would be sent to:", cleanedEmail);
    return { success: false, message: "Email not configured" };
  }

  const invoiceNumber = `RB-${orderData.orderId.slice(-8).toUpperCase()}`;
  const formattedDate = new Date(orderData.orderDate).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const shopUrl = getShopUrl();
  const safeName = escapeHtml(userName);

  const summaryRows = [];
  if (orderData.deliveryFee) {
    summaryRows.push({
      label: "Frais de livraison",
      value: `${orderData.deliveryFee.toFixed(2)} TND`,
    });
  }
  summaryRows.push({
    label: orderData.wantsInstallation ? "Frais de pose" : "Pose",
    value: orderData.wantsInstallation
      ? `${orderData.installationFee?.toFixed(2) || "0.00"} TND`
      : "Non demandée",
  });

  const body = [
    renderAlertBanner("Votre commande a bien été enregistrée.", "green"),
    renderParagraph(`Bonjour <strong>${safeName}</strong>,`),
    renderParagraph(
      "Merci pour votre confiance. Nous préparons vos rideaux en bambou sur mesure et vous tiendrons informé(e) de la suite."
    ),
    `<div style="margin:0 0 20px;">${renderBadge(`Facture ${invoiceNumber}`, "green")} <span style="display:inline-block;width:8px;"></span> ${renderBadge("Commande confirmée", "blue")}</div>`,
    renderTwoColumnCards(
      {
        title: "Commande",
        rows: [
          { label: "Numéro", value: escapeHtml(orderData.orderId) },
          { label: "Date", value: escapeHtml(formattedDate) },
          { label: "Statut", value: renderBadge("En préparation", "amber") },
        ],
      },
      {
        title: "Livraison",
        rows: [
          { label: "Adresse", value: escapeHtml(orderData.shippingAddress.street) },
          {
            label: "Ville",
            value: escapeHtml(
              `${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}`
            ),
          },
          { label: "Pays", value: escapeHtml(orderData.shippingAddress.country) },
        ],
      }
    ),
    renderSectionTitle("Détails de la commande"),
    renderDataTable(
      ["Produit", "Dimensions", "Qté", "Prix", "Total"],
      orderData.items.map((item) => [
        escapeHtml(item.name),
        escapeHtml(item.dimensions),
        escapeHtml(String(item.quantity)),
        `${item.price.toFixed(2)} TND`,
        `${(item.price * item.quantity).toFixed(2)} TND`,
      ])
    ),
    renderSummaryBox(summaryRows, "Total TTC", `${orderData.totalAmount.toFixed(2)} TND`),
    renderSectionTitle("Prochaines étapes"),
    renderSteps([
      "<strong>Préparation</strong> — fabrication sur mesure sous 2 à 3 jours ouvrables",
      "<strong>Expédition</strong> — vous recevrez un email de suivi",
      "<strong>Livraison</strong> — réception à l'adresse indiquée",
    ]),
    `<div style="text-align:center;">${renderPrimaryButton(`${shopUrl}/configurer`, "Configurer un autre rideau")}</div>`,
    renderParagraph("Pour toute question concernant votre commande, répondez à cet email."),
  ].join("");

  const mailOptions = {
    from: getEmailFromAddress(),
    to: cleanedEmail,
    subject: `Commande confirmée · ${invoiceNumber}`,
    html: renderEmailLayout({
      preheader: `Votre commande ${invoiceNumber} est confirmée`,
      title: "Merci pour votre commande",
      subtitle: "Voici le récapitulatif de votre achat.",
      body,
      recipientEmail: cleanedEmail,
    }),
    text: `
Commande confirmée - ${invoiceNumber}

Bonjour ${userName},

Numéro de commande: ${orderData.orderId}
Date: ${formattedDate}

Adresse:
${orderData.shippingAddress.street}
${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}
${orderData.shippingAddress.country}

Articles:
${orderData.items
  .map(
    (item) =>
      `- ${item.name} | ${item.dimensions} | Qté ${item.quantity} | ${(item.price * item.quantity).toFixed(2)} TND`
  )
  .join("\n")}

Total: ${orderData.totalAmount.toFixed(2)} TND

Cordialement,
L'équipe Rideaux Bambou
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Order confirmation email sent successfully" };
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    try {
      await transporter.sendMail({
        from: getEmailFromAddress(),
        to: cleanedEmail,
        subject: `Résumé commande ${invoiceNumber} - Rideaux Bambou`,
        text: mailOptions.text,
      });
      return { success: true, message: "Order summary email sent via fallback text template" };
    } catch (fallbackError) {
      console.error("Fallback order email failed:", fallbackError);
      return { success: false, message: "Failed to send order confirmation email" };
    }
  }
};

export interface SaleNotificationContent {
  hasActiveSale: boolean;
  store?: {
    listPrice: number;
    salePrice: number;
  };
  panneau?: Array<{
    label: string;
    widthCm: number;
    listPrice: number;
    salePrice: number;
  }>;
}

export const sendSaleNotificationEmail = async (
  userEmail: string,
  saleSummary: SaleNotificationContent
) => {
  const transporter = createTransporter();
  const cleanedEmail = userEmail.trim().toLowerCase();
  const shopUrl = getShopUrl();
  const unsubscribeUrl = buildPromoUnsubscribeUrl(cleanedEmail);
  const replyMailbox = process.env.EMAIL_SERVER_USER?.trim() || process.env.EMAIL_FROM?.trim();

  if (!transporter) {
    console.log("Email not configured. Sale notification would be sent to:", cleanedEmail);
    return { success: false, message: "Email not configured" };
  }

  const offerCards: string[] = [];

  if (saleSummary.store) {
    offerCards.push(
      renderHighlightCard(
        "Rideaux sur mesure",
        renderPriceLine(saleSummary.store.listPrice, saleSummary.store.salePrice, " / m²"),
        "green"
      )
    );
  }

  if (saleSummary.panneau?.length) {
    const panneauContent = saleSummary.panneau
      .map(
        (width) => `
        <div style="margin-bottom:10px;">
          <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(width.label)} (${width.widthCm} cm)</div>
          ${renderPriceLine(width.listPrice, width.salePrice)}
        </div>`
      )
      .join("");

    offerCards.push(renderHighlightCard("Panneaux", panneauContent, "amber"));
  }

  const body = [
    renderParagraph("Bonjour,"),
    renderParagraph("Une nouvelle offre est disponible sur notre boutique en ligne."),
    ...offerCards,
    `<div style="text-align:center;">${renderPrimaryButton(`${shopUrl}/configurer`, "Découvrir l'offre")}</div>`,
    renderParagraph(
      `<span style="font-size:13px;color:#6b7280;">Vous recevez cet email car vous êtes inscrit(e) à nos offres. <a href="${unsubscribeUrl}" style="color:#6b7280;">Se désabonner</a></span>`
    ),
  ].join("");

  const mailOptions = {
    from: getEmailFromAddress(),
    to: cleanedEmail,
    replyTo: replyMailbox || undefined,
    subject: "Nouvelle offre Rideaux Bambou",
    headers: buildPromoEmailHeaders(cleanedEmail),
    html: renderEmailLayout({
      preheader: "Profitez de la nouvelle offre Rideaux Bambou",
      title: "Nouvelle offre disponible",
      subtitle: "Des tarifs avantageux sur nos rideaux et panneaux.",
      body,
      recipientEmail: cleanedEmail,
      footerExtra: `<a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Se désabonner des offres promotionnelles</a>`,
    }),
    text: `
Nouvelle offre Rideaux Bambou

${
  saleSummary.store
    ? `Rideaux sur mesure: ${saleSummary.store.salePrice.toFixed(2)} TND / m² (au lieu de ${saleSummary.store.listPrice.toFixed(2)} TND / m²)`
    : ""
}
${
  saleSummary.panneau
    ?.map(
      (width) =>
        `Panneau ${width.label} (${width.widthCm} cm): ${width.salePrice.toFixed(2)} TND (au lieu de ${width.listPrice.toFixed(2)} TND)`
    )
    .join("\n") || ""
}

Voir l'offre: ${shopUrl}/configurer
Se désabonner: ${unsubscribeUrl}
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Sale notification sent" };
  } catch (error) {
    console.error("Error sending sale notification email:", error);
    return { success: false, message: "Failed to send sale notification email" };
  }
};

export const sendAdminOrderNotificationEmail = async (orderData: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  recipients?: string[];
}) => {
  const transporter = createTransporter();

  const configuredRecipient = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_SERVER_USER;
  const recipients = Array.from(
    new Set([...(orderData.recipients || []), ...(configuredRecipient ? [configuredRecipient] : [])])
  ).filter(Boolean);

  if (!transporter || recipients.length === 0) {
    console.log("Admin notification email not configured.");
    return { success: false, message: "Admin email not configured" };
  }

  const dashboardUrl = `${getShopUrl()}/admin/orders`;
  const createdAt = new Date(orderData.createdAt).toLocaleString("fr-FR");

  const body = [
    renderAlertBanner("Une nouvelle commande vient d'être passée sur la boutique.", "blue"),
    renderStatGrid([
      { label: "Total commande", value: `${orderData.totalAmount.toFixed(2)} TND` },
      { label: "Articles", value: escapeHtml(String(orderData.itemCount)) },
      { label: "Client", value: escapeHtml(orderData.customerName) },
      { label: "Date", value: escapeHtml(createdAt) },
    ]),
    renderKeyValueCard("Informations client", [
      { label: "Nom", value: escapeHtml(orderData.customerName) },
      {
        label: "Email",
        value: orderData.customerEmail
          ? `<a href="mailto:${escapeHtml(orderData.customerEmail)}" style="color:#16a34a;text-decoration:none;">${escapeHtml(orderData.customerEmail)}</a>`
          : "—",
      },
      { label: "Téléphone", value: escapeHtml(orderData.customerPhone || "—") },
      { label: "Commande", value: escapeHtml(orderData.orderId) },
    ]),
    `<div style="text-align:center;">${renderPrimaryButton(dashboardUrl, "Ouvrir le tableau de commandes")}</div>`,
  ].join("");

  const mailOptions = {
    from: getEmailFromAddress(),
    to: recipients.join(","),
    subject: `Nouvelle commande · ${orderData.orderId.slice(-8).toUpperCase()}`,
    html: renderEmailLayout({
      preheader: `Nouvelle commande de ${orderData.customerName}`,
      title: "Nouvelle commande reçue",
      subtitle: "Consultez les détails et traitez la commande depuis l'admin.",
      body,
    }),
    text: `
Nouvelle commande reçue

Commande: ${orderData.orderId}
Client: ${orderData.customerName}
Email: ${orderData.customerEmail}
Téléphone: ${orderData.customerPhone}
Articles: ${orderData.itemCount}
Total: ${orderData.totalAmount.toFixed(2)} TND
Date: ${createdAt}

Dashboard: ${dashboardUrl}
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Admin notification sent" };
  } catch (error) {
    console.error("Error sending admin notification:", error);
    return { success: false, message: "Failed to send admin notification" };
  }
};
