/** Live production base used in agent-facing docs (not a product localhost URL). */
export const CAPITALRAIL_LIVE_BASE = "https://capitalrail.ozc.fr";

/** OpenAPI path (static file under public/). */
export const OPENAPI_PATH = "/openapi.yaml";

export const PREFLIGHT_CURL = `# CapitalRail preflight - OpenAPI: $BASE_URL/openapi.yaml
curl -s -X POST "$BASE_URL/api/preflight" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "walletAddress": "0x0000000000000000000000000000000000000001",
    "amount": "1",
    "preferences": {
      "allowKyc": false,
      "requireSyncSettlement": false,
      "preferredChainId": 56
    }
  }'`;

export const INTENT_CURL = `# CapitalRail intent - free text to mandate
curl -s -X POST "$BASE_URL/api/intent" \\
  -H 'Content-Type: application/json' \\
  -d '{ "message": "500 USDC on BSC, no KYC, delayed withdrawals ok" }'`;

/** OpenAI-compatible tools array wrapping the two documented endpoints. */
export const OPENAI_TOOLS_JSON = `[
  {
    "type": "function",
    "function": {
      "name": "capitalrail_intent",
      "description": "Parse free-text deposit intent into a CapitalRail mandate (amount, KYC, settlement, optional chain). Call before capitalrail_preflight when the user spoke in natural language.",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "required": ["message"],
        "properties": {
          "message": {
            "type": "string",
            "description": "User intent, max 500 characters."
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "capitalrail_preflight",
      "description": "IXS vault entry preflight. Returns GO / WAIT / NO-GO with reasons, risk notes, and a trace. On GO with a real wallet, may include unsigned approve+deposit. Use wallet 0x...0001 for a public preview (no tx pack). Gatekeeper only - do not allocate until GO.",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "required": ["walletAddress", "amount", "preferences"],
        "properties": {
          "walletAddress": {
            "type": "string",
            "description": "0x-prefixed EVM address."
          },
          "amount": {
            "type": "string",
            "description": "USDC amount as a decimal string."
          },
          "preferences": {
            "type": "object",
            "additionalProperties": false,
            "required": ["allowKyc", "requireSyncSettlement"],
            "properties": {
              "allowKyc": { "type": "boolean" },
              "requireSyncSettlement": { "type": "boolean" },
              "preferredChainId": {
                "type": "integer",
                "enum": [56, 43114],
                "description": "56 = BSC, 43114 = Avalanche. Omit for any chain."
              }
            }
          },
          "forceRescan": { "type": "boolean" }
        }
      }
    }
  }
]`;

/** Anthropic-style tools list (same two tools). */
export const ANTHROPIC_TOOLS_JSON = `[
  {
    "name": "capitalrail_intent",
    "description": "Parse free-text deposit intent into a CapitalRail mandate. Call before capitalrail_preflight when the user spoke in natural language.",
    "input_schema": {
      "type": "object",
      "additionalProperties": false,
      "required": ["message"],
      "properties": {
        "message": {
          "type": "string",
          "description": "User intent, max 500 characters."
        }
      }
    }
  },
  {
    "name": "capitalrail_preflight",
    "description": "IXS vault entry preflight. Returns GO / WAIT / NO-GO. Gatekeeper only - do not allocate until GO. Wallet 0x...0001 = public preview.",
    "input_schema": {
      "type": "object",
      "additionalProperties": false,
      "required": ["walletAddress", "amount", "preferences"],
      "properties": {
        "walletAddress": { "type": "string" },
        "amount": { "type": "string" },
        "preferences": {
          "type": "object",
          "additionalProperties": false,
          "required": ["allowKyc", "requireSyncSettlement"],
          "properties": {
            "allowKyc": { "type": "boolean" },
            "requireSyncSettlement": { "type": "boolean" },
            "preferredChainId": { "type": "integer", "enum": [56, 43114] }
          }
        },
        "forceRescan": { "type": "boolean" }
      }
    }
  }
]`;

export const MCP_CURSOR_CONFIG = `{
  "mcpServers": {
    "capitalrail": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/CapitalRail",
      "env": {
        "CAPITALRAIL_BASE_URL": "https://capitalrail.ozc.fr"
      }
    }
  }
}`;
