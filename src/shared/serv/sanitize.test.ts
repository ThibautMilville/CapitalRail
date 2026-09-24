import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractJsonObject,
  sanitizeServPayload,
} from "@/shared/serv/sanitize";

describe("sanitizeServPayload ranking", () => {
  it("truncates ranking[].why to 300 before zod would reject", () => {
    const longWhy = "x".repeat(450);
    const raw = sanitizeServPayload("capitalrail_ranking", {
      selectedVaultId: "abc",
      ranking: [{ vaultId: "abc", why: longWhy }],
      rationale: "ok",
      memoMarkdown: "# memo",
      userNextSteps: ["step"],
    }) as {
      ranking: { why: string }[];
    };

    assert.equal(raw.ranking[0].why.length, 300);
    assert.ok(raw.ranking[0].why.endsWith("..."));
  });

  it("extracts JSON from a markdown fence", () => {
    const parsed = extractJsonObject('```json\n{"a":1}\n```');
    assert.deepEqual(parsed, { a: 1 });
  });
});
