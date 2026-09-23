/**
 * Thin CapitalRail MCP server.
 * Tools HTTP-call the existing Next API (no duplicated preflight logic).
 *
 * Run: npm run mcp
 * Env: CAPITALRAIL_BASE_URL (default https://capitalrail.ozc.fr)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (
  process.env.CAPITALRAIL_BASE_URL?.trim() || "https://capitalrail.ozc.fr"
).replace(/\/$/, "");

async function postJson(path: string, body: unknown): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    /* keep raw */
  }
  if (!res.ok) {
    return `HTTP ${res.status} from ${path}\n${pretty}`;
  }
  return pretty;
}

const server = new McpServer({
  name: "capitalrail",
  version: "0.1.0",
});

server.registerTool(
  "capitalrail_intent",
  {
    title: "CapitalRail intent",
    description:
      "Parse free-text deposit intent into a CapitalRail mandate (amount, KYC, settlement, optional chain). Call before capitalrail_preflight when the user spoke in natural language. Proxies POST /api/intent.",
    inputSchema: {
      message: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .describe("User intent, max 500 characters."),
    },
  },
  async ({ message }) => {
    const text = await postJson("/api/intent", { message });
    return { content: [{ type: "text" as const, text }] };
  },
);

server.registerTool(
  "capitalrail_preflight",
  {
    title: "CapitalRail preflight",
    description:
      "IXS vault entry preflight via POST /api/preflight. Returns GO / WAIT / NO-GO with reasons and a trace. Gatekeeper only - do not allocate until GO. Use wallet 0x...0001 for a public preview (no tx pack).",
    inputSchema: {
      walletAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("0x-prefixed EVM address."),
      amount: z.string().describe("USDC amount as a decimal string."),
      allowKyc: z.boolean().describe("Allow whitelist / KYC vaults."),
      requireSyncSettlement: z
        .boolean()
        .describe("Require instant (sync) withdrawals only."),
      preferredChainId: z
        .union([z.literal(56), z.literal(43114)])
        .optional()
        .describe("56 = BSC, 43114 = Avalanche. Omit for any chain."),
      forceRescan: z
        .boolean()
        .optional()
        .describe("Bypass short rail-scan cache when true."),
    },
  },
  async (args) => {
    const body = {
      walletAddress: args.walletAddress,
      amount: args.amount,
      preferences: {
        allowKyc: args.allowKyc,
        requireSyncSettlement: args.requireSyncSettlement,
        ...(args.preferredChainId != null
          ? { preferredChainId: args.preferredChainId }
          : {}),
      },
      ...(args.forceRescan != null ? { forceRescan: args.forceRescan } : {}),
    };
    const text = await postJson("/api/preflight", body);
    return { content: [{ type: "text" as const, text }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("CapitalRail MCP server error:", error);
  process.exit(1);
});
