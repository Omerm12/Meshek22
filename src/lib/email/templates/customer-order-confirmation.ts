import type { OrderEmailData } from "../types";

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Agorot → ₪ string, always safe to embed in HTML (no HTML entities needed) */
function ils(agorot: number): string {
  const shekel = agorot / 100;
  return shekel % 1 === 0 ? `&#x20AA;${shekel.toFixed(0)}` : `&#x20AA;${shekel.toFixed(2)}`;
}

/** Wrap a value in an LTR bidi-isolated span.
 *  Use for: phone numbers, email addresses, order numbers, dates, currency amounts.
 *  This prevents the Unicode bidi algorithm from reordering characters inside RTL context.
 */
function ltr(html: string): string {
  return `<span dir="ltr" style="unicode-bidi:embed;">${html}</span>`;
}

/** Escape HTML special characters */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const PAYMENT_LABELS: Record<string, string> = {
  card_mock: "כרטיס אשראי",
  card: "כרטיס אשראי",
  payplus: "כרטיס אשראי",
  cash: "מזומן",
};

function paymentLabel(method: string | null): string {
  if (!method) return "לא ידוע";
  return PAYMENT_LABELS[method] ?? esc(method);
}

// ── Layout helpers ────────────────────────────────────────────────────────────

/**
 * Horizontal rule — rendered as a table row because <hr> is unreliable in Outlook.
 */
const HR = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr><td style="font-size:0; line-height:0; border-bottom:1px solid #e5e7eb;">&nbsp;</td></tr>
</table>`;

/**
 * Section heading — used to introduce each content block.
 * A colored left-border (visually right-border in RTL) gives hierarchy without being heavy.
 */
function sectionHeading(text: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 14px 0;">
  <tr>
    <td style="padding:0 0 0 12px; border-right:3px solid #1e4d2b; font-size:16px; font-weight:700; color:#1a1a1a; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">
      ${text}
    </td>
  </tr>
</table>`;
}

/**
 * Two-column metadata row for key-value pairs.
 *
 * RTL layout strategy:
 * Both columns use text-align:right. The label is narrower (40%) and dimmer.
 * RTL-aware clients (Gmail, Apple Mail) flip column order so label appears on the right. ✓
 * Outlook (LTR column order) shows label on the left but still right-aligned within its cell —
 * readable and acceptable. No module-level state; caller passes the row index.
 */
function metaRow(label: string, value: string, index: number): string {
  const bg = index % 2 === 0 ? "#ffffff" : "#f9fafb";
  return `
<tr style="background-color:${bg};">
  <td dir="rtl" style="padding:11px 16px; font-size:13px; color:#6b7280; text-align:right; font-family:Arial,Helvetica,sans-serif; border-bottom:1px solid #f0f0f0; width:40%; vertical-align:middle;">
    ${label}
  </td>
  <td dir="rtl" style="padding:11px 16px; font-size:14px; color:#111827; font-weight:600; text-align:right; font-family:Arial,Helvetica,sans-serif; border-bottom:1px solid #f0f0f0; vertical-align:middle;">
    ${value}
  </td>
</tr>`;
}

// ── Main template ─────────────────────────────────────────────────────────────

export function buildCustomerOrderConfirmationHtml(order: OrderEmailData): string {
  // Build item rows for the order summary table
  const itemRows = order.items
    .map(
      (item, i) => {
        const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
        return `
<tr style="background-color:${bg};">
  <td dir="rtl" style="padding:13px 16px; border-bottom:1px solid #f0f0f0; text-align:right; font-family:Arial,Helvetica,sans-serif; vertical-align:middle;">
    <span style="font-size:14px; font-weight:600; color:#111827; line-height:1.4;">${esc(item.productName)}</span>
    ${item.variantLabel ? `<br><span style="font-size:12px; color:#9ca3af; line-height:1.5;">${esc(item.variantLabel)}</span>` : ""}
  </td>
  <td dir="rtl" style="padding:13px 16px; border-bottom:1px solid #f0f0f0; text-align:center; font-size:14px; color:#374151; font-family:Arial,Helvetica,sans-serif; vertical-align:middle; width:56px; white-space:nowrap;">
    ${item.quantity}
  </td>
  <td dir="rtl" style="padding:13px 16px; border-bottom:1px solid #f0f0f0; text-align:right; font-size:14px; font-weight:700; color:#111827; font-family:Arial,Helvetica,sans-serif; vertical-align:middle; width:90px; white-space:nowrap;">
    ${ltr(ils(item.totalPriceAgorot))}
  </td>
</tr>`;
      }
    )
    .join("");

  // Build delivery address lines
  const addrLine1 = `${esc(order.addressStreet)} ${esc(order.addressHouseNumber)}`;
  const addrLine2 = order.addressApartment ? `דירה ${esc(order.addressApartment)}` : null;
  const addrLine3 = esc(order.addressCity);
  const addressHtml = [addrLine1, addrLine2, addrLine3].filter(Boolean).join("<br>");

  return `<!DOCTYPE html>
<html dir="rtl" lang="he" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>אישור הזמנה &#x2014; משק 22</title>
  <!--[if mso]>
  <noscript><xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family:Arial,Helvetica,sans-serif; -webkit-text-size-adjust:100%; mso-line-height-rule:exactly;">

<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"><tr><td><![endif]-->

<table align="center" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
       style="background-color:#f0f2f5; min-width:100%;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <!-- ═══════════════════════════════════════════════════════════════════
           OUTER CARD — 600px max-width, white background
           ═══════════════════════════════════════════════════════════════════ -->
      <table align="center" width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"
             style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden;">

        <!-- ── HEADER ────────────────────────────────────────────────────── -->
        <tr>
          <td align="center" style="background-color:#1e4d2b; padding:40px 32px 32px 32px;">
            <h1 style="margin:0 0 6px 0; font-size:34px; font-weight:700; color:#ffffff; letter-spacing:2px;
                        font-family:Arial,Helvetica,sans-serif; line-height:1.2;">
              &#x05DE;&#x05E9;&#x05E7; 22
            </h1>
            <p style="margin:0; font-size:14px; color:#86efac; font-family:Arial,Helvetica,sans-serif; line-height:1.4;">
              פירות וירקות טריים מהמשק
            </p>
          </td>
        </tr>

        <!-- ── CONFIRMATION BANNER ────────────────────────────────────────── -->
        <tr>
          <td align="center" dir="rtl" style="background-color:#f0fdf4; padding:18px 32px;
              border-top:3px solid #16a34a; border-bottom:1px solid #bbf7d0;">
            <p style="margin:0; font-size:18px; font-weight:700; color:#15803d;
                       font-family:Arial,Helvetica,sans-serif; line-height:1.3;">
              &#10003;&nbsp;&nbsp;ההזמנה שלך התקבלה בהצלחה!
            </p>
          </td>
        </tr>

        <!-- ── BODY ──────────────────────────────────────────────────────── -->
        <tr>
          <td dir="rtl" style="padding:36px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 6px 0; font-size:20px; font-weight:700; color:#111827;
                       font-family:Arial,Helvetica,sans-serif; line-height:1.3;">
              שלום ${esc(order.customerName)},
            </p>
            <p style="margin:0 0 32px 0; font-size:15px; color:#4b5563; line-height:1.7;
                       font-family:Arial,Helvetica,sans-serif;">
              קיבלנו את הזמנתך ואנחנו כבר מתחילים להכין אותה.
              פרטי ההזמנה מופיעים להלן לנוחיותך.
            </p>

            <!-- ── Order meta ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:32px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              ${metaRow("מספר הזמנה", ltr(esc(order.orderNumber)), 0)}
              ${metaRow("תאריך הזמנה", ltr(formatDate(order.createdAt)), 1)}
            </table>

            <!-- ── Items section ── -->
            ${sectionHeading("פרטי ההזמנה")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:8px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              <!-- Table header -->
              <tr style="background-color:#f9fafb;">
                <th dir="rtl" style="padding:11px 16px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; letter-spacing:0.3px;">
                  מוצר
                </th>
                <th dir="rtl" style="padding:11px 16px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:center; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; width:56px; letter-spacing:0.3px;">
                  כמות
                </th>
                <th dir="rtl" style="padding:11px 16px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; width:90px; letter-spacing:0.3px;">
                  סה&quot;כ
                </th>
              </tr>
              <!-- Item rows -->
              ${itemRows}
            </table>

            <!-- ── Totals ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:32px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden; background-color:#fafafa;">
              <!-- Subtotal -->
              <tr>
                <td dir="rtl" style="padding:12px 16px; font-size:14px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0;">
                  סכום ביניים
                </td>
                <td dir="rtl" style="padding:12px 16px; font-size:14px; color:#374151;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0; width:100px; white-space:nowrap;">
                  ${ltr(ils(order.subtotalAgorot))}
                </td>
              </tr>
              <!-- Delivery fee -->
              <tr>
                <td dir="rtl" style="padding:12px 16px; font-size:14px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0;">
                  דמי משלוח
                </td>
                <td dir="rtl" style="padding:12px 16px; font-size:14px; color:#374151;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0; white-space:nowrap;">
                  ${order.deliveryFeeAgorot === 0
                    ? `<span style="color:#15803d; font-weight:600;">חינם</span>`
                    : ltr(ils(order.deliveryFeeAgorot))}
                </td>
              </tr>
              <!-- Payment method -->
              <tr>
                <td dir="rtl" style="padding:12px 16px; font-size:14px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb;">
                  אמצעי תשלום
                </td>
                <td dir="rtl" style="padding:12px 16px; font-size:14px; color:#374151;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb;">
                  ${paymentLabel(order.paymentMethod)}
                </td>
              </tr>
              <!-- Grand total -->
              <tr style="background-color:#1e4d2b;">
                <td dir="rtl" style="padding:14px 16px; font-size:16px; font-weight:700; color:#ffffff;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;">
                  סה&quot;כ לתשלום
                </td>
                <td dir="rtl" style="padding:14px 16px; font-size:18px; font-weight:700; color:#ffffff;
                            text-align:right; font-family:Arial,Helvetica,sans-serif; white-space:nowrap;">
                  ${ltr(ils(order.totalAgorot))}
                </td>
              </tr>
            </table>

            <!-- ── Delivery address ── -->
            ${sectionHeading("כתובת למשלוח")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:32px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              <tr>
                <td dir="rtl" style="padding:16px; font-size:14px; color:#374151; line-height:1.8;
                            font-family:Arial,Helvetica,sans-serif; text-align:right;">
                  ${addressHtml}
                  ${order.deliveryNotes
                    ? `<br><span style="font-size:13px; color:#6b7280;">הערות: ${esc(order.deliveryNotes)}</span>`
                    : ""}
                </td>
              </tr>
            </table>

            <!-- ── Business contact ── -->
            ${sectionHeading("יצירת קשר עם משק 22")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:8px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              <tr>
                <td dir="rtl" style="padding:13px 16px; font-size:13px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0; width:40%;">
                  טלפון
                </td>
                <td dir="rtl" style="padding:13px 16px; font-size:14px; color:#111827; font-weight:600;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0;">
                  ${ltr("050-8863030")}
                </td>
              </tr>
              <tr>
                <td dir="rtl" style="padding:13px 16px; font-size:13px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;">
                  אימייל
                </td>
                <td dir="rtl" style="padding:13px 16px; font-size:14px; color:#111827; font-weight:600;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;">
                  ${ltr(`<a href="mailto:ysmeshek22@gmail.com" style="color:#1e4d2b; text-decoration:none;">ysmeshek22@gmail.com</a>`)}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ─────────────────────────────────────────────────────── -->
        <tr>
          <td align="center" dir="rtl"
              style="background-color:#f9fafb; padding:24px 32px;
                     border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 6px 0; font-size:14px; color:#374151;
                       font-family:Arial,Helvetica,sans-serif; line-height:1.6;">
              תודה שבחרת במשק 22!
            </p>
            <p style="margin:0; font-size:12px; color:#9ca3af;
                       font-family:Arial,Helvetica,sans-serif; line-height:1.6;">
              &copy; משק 22 &mdash; פירות וירקות טריים
            </p>
          </td>
        </tr>

      </table>
      <!-- /OUTER CARD -->

    </td>
  </tr>
</table>

<!--[if mso | IE]></td></tr></table><![endif]-->

</body>
</html>`;
}
