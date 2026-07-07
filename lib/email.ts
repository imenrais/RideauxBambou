import nodemailer from "nodemailer";

// Email configuration
const createTransporter = () => {
  const emailUser = process.env.EMAIL_SERVER_USER?.trim();
  const emailPassword = process.env.EMAIL_SERVER_PASSWORD?.replace(/\s+/g, "");
  const emailPort = parseInt((process.env.EMAIL_SERVER_PORT || "587").trim(), 10);

  // Check if email is configured
  if (!emailUser || !emailPassword) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || "smtp.gmail.com",
    port: emailPort,
    secure: emailPort === 465, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

// Welcome email template
export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email not configured. Welcome email would be sent to:", userEmail);
    return { success: false, message: "Email not configured" };
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@rideaux-bambou.com",
    to: userEmail,
    subject: "Bienvenue chez Rideaux Bambou ! 🌿",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #f9fafb; }
            .header { background: linear-gradient(135deg, #16a34a, #22c55e); padding: 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; background-color: white; }
            .welcome-text { font-size: 18px; margin-bottom: 20px; color: #16a34a; font-weight: bold; }
            .features { margin: 30px 0; }
            .feature { display: flex; align-items: center; margin: 15px 0; padding: 10px; background-color: #f0fdf4; border-radius: 8px; }
            .feature-icon { font-size: 24px; margin-right: 15px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
            .social-links { margin: 20px 0; }
            .social-links a { margin: 0 10px; color: #16a34a; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌿 Rideaux Bambou</h1>
              <p>Découpe sur mesure</p>
            </div>
            
            <div class="content">
              <div class="welcome-text">
                Bienvenue ${userName} ! 🎉
              </div>
              
              <p>Merci de vous être inscrit(e) sur notre plateforme. Nous sommes ravis de vous accueillir dans notre communauté de passionnés de rideaux en bambou naturels.</p>
              
              <div class="features">
                <h3>Ce que vous pouvez faire maintenant :</h3>
                <div class="feature">
                  <span class="feature-icon">🛍️</span>
                  <span>Parcourir notre collection de rideaux en bambou</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">📏</span>
                  <span>Commander des rideaux sur mesure selon vos dimensions</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">💚</span>
                  <span>Profiter de matériaux 100% naturels et écologiques</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">🚚</span>
                  <span>Recevoir vos commandes directement chez vous</span>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/products" class="cta-button">
                  Découvrir nos Rideaux
                </a>
              </div>
              
              <p>Si vous avez des questions, n'hésitez pas à nous contacter. Notre équipe est là pour vous aider !</p>
              
              <div class="social-links">
                <p>Suivez-nous :</p>
                <a href="#">Facebook</a>
                <a href="#">Instagram</a>
                <a href="#">LinkedIn</a>
              </div>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Rideaux Bambou. Tous droits réservés.</p>
              <p>Cet email a été envoyé à ${userEmail}</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Bienvenue chez Rideaux Bambou ! 🌿
      
      Bonjour ${userName},
      
      Merci de vous être inscrit(e) sur notre plateforme. Nous sommes ravis de vous accueillir dans notre communauté de passionnés de rideaux en bambou naturels.
      
      Ce que vous pouvez faire maintenant :
      🛍️ Parcourir notre collection de rideaux en bambou
      📏 Commander des rideaux sur mesure selon vos dimensions
      💚 Profiter de matériaux 100% naturels et écologiques
      🚚 Recevoir vos commandes directement chez vous
      
      Découvrez nos rideaux : ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/products
      
      Si vous avez des questions, n'hésitez pas à nous contacter.
      
      Cordialement,
      L'équipe Rideaux Bambou
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Welcome email sent successfully" };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, message: "Failed to send welcome email" };
  }
};

// Order confirmation email with invoice
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

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@rideaux-bambou.com",
    to: cleanedEmail,
    subject: `Facture ${invoiceNumber} - Commande confirmée chez Rideaux Bambou`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 700px; margin: 0 auto; background-color: #f9fafb; }
            .header { background: linear-gradient(135deg, #16a34a, #22c55e); padding: 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; background-color: white; }
            .invoice-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
            .invoice-title { font-size: 24px; font-weight: bold; color: #16a34a; }
            .invoice-number { font-size: 18px; color: #6b7280; }
            .order-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .info-section h3 { color: #16a34a; margin-bottom: 10px; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .items-table th { background-color: #f3f4f6; font-weight: bold; color: #374151; }
            .total-section { background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .total-amount { font-size: 24px; font-weight: bold; color: #16a34a; text-align: right; }
            .status-badge { display: inline-block; background-color: #16a34a; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
            .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌿 Rideaux Bambou</h1>
              <p>Découpe sur mesure</p>
            </div>
            
            <div class="content">
              <div class="invoice-header">
                <div>
                  <div class="invoice-title">FACTURE</div>
                  <div class="invoice-number">${invoiceNumber}</div>
                </div>
                <div>
                  <div class="status-badge">✅ Commande Confirmée</div>
                </div>
              </div>
              
              <p>Bonjour ${userName},</p>
              <p>Merci pour votre commande ! Nous avons bien reçu votre demande et nous préparons vos rideaux en bambou sur mesure.</p>
              
              <div class="order-info">
                <div>
                  <h3>Informations de commande</h3>
                  <p><strong>Numéro de commande :</strong> ${orderData.orderId}</p>
                  <p><strong>Date de commande :</strong> ${formattedDate}</p>
                  <p><strong>Statut :</strong> <span class="status-badge">En préparation</span></p>
                </div>
                <div>
                  <h3>Adresse de livraison</h3>
                  <p>${orderData.shippingAddress.street}<br>
                  ${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}<br>
                  ${orderData.shippingAddress.country}</p>
                </div>
              </div>
              
              <h3>Détails de votre commande</h3>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Dimensions</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderData.items
                    .map(
                      (item) => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${item.dimensions}</td>
                      <td>${item.quantity}</td>
                      <td>${item.price.toFixed(2)} TND</td>
                      <td>${(item.price * item.quantity).toFixed(2)} TND</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
              
              <div class="total-section">
                ${
                  orderData.deliveryFee
                    ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>Frais de livraison :</span>
                  <span>${orderData.deliveryFee.toFixed(2)} TND</span>
                </div>
                `
                    : ""
                }
                ${
                  orderData.wantsInstallation
                    ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>Frais d'installation :</span>
                  <span>${orderData.installationFee?.toFixed(2) || "0.00"} TND</span>
                </div>
                `
                    : `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>Installation :</span>
                  <span>Non demandée</span>
                </div>
                `
                }
                <div class="total-amount">
                  Total : ${orderData.totalAmount.toFixed(2)} TND
                </div>
              </div>
              
              <h3>Prochaines étapes</h3>
              <p>1. <strong>Préparation :</strong> Nos artisans préparent vos rideaux sur mesure (2-3 jours ouvrables)</p>
              <p>2. <strong>Expédition :</strong> Vous recevrez un email de suivi avec le numéro de colis</p>
              <p>3. <strong>Livraison :</strong> Vos rideaux seront livrés à l'adresse indiquée</p>
              
              <div style="text-align: center;">
                <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/products" class="cta-button">
                  Continuer mes achats
                </a>
              </div>
              
              <p>Si vous avez des questions concernant votre commande, n'hésitez pas à nous contacter.</p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Rideaux Bambou. Tous droits réservés.</p>
              <p>Cet email a été envoyé à ${userEmail}</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      FACTURE ${invoiceNumber} - Commande confirmée chez Rideaux Bambou
      
      Bonjour ${userName},
      
      Merci pour votre commande ! Nous avons bien reçu votre demande et nous préparons vos rideaux en bambou sur mesure.
      
      Informations de commande :
      - Numéro de commande : ${orderData.orderId}
      - Date de commande : ${formattedDate}
      - Statut : En préparation
      
      Adresse de livraison :
      ${orderData.shippingAddress.street}
      ${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}
      ${orderData.shippingAddress.country}
      
      Détails de votre commande :
      ${orderData.items
        .map(
          (item) =>
            `${item.name} - ${item.dimensions} - Quantité: ${item.quantity} - Prix: ${item.price.toFixed(2)} TND - Total: ${(item.price * item.quantity).toFixed(2)} TND`
        )
        .join("\n")}
      
      ${
        orderData.deliveryFee
          ? `Frais de livraison : ${orderData.deliveryFee.toFixed(2)} TND`
          : ""
      }
      ${
        orderData.wantsInstallation
          ? `Frais d'installation : ${orderData.installationFee?.toFixed(2) || "0.00"} TND`
          : `Installation : Non demandée`
      }
      Total : ${orderData.totalAmount.toFixed(2)} TND
      
      Prochaines étapes :
      1. Préparation : Nos artisans préparent vos rideaux sur mesure (2-3 jours ouvrables)
      2. Expédition : Vous recevrez un email de suivi avec le numéro de colis
      3. Livraison : Vos rideaux seront livrés à l'adresse indiquée
      
      Cordialement,
      L'équipe Rideaux Bambou
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Order confirmation email sent successfully" };
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || "noreply@rideaux-bambou.com",
        to: cleanedEmail,
        subject: `Résumé commande ${invoiceNumber} - Rideaux Bambou`,
        text: `
Commande: ${orderData.orderId}
Date: ${formattedDate}
Client: ${userName}
Adresse: ${orderData.shippingAddress.street}, ${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}, ${orderData.shippingAddress.country}
Articles:
${orderData.items
  .map(
    (item) =>
      `- ${item.name} | ${item.dimensions} | Qté ${item.quantity} | ${(
        item.price * item.quantity
      ).toFixed(2)} TND`
  )
  .join("\n")}
Livraison: ${(orderData.deliveryFee || 0).toFixed(2)} TND
Installation: ${
          orderData.wantsInstallation ? (orderData.installationFee || 0).toFixed(2) + " TND" : "Non demandée"
        }
Total: ${orderData.totalAmount.toFixed(2)} TND
`,
      });
      return { success: true, message: "Order summary email sent via fallback text template" };
    } catch (fallbackError) {
      console.error("Fallback order email failed:", fallbackError);
      return { success: false, message: "Failed to send order confirmation email" };
    }
  }
};

// Admin new-order notification email
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

  const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/orders`;
  const createdAt = new Date(orderData.createdAt).toLocaleString("fr-FR");

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@rideaux-bambou.com",
    to: recipients.join(","),
    subject: `Nouvelle commande recue - ${orderData.orderId}`,
    html: `
      <h2>Nouvelle commande client</h2>
      <p><strong>Commande:</strong> ${orderData.orderId}</p>
      <p><strong>Client:</strong> ${orderData.customerName}</p>
      <p><strong>Email:</strong> ${orderData.customerEmail}</p>
      <p><strong>Telephone:</strong> ${orderData.customerPhone}</p>
      <p><strong>Articles:</strong> ${orderData.itemCount}</p>
      <p><strong>Total:</strong> ${orderData.totalAmount.toFixed(2)} TND</p>
      <p><strong>Date:</strong> ${createdAt}</p>
      <p><a href="${dashboardUrl}">Voir dans le dashboard admin</a></p>
    `,
    text: `
Nouvelle commande client
- Commande: ${orderData.orderId}
- Client: ${orderData.customerName}
- Email: ${orderData.customerEmail}
- Telephone: ${orderData.customerPhone}
- Articles: ${orderData.itemCount}
- Total: ${orderData.totalAmount.toFixed(2)} TND
- Date: ${createdAt}

Dashboard admin: ${dashboardUrl}
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Admin notification sent" };
  } catch (error) {
    console.error("Error sending admin notification:", error);
    return { success: false, message: "Failed to send admin notification" };
  }
};
