import { z } from "zod";

export const settlementSchema = z.object({
  name: z
    .string()
    .min(1, "נא להזין שם יישוב")
    .max(100, "שם היישוב ארוך מדי (עד 100 תווים)"),
  delivery_zone_id: z
    .string()
    .uuid("מזהה אזור משלוח לא תקין")
    .nullable()
    .optional(),
  is_active: z.boolean(),
});

export type SettlementFormData = z.infer<typeof settlementSchema>;
