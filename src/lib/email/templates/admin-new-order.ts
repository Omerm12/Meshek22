import type { OrderEmailData } from "../types";

// ── Formatting helpers ────────────────────────────────────────────────────────

function ils(agorot: number): string {
  const shekel = agorot / 100;
  return shekel % 1 === 0 ? `&#x20AA;${shekel.toFixed(0)}` : `&#x20AA;${shekel.toFixed(2)}`;
}

/** Wrap value in an LTR bidi-isolated inline span. */
function ltr(html: string): string {
  return `<span dir="ltr" style="unicode-bidi:embed;">${html}</span>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const PAYMENT_LABELS: Record<string, string> = {
  card_mock: "כרטיס אשראי",
  card: "כרטיס אשראי",
  payplus: "כרטיס אשראי (PayPlus)",
  cash: "מזומן",
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "ממתין לתשלום",
  confirmed: "אושר",
  preparing: "בהכנה",
  out_for_delivery: "בדרך",
  delivered: "סופק",
  cancelled: "בוטל",
};

function paymentLabel(method: string | null): string {
  if (!method) return "&#x2014;";
  return PAYMENT_LABELS[method] ?? esc(method);
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? esc(status);
}

// ── Layout helpers ────────────────────────────────────────────────────────────

/** Section heading with a strong green left-border accent. */
function sectionHeading(text: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
       style="margin:0 0 12px 0;">
  <tr>
    <td style="padding:0 0 0 10px; border-right:3px solid #1e4d2b;
               font-size:13px; font-weight:700; color:#374151; letter-spacing:0.5px;
               font-family:Arial,Helvetica,sans-serif; text-align:right; line-height:1.3;">
      ${text}
    </td>
  </tr>
</table>`;
}

/**
 * Two-column label-value metadata row.
 *
 * IMPORTANT — no module-level state. Caller supplies the row index so that
 * alternating backgrounds are correct even when rows are conditionally included
 * and across multiple email sends within the same Node.js process.
 */
function metaRow(label: string, value: string, index: number): string {
  const bg = index % 2 === 0 ? "#ffffff" : "#f9fafb";
  return `
<tr style="background-color:${bg};">
  <td dir="rtl" style="padding:11px 14px; font-size:13px; color:#6b7280;
              text-align:right; font-family:Arial,Helvetica,sans-serif;
              border-bottom:1px solid #f0f0f0; width:38%; vertical-align:middle;">
    ${label}
  </td>
  <td dir="rtl" style="padding:11px 14px; font-size:14px; color:#111827; font-weight:600;
              text-align:right; font-family:Arial,Helvetica,sans-serif;
              border-bottom:1px solid #f0f0f0; vertical-align:middle;">
    ${value}
  </td>
</tr>`;
}

// ── Main template ─────────────────────────────────────────────────────────────

export function buildAdminNewOrderHtml(order: OrderEmailData, adminBaseUrl: string): string {
  const adminOrderUrl = `${adminBaseUrl}/admin/orders/${order.orderId}`;

  // Build item rows — index used for alternating background (no mutable state)
  const itemRows = order.items
    .map((item, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
      return `
<tr style="background-color:${bg};">
  <td dir="rtl" style="padding:11px 14px; border-bottom:1px solid #f0f0f0;
              font-family:Arial,Helvetica,sans-serif; text-align:right; vertical-align:middle;">
    <span style="font-size:14px; font-weight:600; color:#111827; line-height:1.4;">${esc(item.productName)}</span>
    ${item.variantLabel
      ? `<br><span style="font-size:12px; color:#9ca3af; line-height:1.5;">${esc(item.variantLabel)}</span>`
      : ""}
  </td>
  <td dir="rtl" style="padding:11px 14px; border-bottom:1px solid #f0f0f0;
              font-size:14px; color:#374151; text-align:center;
              font-family:Arial,Helvetica,sans-serif; vertical-align:middle;
              width:52px; white-space:nowrap;">
    ${item.quantity}
  </td>
  <td dir="rtl" style="padding:11px 14px; border-bottom:1px solid #f0f0f0;
              font-size:13px; color:#6b7280; text-align:right;
              font-family:Arial,Helvetica,sans-serif; vertical-align:middle;
              width:90px; white-space:nowrap;">
    ${ltr(`${ils(item.unitPriceAgorot)} &#x2F; &#x05D9;&#x05D7;`)}
  </td>
  <td dir="rtl" style="padding:11px 14px; border-bottom:1px solid #f0f0f0;
              font-size:14px; font-weight:700; color:#111827; text-align:right;
              font-family:Arial,Helvetica,sans-serif; vertical-align:middle;
              width:80px; white-space:nowrap;">
    ${ltr(ils(item.totalPriceAgorot))}
  </td>
</tr>`;
    })
    .join("");

  // Build conditional address rows — row index tracked manually to keep alternating bg correct
  const addressRows: string[] = [];
  let addrIdx = 0;
  addressRows.push(metaRow("יישוב / עיר", esc(order.addressCity), addrIdx++));
  addressRows.push(metaRow("רחוב ומספר", esc(`${order.addressStreet} ${order.addressHouseNumber}`), addrIdx++));
  if (order.addressApartment) {
    addressRows.push(metaRow("דירה / קומה", esc(order.addressApartment), addrIdx++));
  }
  if (order.deliveryNotes) {
    addressRows.push(metaRow("הערות משלוח", `<em style="color:#4b5563;">${esc(order.deliveryNotes)}</em>`, addrIdx++));
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="he" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>&#x05D4;&#x05D6;&#x05DE;&#x05E0;&#x05D4; &#x05D7;&#x05D3;&#x05E9;&#x05D4; #${esc(order.orderNumber)}</title>
  <!--[if mso]>
  <noscript><xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family:Arial,Helvetica,sans-serif;
             -webkit-text-size-adjust:100%; mso-line-height-rule:exactly;">

<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" style="width:620px;" width="620"><tr><td><![endif]-->

<table align="center" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
       style="background-color:#f0f2f5; min-width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- ═══════════════════════════════════════════════════════════════════
           OUTER CARD
           ═══════════════════════════════════════════════════════════════════ -->
      <table align="center" width="620" cellpadding="0" cellspacing="0" border="0" role="presentation"
             style="max-width:620px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden;">

        <!-- ── HEADER ────────────────────────────────────────────────────── -->
        <tr>
          <td style="background-color:#1e4d2b; padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
              <tr>
                <td dir="rtl" style="text-align:right; font-size:15px; font-weight:700;
                            color:#ffffff; font-family:Arial,Helvetica,sans-serif;">
                  משק 22 &mdash; מערכת ניהול
                </td>
                <td dir="ltr" style="text-align:left; font-size:13px; color:#86efac;
                            font-family:Arial,Helvetica,sans-serif; white-space:nowrap;">
                  ${ltr(formatDateTime(order.createdAt))}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── ALERT BANNER ───────────────────────────────────────────────── -->
        <tr>
          <td dir="rtl" style="background-color:#fffbeb; padding:18px 24px;
              border-top:3px solid #f59e0b; border-bottom:1px solid #fde68a;">
            <p style="margin:0; font-size:19px; font-weight:700; color:#92400e;
                       font-family:Arial,Helvetica,sans-serif; line-height:1.3; text-align:right;">
              &#128722;&nbsp;&nbsp;הזמנה חדשה התקבלה:
              &nbsp;<span style="color:#1e4d2b;">${ltr(`#${esc(order.orderNumber)}`)}</span>
            </p>
          </td>
        </tr>

        <!-- ── BODY ──────────────────────────────────────────────────────── -->
        <tr>
          <td dir="rtl" style="padding:28px 24px;">

            <!-- ── Primary CTA ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                    <tr>
                      <td align="center" style="border-radius:6px; background-color:#1e4d2b;
                                  mso-padding-alt:14px 32px;">
                        <a href="${adminOrderUrl}" target="_blank"
                           style="display:inline-block; padding:14px 32px; font-size:16px;
                                  font-weight:700; color:#ffffff; text-decoration:none;
                                  font-family:Arial,Helvetica,sans-serif; border-radius:6px;
                                  mso-hide:all;">
                          פתח הזמנה בפאנל הניהול &#x2190;
                        </a>
                        <!--[if mso]>
                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                          xmlns:w="urn:schemas-microsoft-com:office:word"
                          href="${adminOrderUrl}" style="height:48px;v-text-anchor:middle;width:280px;"
                          arcsize="10%" strokecolor="#1e4d2b" fillcolor="#1e4d2b">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;">
                            פתח הזמנה בפאנל הניהול
                          </center>
                        </v:roundrect>
                        <![endif]-->
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ─────────────────────────────────────────────────────────── -->
            <!-- SECTION: Order info                                         -->
            <!-- ─────────────────────────────────────────────────────────── -->
            ${sectionHeading("פרטי הזמנה")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:24px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              ${metaRow("מספר הזמנה", ltr(esc(order.orderNumber)), 0)}
              ${metaRow("סטטוס",       statusLabel(order.orderStatus),       1)}
              ${metaRow("אמצעי תשלום", paymentLabel(order.paymentMethod),    2)}
              ${metaRow("תאריך",       ltr(formatDateTime(order.createdAt)), 3)}
            </table>

            <!-- ─────────────────────────────────────────────────────────── -->
            <!-- SECTION: Customer info                                      -->
            <!-- ─────────────────────────────────────────────────────────── -->
            ${sectionHeading("פרטי לקוח")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:24px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              ${metaRow("שם מלא", esc(order.customerName), 0)}
              ${metaRow("טלפון",
                ltr(`<a href="tel:${esc(order.customerPhone)}" style="color:#1e4d2b; text-decoration:none; font-weight:600;">${esc(order.customerPhone)}</a>`),
                1)}
              ${metaRow("אימייל",
                ltr(`<a href="mailto:${esc(order.customerEmail)}" style="color:#1e4d2b; text-decoration:none; font-weight:600;">${esc(order.customerEmail)}</a>`),
                2)}
            </table>

            <!-- ─────────────────────────────────────────────────────────── -->
            <!-- SECTION: Delivery address                                   -->
            <!-- ─────────────────────────────────────────────────────────── -->
            ${sectionHeading("כתובת למשלוח")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:24px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              ${addressRows.join("")}
            </table>

            <!-- ─────────────────────────────────────────────────────────── -->
            <!-- SECTION: Items                                              -->
            <!-- ─────────────────────────────────────────────────────────── -->
            ${sectionHeading("פריטים שהוזמנו")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:8px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
              <tr style="background-color:#f9fafb;">
                <th dir="rtl" style="padding:10px 14px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; letter-spacing:0.3px;">
                  מוצר
                </th>
                <th dir="rtl" style="padding:10px 14px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:center; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; width:52px; letter-spacing:0.3px;">
                  כמות
                </th>
                <th dir="rtl" style="padding:10px 14px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; width:90px; letter-spacing:0.3px;">
                  מחיר יח'
                </th>
                <th dir="rtl" style="padding:10px 14px; font-size:12px; font-weight:700; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; width:80px; letter-spacing:0.3px;">
                  סה&quot;כ
                </th>
              </tr>
              ${itemRows}
            </table>

            <!-- ── Totals ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="margin-bottom:28px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden; background-color:#fafafa;">
              <tr>
                <td dir="rtl" style="padding:11px 14px; font-size:14px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0;">
                  סכום ביניים
                </td>
                <td dir="rtl" style="padding:11px 14px; font-size:14px; color:#374151;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:1px solid #f0f0f0; width:100px; white-space:nowrap;">
                  ${ltr(ils(order.subtotalAgorot))}
                </td>
              </tr>
              <tr>
                <td dir="rtl" style="padding:11px 14px; font-size:14px; color:#6b7280;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb;">
                  דמי משלוח
                </td>
                <td dir="rtl" style="padding:11px 14px; font-size:14px; color:#374151;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;
                            border-bottom:2px solid #e5e7eb; white-space:nowrap;">
                  ${order.deliveryFeeAgorot === 0
                    ? `<span style="color:#15803d; font-weight:600;">חינם</span>`
                    : ltr(ils(order.deliveryFeeAgorot))}
                </td>
              </tr>
              <tr style="background-color:#1e4d2b;">
                <td dir="rtl" style="padding:14px; font-size:16px; font-weight:700; color:#ffffff;
                            text-align:right; font-family:Arial,Helvetica,sans-serif;">
                  סה&quot;כ
                </td>
                <td dir="rtl" style="padding:14px; font-size:18px; font-weight:700; color:#ffffff;
                            text-align:right; font-family:Arial,Helvetica,sans-serif; white-space:nowrap;">
                  ${ltr(ils(order.totalAgorot))}
                </td>
              </tr>
            </table>

            <!-- ── Secondary CTA (bottom fallback) ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                    <tr>
                      <td align="center" style="border-radius:6px; border:2px solid #1e4d2b;
                                  mso-padding-alt:10px 24px;">
                        <a href="${adminOrderUrl}" target="_blank"
                           style="display:inline-block; padding:10px 24px; font-size:14px;
                                  font-weight:700; color:#1e4d2b; text-decoration:none;
                                  font-family:Arial,Helvetica,sans-serif; border-radius:4px;">
                          צפה בהזמנה בפאנל הניהול &#x2190;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ─────────────────────────────────────────────────────── -->
        <tr>
          <td align="center" dir="rtl"
              style="background-color:#f9fafb; padding:16px 24px;
                     border-top:1px solid #e5e7eb;">
            <p style="margin:0; font-size:12px; color:#9ca3af;
                       font-family:Arial,Helvetica,sans-serif; line-height:1.6; text-align:center;">
              הודעה אוטומטית ממערכת משק 22 &mdash; אין להשיב לאימייל זה
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
