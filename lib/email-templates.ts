import { getShopUrl } from "./email-sender";

const COLORS = {
  green: "#16a34a",
  greenDark: "#15803d",
  greenLight: "#f0fdf4",
  greenBorder: "#bbf7d0",
  amber: "#d97706",
  amberLight: "#fffbeb",
  amberBorder: "#fde68a",
  blue: "#2563eb",
  blueLight: "#eff6ff",
  blueBorder: "#bfdbfe",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  surface: "#f9fafb",
  white: "#ffffff",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EmailLayoutOptions = {
  preheader?: string;
  title: string;
  subtitle?: string;
  body: string;
  footerExtra?: string;
  recipientEmail?: string;
};

export function renderEmailLayout({
  preheader,
  title,
  subtitle,
  body,
  footerExtra,
  recipientEmail,
}: EmailLayoutOptions): string {
  const shopUrl = getShopUrl();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.surface};font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.surface};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background-color:${COLORS.white};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:${COLORS.green};padding:28px 32px;text-align:center;">
              <a href="${shopUrl}" style="text-decoration:none;color:#ffffff;">
                <div style="font-size:26px;font-weight:700;letter-spacing:0.2px;line-height:1.2;">Rideaux Bambou</div>
                <div style="margin-top:6px;font-size:13px;opacity:0.92;">Rideaux en bambou sur mesure</div>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 ${subtitle ? "8px" : "20px"};font-size:24px;line-height:1.3;color:${COLORS.text};">${escapeHtml(title)}</h1>
              ${
                subtitle
                  ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(subtitle)}</p>`
                  : ""
              }
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;background-color:${COLORS.surface};border-top:1px solid ${COLORS.border};text-align:center;">
              ${footerExtra ? `<div style="margin-bottom:12px;font-size:12px;line-height:1.6;color:${COLORS.muted};">${footerExtra}</div>` : ""}
              <p style="margin:0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
                © ${year} Rideaux Bambou
                ${recipientEmail ? `<br>Email envoyé à ${escapeHtml(recipientEmail)}` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${COLORS.text};">${text}</p>`;
}

export function renderPrimaryButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px;">
    <tr>
      <td align="center" style="border-radius:10px;background-color:${COLORS.green};">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function renderSecondaryButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 8px;">
    <tr>
      <td align="center" style="border-radius:10px;border:1px solid ${COLORS.border};background-color:${COLORS.white};">
        <a href="${href}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:${COLORS.green};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function renderBadge(
  label: string,
  variant: "green" | "amber" | "blue" = "green"
): string {
  const styles = {
    green: { bg: COLORS.greenLight, color: COLORS.greenDark, border: COLORS.greenBorder },
    amber: { bg: COLORS.amberLight, color: COLORS.amber, border: COLORS.amberBorder },
    blue: { bg: COLORS.blueLight, color: COLORS.blue, border: COLORS.blueBorder },
  }[variant];

  return `<span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:${styles.bg};border:1px solid ${styles.border};color:${styles.color};font-size:12px;font-weight:700;">${escapeHtml(label)}</span>`;
}

export function renderSectionTitle(title: string): string {
  return `<h2 style="margin:28px 0 12px;font-size:16px;line-height:1.4;color:${COLORS.text};">${escapeHtml(title)}</h2>`;
}

export function renderKeyValueCard(
  title: string,
  rows: Array<{ label: string; value: string }>
): string {
  const rowsHtml = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};width:42%;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:8px 0;font-size:14px;color:${COLORS.text};font-weight:600;vertical-align:top;">${row.value}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:14px 16px;background-color:${COLORS.surface};border-bottom:1px solid ${COLORS.border};font-size:13px;font-weight:700;color:${COLORS.greenDark};">${escapeHtml(title)}</td>
    </tr>
    <tr>
      <td style="padding:14px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td>
    </tr>
  </table>`;
}

export function renderTwoColumnCards(
  left: { title: string; rows: Array<{ label: string; value: string }> },
  right: { title: string; rows: Array<{ label: string; value: string }> }
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="48%" valign="top" style="padding-right:8px;">${renderKeyValueCard(left.title, left.rows)}</td>
      <td width="4%"></td>
      <td width="48%" valign="top" style="padding-left:8px;">${renderKeyValueCard(right.title, right.rows)}</td>
    </tr>
  </table>`;
}

export function renderDataTable(
  columns: string[],
  rows: string[][]
): string {
  const head = columns
    .map(
      (column) =>
        `<th align="left" style="padding:12px 10px;background-color:${COLORS.surface};border-bottom:1px solid ${COLORS.border};font-size:12px;font-weight:700;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(column)}</th>`
    )
    .join("");

  const body = rows
    .map(
      (row) => `<tr>${row
        .map(
          (cell, index) =>
            `<td style="padding:12px 10px;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.text};${index === row.length - 1 ? "font-weight:700;" : ""}">${cell}</td>`
        )
        .join("")}</tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function renderSummaryBox(
  rows: Array<{ label: string; value: string; emphasize?: boolean }>,
  totalLabel: string,
  totalValue: string
): string {
  const rowsHtml = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:${COLORS.muted};">${escapeHtml(row.label)}</td>
        <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.text};${row.emphasize ? "font-weight:700;" : ""}">${row.value}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid ${COLORS.greenBorder};border-radius:12px;overflow:hidden;background-color:${COLORS.greenLight};">
    <tr>
      <td style="padding:18px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;padding-top:12px;border-top:1px solid ${COLORS.greenBorder};">
          <tr>
            <td style="font-size:16px;font-weight:700;color:${COLORS.greenDark};">${escapeHtml(totalLabel)}</td>
            <td align="right" style="font-size:22px;font-weight:700;color:${COLORS.greenDark};">${totalValue}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function renderHighlightCard(
  title: string,
  content: string,
  variant: "green" | "amber" = "green"
): string {
  const styles = {
    green: { bg: COLORS.greenLight, border: COLORS.greenBorder, title: COLORS.greenDark },
    amber: { bg: COLORS.amberLight, border: COLORS.amberBorder, title: COLORS.amber },
  }[variant];

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;border:1px solid ${styles.border};border-radius:12px;overflow:hidden;background-color:${styles.bg};">
    <tr>
      <td style="padding:16px 18px;">
        <div style="font-size:14px;font-weight:700;color:${styles.title};margin-bottom:8px;">${escapeHtml(title)}</div>
        <div style="font-size:15px;line-height:1.6;color:${COLORS.text};">${content}</div>
      </td>
    </tr>
  </table>`;
}

export function renderPriceLine(listPrice: number, salePrice: number, suffix = ""): string {
  return `<span style="text-decoration:line-through;color:${COLORS.muted};font-size:14px;">${listPrice.toFixed(2)} TND${suffix}</span>
    <strong style="margin-left:8px;color:${COLORS.greenDark};font-size:18px;">${salePrice.toFixed(2)} TND${suffix}</strong>`;
}

export function renderSteps(steps: string[]): string {
  const items = steps
    .map(
      (step, index) => `
      <tr>
        <td valign="top" style="width:28px;padding:0 12px 14px 0;font-size:14px;font-weight:700;color:${COLORS.green};">${index + 1}.</td>
        <td style="padding:0 0 14px;font-size:14px;line-height:1.6;color:${COLORS.text};">${step}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${items}</table>`;
}

export function renderFeatureList(items: Array<{ icon: string; text: string }>): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td valign="top" style="width:34px;padding:0 10px 12px 0;font-size:18px;line-height:1;">${item.icon}</td>
        <td style="padding:0 0 12px;font-size:14px;line-height:1.6;color:${COLORS.text};">${escapeHtml(item.text)}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:16px 18px;background-color:${COLORS.surface};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td>
    </tr>
  </table>`;
}

export function renderAlertBanner(message: string, variant: "green" | "amber" | "blue" = "green"): string {
  const styles = {
    green: { bg: COLORS.greenLight, border: COLORS.greenBorder, color: COLORS.greenDark },
    amber: { bg: COLORS.amberLight, border: COLORS.amberBorder, color: COLORS.amber },
    blue: { bg: COLORS.blueLight, border: COLORS.blueBorder, color: COLORS.blue },
  }[variant];

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${styles.border};border-radius:12px;background-color:${styles.bg};">
    <tr>
      <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:${styles.color};font-weight:600;">${message}</td>
    </tr>
  </table>`;
}

export function renderStatGrid(stats: Array<{ label: string; value: string }>): string {
  const cells = stats
    .map(
      (stat) => `
      <td width="50%" valign="top" style="padding:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:12px;background-color:${COLORS.surface};">
          <tr>
            <td style="padding:16px;text-align:center;">
              <div style="font-size:12px;color:${COLORS.muted};margin-bottom:6px;">${escapeHtml(stat.label)}</div>
              <div style="font-size:20px;font-weight:700;color:${COLORS.text};">${stat.value}</div>
            </td>
          </tr>
        </table>
      </td>`
    )
    .join("");

  const rows: string[] = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(`<tr>${cells[index]}${cells[index + 1] || "<td width='50%'></td>"}</tr>`);
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${rows.join("")}</table>`;
}

export function renderPasswordResetEmail(resetUrl: string): string {
  const body = [
    renderParagraph("Bonjour,"),
    renderParagraph(
      "Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau."
    ),
    `<div style="text-align:center;">${renderPrimaryButton(resetUrl, "Réinitialiser mon mot de passe")}</div>`,
    renderHighlightCard(
      "Important",
      "Ce lien est valable pendant 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      "amber"
    ),
    renderParagraph("Cordialement,<br><strong>L'équipe Rideaux Bambou</strong>"),
  ].join("");

  return renderEmailLayout({
    preheader: "Réinitialisez votre mot de passe Rideaux Bambou",
    title: "Réinitialisation de mot de passe",
    subtitle: "Sécurisez l'accès à votre compte en quelques clics.",
    body,
  });
}
