import { z } from "zod";

export const addressSchema = z.object({
  label: z.string().max(50).optional(),
  street: z.string().min(2, "נא להזין שם רחוב").max(100),
  house_number: z.string().min(1, "נא להזין מספר בית").max(10),
  floor: z.string().max(10).optional(),
  apartment: z.string().max(10).optional(),
  city: z.string().min(2, "נא להזין עיר").max(100),
  zip_code: z
    .string()
    .regex(/^\d{5,7}$/, "מיקוד לא תקין")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(300).optional(),
  is_default: z.boolean().optional().default(false),
  delivery_zone_id: z.string().uuid().optional().nullable(),
});

export type AddressFormData = z.infer<typeof addressSchema>;
