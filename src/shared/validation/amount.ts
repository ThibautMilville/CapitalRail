import { z } from "zod";

/**
 * USDC human amounts for public API + SERV intake.
 * Caps digit length to prevent DoS via huge numeric strings.
 */
export const amountSchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,8})?$/, "Invalid amount")
  .refine((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 1_000_000_000;
  }, "Amount out of range");
