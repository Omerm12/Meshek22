# CardCom documents and Resend emails — who is responsible for what

Status: **the accounting-document question is UNRESOLVED.** Nothing about the
document configuration was changed, and nothing should be until the checklist at
the bottom is answered by the merchant, CardCom, or the merchant's accountant.

## The three separate responsibilities

| # | Message | Sent by | When | What it is |
|---|---|---|---|---|
| 1 | Customer order confirmation | Resend (`sendCustomerOrderConfirmation`) | Cash + phone-credit: at order creation. Online card: after the webhook verifies payment. | An **order confirmation**. Not a receipt, not an invoice. |
| 2 | Admin new-order notification | Resend (`sendAdminNewOrderNotification`) | Same moments as #1 | Operational "start packing" alert to the shop. |
| 3 | Legal accounting document | **CardCom**, if configured | Unknown — see checklist | Receipt / tax invoice. The site never generates one. |

Both Resend emails are claimed independently through atomic database flags
(`customer_email_sent_at`, `admin_email_sent_at`), so a webhook retry or a
crash-recovery replay cannot send either message twice, and a failure in one
never suppresses the other.

## What the code does today

`src/lib/cardcom.ts` sends:

```ts
DocumentTypeToCreate: "Order"
```

That is an **order document**, which is not automatically a legal receipt. Whether
CardCom actually produces and emails an accounting document depends on the
merchant's documents module, business type, terminal configuration, dashboard
overrides and customer-email settings — none of which are visible from this
repository.

**Therefore the branch taken is the conservative one:**

- The Resend customer order confirmation is **kept** for every payment method,
  including successful online-card payments.
- No email, subject line or page describes itself as a קבלה or חשבונית. This is
  enforced by a test (`src/lib/email/order-emails.test.ts`) that greps the email
  service and both templates.
- `DocumentTypeToCreate` was **not** changed.

If CardCom is later confirmed to email the correct legal document automatically,
and the merchant does not want two emails, the only change needed is to skip the
Resend *customer* email on the verified-card path in
`src/lib/payment/cardcomFinalize.ts`. Keep the admin notification, and keep the
customer confirmation for cash and phone-credit orders, which CardCom never sees.

## Unverified attempts send nothing

An online-card checkout writes a pending order row before redirecting, because
the webhook needs a trusted record to verify against (internal id, expected
total, guest token hash, idempotency key, LowProfileId).

That row triggers **no email at all**. `sendOrderEmails` is called from exactly
two places:

- `src/app/(shop)/checkout/actions.ts` — only inside the cash / phone-credit branch
- `src/lib/payment/cardcomFinalize.ts` — only after the compare-and-set that marks
  the order paid

Both are covered by regression tests.

## Verification checklist for the merchant

Answer these against the live CardCom terminal before changing anything:

1. **Is the documents module active** on the terminal at all?
2. **Which document type** is actually produced for an online sale today —
   order, receipt (קבלה), or tax invoice/receipt (חשבונית מס/קבלה)?
3. **Do dashboard settings override the API?** CardCom terminal configuration can
   take precedence over `DocumentTypeToCreate` sent in the request.
4. **Does the customer's email address receive the document**, and is that address
   the one passed in `Document.Email`?
5. **Is delivery automatic** on a successful payment, or does it require a manual
   step in the CardCom dashboard?
6. **Refunds** — is a credit document produced automatically, and to whom is it sent?
7. **Cash orders** — the site never contacts CardCom for these. How is the legal
   document produced for a cash sale?
8. **Phone-credit orders** — the shop charges the card on its own terminal. Which
   document does that flow produce, and does it reach the customer?

Until 1–4 are answered, treat "the customer received a legal receipt" as **not
true** anywhere in the product, and keep the current wording.
