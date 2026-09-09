export interface CardComSession {
  lowProfileId: string;
  paymentUrl: string;
}

export interface CardComLineItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPriceAgorot: number;
  totalPriceAgorot: number;
}

export interface LpResult {
  ResponseCode: number;
  Description?: string;
  ReturnValue?: string;
  LowProfileId?: string;
  TerminalNumber?: number;
  Operation?: string;
  TranzactionInfo?: {
    ResponseCode?: number;
    TranzactionId?: number | string;
    Amount?: number;
    ApprovalNumber?: string;
    CoinId?: number;
    IsRefund?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
  customerPhone,
  lineItems,
  deliveryFeeAgorot,
  successUrl: successUrlOverride,
  failureUrl: failureUrlOverride,
}: {
  orderId: string;
  orderNumber: string;
  totalAgorot: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  lineItems: CardComLineItem[];
  deliveryFeeAgorot: number;
  /**
   * Where CardCom returns the customer on success. Guest orders pass a URL that
   * carries the order access token, since there is no session to identify them.
   */
  successUrl?: string;
  /** Where CardCom returns the customer after a failed or cancelled payment. */
  failureUrl?: string;
}): Promise<CardComSession> {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER;
  const apiName = process.env.CARDCOM_API_NAME;
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

  const amountShekels = parseFloat((totalAgorot / 100).toFixed(2));

  const successUrl = successUrlOverride ?? `${baseUrl}/checkout/success?order=${orderNumber}`;
  const errorUrl   = failureUrlOverride ?? `${baseUrl}/checkout/payment-error?orderId=${orderId}`;
  const webhookUrl = `${baseUrl}/api/cardcom/callback`;

  // Belt-and-braces, checked in integer agorot (never floats) before anything is
  // sent: no separate discount line is ever built below, so a quantity-promotion
  // discount only reaches CardCom by already being baked into the affected
  // line's totalPriceAgorot (see pricing.lines[].chargedTotalAgorot in the
  // checkout Server Action). If a caller ever passes lines that don't add up
  // with the delivery fee to the order total, that is a pricing bug upstream —
  // fail loudly here rather than ask CardCom to charge the wrong amount.
  const lineItemsAgorot = lineItems.reduce((sum, item) => sum + item.totalPriceAgorot, 0);
  if (lineItemsAgorot + deliveryFeeAgorot !== totalAgorot) {
    throw new Error(
      `CardCom line items do not sum to the order total: lines=${lineItemsAgorot} + delivery=${deliveryFeeAgorot} !== total=${totalAgorot}`
    );
  }

  // Build Document.Products. No standalone "הנחת מבצעים" / discount row is ever
  // sent — a quantity promotion's saving is already folded into the discounted
  // line's TotalLineCost by the caller. UnitCost is derived FROM TotalLineCost
  // (not the undiscounted catalog price), so Quantity × UnitCost equals
  // TotalLineCost for every row, including one a promotion discounted. Two
  // numbers on the same line that describe its price differently is exactly
  // what CardCom rejects the whole document for.
  const products: Array<{
    ProductID?: string;
    Description: string;
    Quantity: number;
    UnitCost: number;
    TotalLineCost: number;
  }> = lineItems.map((item) => {
    const totalLineCost = parseFloat((item.totalPriceAgorot / 100).toFixed(2));
    const unitCost =
      item.quantity > 0
        ? parseFloat((item.totalPriceAgorot / item.quantity / 100).toFixed(2))
        : totalLineCost;
    return {
      ProductID:     item.productId,
      Description:   item.description,
      Quantity:      item.quantity,
      UnitCost:      unitCost,
      TotalLineCost: totalLineCost,
    };
  });

  if (deliveryFeeAgorot > 0) {
    const deliveryShekels = parseFloat((deliveryFeeAgorot / 100).toFixed(2));
    products.push({
      Description:   "דמי משלוח",
      Quantity:      1,
      UnitCost:      deliveryShekels,
      TotalLineCost: deliveryShekels,
    });
  }

  // Field names match the CardCom Low Profile v11 API exactly.
  const payload: Record<string, unknown> = {};
  payload["TerminalNumber"]     = parseInt(terminalNumber, 10);
  payload["ApiName"]            = apiName;
  payload["Operation"]          = "ChargeOnly";
  payload["ReturnValue"]        = orderId;
  payload["Amount"]             = amountShekels;
  payload["ISOCoinId"]          = 1;
  payload["Language"]           = "he";
  payload["MaxPayments"]        = 12;
  payload["ProductName"]        = `הזמנה מספר ${orderNumber}`;
  payload["SuccessRedirectUrl"] = successUrl;
  payload["FailedRedirectUrl"]  = errorUrl;
  payload["WebHookUrl"]         = webhookUrl;
  payload["Document"]           = {
    DocumentTypeToCreate: "Order",
    Name:     customerName,
    Email:    customerEmail,
    Phone:    customerPhone,
    Products: products,
  };

  const endpoint = "https://secure.cardcom.solutions/api/v11/LowProfile/Create";

  console.log("[cardcom] endpoint", endpoint);
  console.log("[cardcom] amount", amountShekels);
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

/**
 * Verifies a CardCom payment result server-side via LowProfile/GetLpResult.
 * Called from the webhook handler after receiving a notification.
 * This is the authoritative source of truth — never trust the success redirect URL alone.
 */
export async function getLpResult(lowProfileId: string): Promise<LpResult> {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER;
  const apiName = process.env.CARDCOM_API_NAME;

  if (!terminalNumber || !apiName) {
    throw new Error("CardCom credentials not configured");
  }

  const payload = {
    TerminalNumber: parseInt(terminalNumber, 10),
    ApiName:        apiName,
    LowProfileId:   lowProfileId,
  };

  const response = await fetch(
    "https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const rawText = await response.text();

  let data: LpResult;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `CardCom GetLpResult non-JSON (HTTP ${response.status}): ${rawText.slice(0, 300)}`
    );
  }

  console.log("[cardcom] getLpResult ResponseCode", data.ResponseCode);
  console.log("[cardcom] getLpResult Description", data.Description);
  console.log("[cardcom] getLpResult full", JSON.stringify(data));

  return data;
}
