import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fallbackAgentAnswer } from "./fallback-answer";

describe("fallbackAgentAnswer without a preflight", () => {
  it("answers general questions and offers a check instead of refusing", () => {
    const answer = fallbackAgentAnswer("What is CapitalRail?", null);
    assert.match(answer.answer, /entry preflight/);
    assert.match(answer.answer, /Tell me an amount/);
    assert.doesNotMatch(answer.answer, /Run a preflight first/);
    assert.equal(answer.suggestedAction, null);
  });

  it("routes KYC and chain questions to the matching product facts", () => {
    assert.match(fallbackAgentAnswer("How does KYC work?", null).answer, /whitelist/i);
    assert.match(fallbackAgentAnswer("Which chains are supported?", null).answer, /BSC/);
  });
});
