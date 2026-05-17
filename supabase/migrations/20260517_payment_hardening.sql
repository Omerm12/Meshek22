-- Payment hardening: email idempotency tracking + Cardcom transaction audit columns.
--
-- customer_email_sent_at / admin_email_sent_at let the webhook detect a crash-after-pay
-- scenario and retry email sending without sending duplicates.
-- cardcom_approval_number and payment_metadata support audit trails and dispute resolution.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_email_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS admin_email_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS cardcom_approval_number  text,
  ADD COLUMN IF NOT EXISTS payment_metadata         jsonb;

COMMENT ON COLUMN orders.customer_email_sent_at IS
  'Set after customer confirmation email is sent successfully. NULL = not yet sent.';
COMMENT ON COLUMN orders.admin_email_sent_at IS
  'Set after admin new-order email is sent successfully. NULL = not yet sent.';
COMMENT ON COLUMN orders.cardcom_approval_number IS
  'TranzactionInfo.ApprovalNumber from Cardcom GetLpResult response.';
COMMENT ON COLUMN orders.payment_metadata IS
  'Raw Cardcom GetLpResult JSON response stored for audit and dispute resolution.';
