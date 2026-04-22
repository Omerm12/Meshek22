/**
 * PayPlus payment provider integration.
 *
 * REQUIRED environment variables — configure manually in .env.local:
 *   PAYPLUS_API_KEY        Your PayPlus API key (from PayPlus merchant dashboard)
 *   PAYPLUS_SECRET_KEY     Your PayPlus secret key (from PayPlus merchant dashboard)
 *   PAYPLUS_TERMINAL_UID   Your terminal UID (from PayPlus merchant dashboard)
 *   PAYPLUS_SANDBOX        Set to "true" for sandbox/testing, omit or "false" for production
 *
 * PayPlus dashboard: https://payplus.co.il
 * API docs: https://developers.payplus.co.il
 */

import crypto from "crypto";

const BASE_URL =
  process.env.PAYPLUS_SANDBOX === "true"
    ? "https://sandbox.payplus.co.il/api/v1.0"
    : "https://restapi.payplus.co.il/api/v1.0";

export interface PayPlusLineItem {
  name: string;
  quantity: number;
  price: number; // NIS (shekels), e.g. 19.9
  vat_type?: 0 | 1; // 0 = VAT exempt, 1 = VAT inclusive (default)
}

export interface CreatePaymentPageInput {
  orderId: string;
  orderNumber: string;
  amountNIS: number; // total in shekels, e.g. 125.50
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  items: PayPlusLineItem[];
  successUrl: string; // redirect after successful payment
  failureUrl: string; // redirect after failed payment
  cancelUrl: string; // redirect if customer cancels
  webhookUrl: string; // server-to-server notification URL
}

export interface CreatePaymentPageResult {
  paymentPageLink: string;
  paypageUid: string;
}

/**
 * Create a PayPlus hosted payment page and return its URL.
 * Throws if PayPlus credentials are not configured or API returns an error.
 */
export async function createPaymentPage(
  input: CreatePaymentPageInput
): Promise<CreatePaymentPageResult> {
  const apiKey = process.env.PAYPLUS_API_KEY;
  const secretKey = process.env.PAYPLUS_SECRET_KEY;
  const terminalUid = process.env.PAYPLUS_TERMINAL_UID;

  if (!apiKey || !secretKey || !terminalUid) {
    throw new Error(
      "PayPlus credentials not configured. " +
        "Set PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY, PAYPLUS_TERMINAL_UID in .env.local"
    );
  }

  const payload = {
    terminal_uid: terminalUid,
    charge_method: 1, // 1 = credit card
    currency_code: "ILS",
    amount: Number(input.amountNIS.toFixed(2)),
    refUID: input.orderId,
    sendEmailApproval: true,
    sendEmailFailure: false,
    create_token: false,
    language_code: "HE",
    customer: {
      customer_name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone ?? "",
    },
    items: input.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price.toFixed(2)),
      vat_type: item.vat_type ?? 1,
    })),
    redirect_url: input.successUrl,
    payment_failure_redirect_url: input.failureUrl,
    cancel_redirect_url: input.cancelUrl,
    webhook_url: input.webhookUrl,
    more_info: input.orderNumber,
  };

  const res = await fetch(`${BASE_URL}/PaymentPages/generateLink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // PayPlus Authorization header format: "apiKey:secretKey"
      Authorization: `${apiKey}:${secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPlus API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // PayPlus response shape: { results: { status: 0|1 }, data: { payment_page_link, payment_page_uid } }
  if (data.results?.status !== 0 || !data.data?.payment_page_link) {
    throw new Error(
      `PayPlus response error: ${JSON.stringify(data.results ?? data)}`
    );
  }

  return {
    paymentPageLink: data.data.payment_page_link as string,
    paypageUid: (data.data.payment_page_uid as string) ?? "",
  };
}

/**
 * Verify a PayPlus webhook signature.
 *
 * PayPlus signs webhook payloads with HMAC-SHA256 using the secret key.
 * The signature is sent in the "x-payplus-signature" header.
 *
 * NOTE: Verify exact header name and HMAC format in PayPlus webhook docs.
 * This implementation follows the common PayPlus v1 pattern.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secretKey = process.env.PAYPLUS_SECRET_KEY;
  if (!secretKey) return false;
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
