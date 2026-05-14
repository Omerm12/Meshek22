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

  if (!terminalNumber || !apiName || !apiPassword) {
    throw new Error(
      "CardCom credentials not configured. Add CARDCOM_TERMINAL_NUMBER, CARDCOM_API_NAME, CARDCOM_API_PASSWORD to .env.local"
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

  // Build payload with every field explicit — do not inline to avoid typos.
  // Field names match the CardCom Low Profile v11 API exactly.
  const payload: Record<string, unknown> = {};
  payload["TerminalNumber"]     = parseInt(terminalNumber, 10);
  payload["ApiName"]            = apiName;
  payload["ApiPassword"]        = apiPassword;
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

  // Log outgoing payload keys (never log ApiPassword value).
  console.log("[cardcom] payload keys", Object.keys(payload));

  const response = await fetch(
    "https://secure.cardcom.solutions/api/v11/LowProfile/Create",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`CardCom API HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    ResponseCode: number;
    Description?: string;
    LowProfileId?: string;
    url?: string;
  };

  if (data.ResponseCode !== 0) {
    throw new Error(
      `CardCom rejected session (code ${data.ResponseCode}): ${data.Description ?? "unknown error"}`
    );
  }

  if (!data.LowProfileId || !data.url) {
    throw new Error("CardCom response missing LowProfileId or url");
  }

  return {
    lowProfileId: data.LowProfileId,
    paymentUrl: data.url,
  };
}
