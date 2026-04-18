/**
 * Email service layer for Meshek 22.
 *
 * All sending logic runs server-side only (never import this from a Client Component).
 * Add new email flows by creating a new template in ./templates/ and exporting a new
 * send* function here.
 */

import { Resend } from "resend";
import type { OrderEmailData, EmailSendResult } from "./types";
import { buildCustomerOrderConfirmationHtml } from "./templates/customer-order-confirmation";
import { buildAdminNewOrderHtml } from "./templates/admin-new-order";

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * The verified sender domain/address configured in your Resend account.
 * Format: "משק 22 <noreply@yourdomain.com>"
 * Replace with your actual verified domain before going to production.
 */
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS ?? "noreply@meshek22.co.il";
const FROM_NAME = "משק 22";

/**
 * The business email address that receives new order notifications.
 * Replace with your actual admin/operations email address.
 */
const ADMIN_EMAIL = process.env.EMAIL_ADMIN_ADDRESS ?? "orders@meshek22.co.il";

/**
 * Base URL used for building the admin deep-link in admin notification emails.
 * Should be your production domain, e.g. "https://meshek22.co.il"
 */
const ADMIN_PANEL_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ── Client (lazy singleton) ───────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[email] RESEND_API_KEY is not set. Add it to your .env.local file."
      );
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send an order confirmation email to the customer.
 * Never throws — logs errors and returns a result object.
 */
export async function sendCustomerOrderConfirmation(
  order: OrderEmailData
): Promise<EmailSendResult> {
  try {
    const html = buildCustomerOrderConfirmationHtml(order);

    const { error } = await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: order.customerEmail,
      subject: `ההזמנה שלך ממשק 22 התקבלה! (#${order.orderNumber})`,
      html,
    });

    if (error) {
      console.error("[email] sendCustomerOrderConfirmation failed", {
        orderNumber: order.orderNumber,
        to: order.customerEmail,
        error,
      });
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendCustomerOrderConfirmation threw", {
      orderNumber: order.orderNumber,
      message,
    });
    return { ok: false, error: message };
  }
}

/**
 * Send a new-order notification email to the admin / operations team.
 * Never throws — logs errors and returns a result object.
 */
export async function sendAdminNewOrderNotification(
  order: OrderEmailData
): Promise<EmailSendResult> {
  try {
    const html = buildAdminNewOrderHtml(order, ADMIN_PANEL_BASE_URL);

    const { error } = await getResend().emails.send({
      from: `${FROM_NAME} System <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `[הזמנה חדשה] #${order.orderNumber} — ${order.customerName}`,
      html,
    });

    if (error) {
      console.error("[email] sendAdminNewOrderNotification failed", {
        orderNumber: order.orderNumber,
        error,
      });
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendAdminNewOrderNotification threw", {
      orderNumber: order.orderNumber,
      message,
    });
    return { ok: false, error: message };
  }
}
