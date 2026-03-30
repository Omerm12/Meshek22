import { z } from "zod";
import { addressSchema } from "./address";

export const checkoutSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא").max(100),
  phone: z
    .string()
    .regex(/^0\d{8,9}$/, "מספר טלפון לא תקין (לדוגמה: 0501234567)"),
  email: z.string().email("כתובת אימייל לא תקינה"),
  address: addressSchema,
  delivery_zone_id: z.string().uuid("נא לבחור אזור משלוח"),
  delivery_notes: z.string().max(300).optional(),
  requested_delivery_date: z.string().optional().nullable(),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;
