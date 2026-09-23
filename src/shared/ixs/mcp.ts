import type {
  DepositBuildResult,
  VaultGetResult,
  WhitelistCheckResult,
} from "./types";

const USER_AGENT = "CapitalRail/0.1";

function mcpUrl() {
  return process.env.IXS_MCP_URL ?? "https://api-v2.ixs.finance/mcp";
}

function parseSseJsonRpc(raw: string): unknown {
  for (const line of raw.split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice(6));
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`MCP response not parseable: ${raw.slice(0, 300)}`);
  }
}

function extractToolText(rpc: unknown): string {
  const payload = rpc as {
    result?: { content?: { type: string; text: string }[]; isError?: boolean };
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const text = payload.result?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(
      `MCP tool returned no text: ${JSON.stringify(rpc).slice(0, 300)}`,
    );
  }

  if (payload.result?.isError) {
    throw new Error(text);
  }

  return text;
}

const MCP_TIMEOUT_MS = 12_000;
const MCP_MAX_ATTEMPTS = 3;

/** Network drops, timeouts, 429 and 5xx; tool-level errors are never retried. */
class TransientMcpError extends Error {}

async function callMcpToolOnce(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  let response: Response;
  let raw: string;
  try {
    response = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
    });
    raw = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TransientMcpError(`MCP ${name} network error: ${message}`);
  }

  if (!response.ok) {
    const message = `MCP ${name} HTTP ${response.status}: ${raw.slice(0, 200)}`;
    if (response.status === 429 || response.status >= 500) {
      throw new TransientMcpError(message);
    }
    throw new Error(message);
  }

  return extractToolText(parseSseJsonRpc(raw));
}

async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await callMcpToolOnce(name, args);
    } catch (error) {
      if (!(error instanceof TransientMcpError) || attempt >= MCP_MAX_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}

export async function vaultGet(vaultId: string): Promise<VaultGetResult> {
  const text = await callMcpTool("vault_get", { vaultId });
  return JSON.parse(text) as VaultGetResult;
}

export async function vaultCheckWhitelist(
  vaultId: string,
  walletAddress: string,
): Promise<WhitelistCheckResult> {
  const text = await callMcpTool("vault_check_whitelist", {
    vaultId,
    walletAddress,
  });

  try {
    return JSON.parse(text) as WhitelistCheckResult;
  } catch {
    return { ok: false, raw: text };
  }
}

export async function vaultBuildRequestDeposit(params: {
  vaultId: string;
  ownerAddress: string;
  assetAmount: string;
}): Promise<DepositBuildResult> {
  const text = await callMcpTool("vault_build_request_deposit", params);
  return JSON.parse(text) as DepositBuildResult;
}

export function isDepositLimitZeroError(message: string): boolean {
  return /limit of 0/i.test(message) || /deposit amount exceeds/i.test(message);
}
