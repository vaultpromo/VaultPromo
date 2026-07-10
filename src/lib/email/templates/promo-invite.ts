/**
 * Promo invite email template.
 *
 * Renders a personalized HTML + plaintext email for a single recipient.
 * The call-to-action links to the unique passwordless promo page.
 *
 * Design is intentionally distinct from the legacy platform:
 * - Dark background with violet accents
 * - Minimal, text-forward layout
 * - Semantic HTML for good email client compatibility
 */

export interface PromoInviteData {
  recipientName?: string | null;
  recipientEmail: string;
  senderName: string;     // Label name
  campaignTitle: string;
  artistName: string;
  catalogNumber?: string | null;
  description?: string | null;
  releaseDate?: Date | null;
  promoUrl: string;       // Unique token URL
  expiryDate?: Date | null;
}

function fmt(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function renderPromoInviteHtml(data: PromoInviteData): string {
  const greeting = data.recipientName ? `Hi ${data.recipientName},` : "Hi,";
  const expiry = data.expiryDate ? `This promo link expires on <strong>${fmt(data.expiryDate)}</strong>.` : "";
  const releaseInfo = data.releaseDate ? `Release date: ${fmt(data.releaseDate)}<br>` : "";
  const catalog = data.catalogNumber ? ` (${data.catalogNumber})` : "";
  const desc = data.description
    ? `<p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:16px 0;">${data.description.replace(/\n/g, "<br>")}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${data.campaignTitle} — Promo from ${data.senderName}</title>
</head>
<body style="background:#09090b;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" role="presentation">

          <!-- Header bar -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="color:#8b5cf6;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">
                PromoVault
              </span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;">

              <p style="color:#e4e4e7;font-size:15px;margin:0 0 20px;">${greeting}</p>

              <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px;">
                <strong style="color:#e4e4e7;">${data.senderName}</strong> has sent you a promo
                and would love to hear your thoughts before it's released.
              </p>

              <!-- Release info -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-left:3px solid #7c3aed;padding-left:16px;margin-bottom:24px;">
                <tr>
                  <td>
                    <p style="color:#e4e4e7;font-size:18px;font-weight:700;margin:0 0 4px;">
                      ${data.campaignTitle}${catalog}
                    </p>
                    <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px;">
                      ${data.artistName}
                    </p>
                    <p style="color:#71717a;font-size:12px;margin:0;">
                      ${releaseInfo}
                    </p>
                  </td>
                </tr>
              </table>

              ${desc}

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.promoUrl}"
                       style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
                      Listen &amp; Leave Feedback →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#52525b;font-size:12px;line-height:1.6;margin:20px 0 0;">
                ${expiry}
                Stream the preview freely. Download the full-quality files after leaving feedback.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="color:#3f3f46;font-size:11px;text-align:center;margin:0;">
                This email was sent to ${data.recipientEmail} by ${data.senderName} via PromoVault.<br>
                If you did not expect this, you can safely ignore it.
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

export function renderPromoInviteText(data: PromoInviteData): string {
  const greeting = data.recipientName ? `Hi ${data.recipientName},` : "Hi,";
  const expiry = data.expiryDate ? `\nThis promo link expires on ${fmt(data.expiryDate)}.` : "";
  const catalog = data.catalogNumber ? ` (${data.catalogNumber})` : "";

  return `${greeting}

${data.senderName} has sent you a promo and would love your feedback before release.

${data.campaignTitle}${catalog}
${data.artistName}
${data.releaseDate ? `Release date: ${fmt(data.releaseDate)}` : ""}

${data.description ?? ""}

Listen and leave feedback:
${data.promoUrl}

Stream the preview freely. Download high-quality files after submitting feedback.${expiry}

---
This email was sent to ${data.recipientEmail} by ${data.senderName} via PromoVault.
`;
}
