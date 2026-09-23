import { NextResponse } from "next/server";
import { z } from "zod";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { getPosition } from "@/shared/ixs/rest";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  vaultId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid vault id"),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

export async function GET(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.position);
  if (limited) return limited;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { position } = await getPosition(
      parsed.data.vaultId,
      parsed.data.wallet,
    );
    return NextResponse.json({
      shares: position.balances.shares.display,
      shareValueInAssets: position.balances.shareValueInAssets.display,
      assetBalance: position.balances.asset.display,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "position failed" },
      { status: 502 },
    );
  }
}
