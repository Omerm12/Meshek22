/**
 * Convert an Israeli mobile number to E.164 format required by Supabase/Twilio.
 * "0501234567" → "+972501234567"
 */
export function toE164(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, "");
  if (clean.startsWith("+972")) return clean;
  if (clean.startsWith("0")) return "+972" + clean.slice(1);
  return "+972" + clean;
}
