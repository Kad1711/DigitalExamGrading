import { z } from "zod";

export const importTemplateQuerySchema = z.object({
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
});