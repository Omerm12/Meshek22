export interface CardComSession {
  lowProfileId: string;
  paymentUrl: string;
}

/**
 * Creates a CardCom Low Profile payment session server-side.
 * Returns the hosted payment URL to redirect the user to.
 * Reads credentials exclusively from environment variables — never from client input.
 */
export async function createCardComSession({
  orderId,
  orderNumber,
  totalAgorot,
  customerName,
  customerEmail,
}: {
  orderId: string;
  orderNumber: string;
  totalAgorot: number;
  customerName: string;
  customerEmail: string;
}): Promise<CardComSession> {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER;
  const apiName = process.env.CARDCOM_API_NAME;
  const apiPassword = process.env.CARDCOM_API_PASSWORD;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  if (!terminalNumber || !apiName) {
    throw new Error(
      "CardCom credentials not configured. Add CARDCOM_TERMINAL_NUMBER, CARDCOM_API_NAME to .env.local"
    );
  }

  if (!baseUrl || /^https?:\/\/localhost/i.test(baseUrl)) {
    throw new Error(
      "CardCom requires a public HTTPS URL for redirect/callback URLs. " +
        "Set NEXT_PUBLIC_SITE_URL to your ngrok tunnel or production domain. " +
        "Example: NEXT_PUBLIC_SITE_URL=https://your-id.ngrok-free.app"
    );
  }

  const amountShekels = totalAgorot / 100;

  // Success URL uses orderNumber (?order=) because the success page reads that param.
  // Error/cancel URLs use orderId (UUID) for the payment-error page.
  const successUrl = `${baseUrl}/checkout/success?order=${orderNumber}`;
  const errorUrl   = `${baseUrl}/checkout/payment-error?orderId=${orderId}`;
  const webhookUrl = `${baseUrl}/api/cardcom/callback`;

  // ApiPassword is NOT included — LowProfile/Create does not require it per v11 docs.
  // Field names match the CardCom Low Profile v11 API exactly.
  const payload: Record<string, unknown> = {};
  payload["TerminalNumber"]     = parseInt(terminalNumber, 10);
  payload["ApiName"]            = apiName;
  payload["Operation"]          = "ChargeOnly";
  payload["ReturnValue"]        = orderId;
  payload["SuccessRedirectUrl"] = successUrl;
  payload["FailedRedirectUrl"]  = errorUrl;
  payload["WebHookUrl"]         = webhookUrl;
  payload["Amount"]             = amountShekels;
  payload["CoinID"]             = 1;
  payload["MaxPayments"]        = 12;
  payload["InvoiceHead"]        = {
    CustName:    customerName,
    CustEmail:   customerEmail,
    Language:    "he",
    SendByEmail: false,
  };
  payload["InvoiceLines"] = [
    {
      Description: `הזמנה ${orderNumber} — משק 22`,
      Price:       amountShekels,
      Quantity:    1,
    },
  ];

  const endpoint = "https://secure.cardcom.solutions/api/v11/LowProfile/Create";

  console.log("[cardcom] endpoint", endpoint);
  console.log("[cardcom] payload keys", Object.keys(payload));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const rawText = await response.text();

  let data: { ResponseCode: number; Description?: string; LowProfileId?: string; Url?: string };
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`CardCom returned non-JSON (HTTP ${response.status}): ${rawText.slice(0, 300)}`);
  }

  console.log("[cardcom] ResponseCode", data.ResponseCode);
  console.log("[cardcom] Description", data.Description);
  console.log("[cardcom] full response", JSON.stringify(data));

  if (!response.ok) {
    throw new Error(`CardCom API HTTP ${response.status}: ${rawText.slice(0, 300)}`);
  }

  if (data.ResponseCode !== 0) {
    throw new Error(
      `CardCom rejected session (code ${data.ResponseCode}): ${data.Description ?? "unknown error"}`
    );
  }

  if (!data.LowProfileId || !data.Url) {
    throw new Error("CardCom response missing LowProfileId or Url");
  }

  return {
    lowProfileId: data.LowProfileId,
    paymentUrl:   data.Url,
  };
}
