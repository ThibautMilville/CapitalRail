import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRedeemPack } from "@/features/exit/lib/build-exit";
import { rejectCrossSiteOrigin } from "@/shared/http/origin";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError, zodErrorResponse } from "@/shared/http/safe-error";
import { amountSchema } from "@/shared/validation/amount";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z
  .object({
    vaultId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid vault id"),
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
    shareAmount: z.string().min(1).max(96),
    shareDecimals: z.number().int().min(0).max(36),
    /** When true, shareAmount is already an integer base-units string. */
    asBaseUnits: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.asBaseUnits) {
      if (!/^\d{1,78}$/.test(body.shareAmount)) {
        ctx.addIssue({
          code: "custom",
          path: ["shareAmount"],
          message: "Invalid base-units amount",
        });
      }
      return;
    }
    const parsed = amountSchema.safeParse(body.shareAmount);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["shareAmount"],
        message: "Invalid share amount",
      });
    }
  });

export async function POST(request: Request) {
  const originBlocked = rejectCrossSiteOrigin(request);
  if (originBlocked) return originBlocked;

  const limited = rateLimitResponse(request, RATE_LIMITS.exitBuild);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);

    const payload = await buildRedeemPack({
      vaultId: body.vaultId,
      ownerAddress: body.wallet,
      shareAmount: body.shareAmount,
      shareDecimals: body.shareDecimals,
      asBaseUnits: body.asBaseUnits,
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    const message = error instanceof Error ? error.message : "";
    if (/shareAmount|redeem|limit|whitelist|insufficient/i.test(message)) {
      return NextResponse.json(
        { error: "IXS could not prepare this exit. Check your share balance and try again." },
        { status: 422 },
      );
    }
    return safeServerError("exit-redeem", error, "Could not prepare exit");
  }
}
