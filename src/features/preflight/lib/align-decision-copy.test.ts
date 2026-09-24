import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignDecisionCopy,
  decisionCopyConflicts,
} from "./align-decision-copy";

describe("alignDecisionCopy", () => {
  it("leaves GO memo and steps untouched", () => {
    const aligned = alignDecisionCopy({
      decision: "GO",
      selectedVaultId: "bsc-open",
      memoMarkdown: "**Recommendation:** deposit on BSC.",
      userNextSteps: ["Review the deposit steps: approve first, then deposit."],
    });
    assert.equal(aligned.selectedVaultId, "bsc-open");
    assert.match(aligned.memoMarkdown, /deposit on BSC/);
    assert.equal(aligned.userNextSteps.length, 1);
  });

  it("replaces GO-style memo after verifier veto", () => {
    const aligned = alignDecisionCopy({
      decision: "NO-GO",
      selectedVaultId: "bsc-open",
      memoMarkdown: [
        "## CapitalRail preflight",
        "**Recommendation:** deposit on **BSC**.",
        "Unsigned approve + deposit steps are prepared for wallet review.",
      ].join("\n"),
      userNextSteps: [
        "Review the deposit steps: approve first, then deposit.",
        "Sign only if the amount and chain match your intent.",
      ],
      vetoed: true,
      verification: {
        verdict: "fail",
        issues: [
          {
            vaultId: "bsc-open",
            kind: "rule_violation",
            issue: "Memo understates async settlement risk.",
          },
          {
            vaultId: "bsc-open",
            kind: "fact_mismatch",
            issue: "Selected rail settlement conflicts with mandate claims.",
          },
        ],
      },
    });
    assert.equal(aligned.selectedVaultId, null);
    assert.match(aligned.memoMarkdown, /Final decision: NO-GO/);
    assert.match(aligned.memoMarkdown, /verifier blocked/i);
    assert.doesNotMatch(aligned.memoMarkdown, /Recommendation:\s*deposit/i);
    assert.doesNotMatch(aligned.memoMarkdown, /Unsigned approve/i);
    for (const step of aligned.userNextSteps) {
      assert.equal(decisionCopyConflicts("NO-GO", step, [step]), false);
    }
    assert.equal(
      decisionCopyConflicts("NO-GO", aligned.memoMarkdown, aligned.userNextSteps),
      false,
    );
  });

  it("writes WAIT copy without deposit invitations", () => {
    const aligned = alignDecisionCopy({
      decision: "WAIT",
      selectedVaultId: null,
      memoMarkdown: "You can enter. Proceed with the deposit.",
      userNextSteps: ["Proceed to sign the deposit."],
    });
    assert.match(aligned.memoMarkdown, /Final decision: WAIT/);
    assert.equal(
      decisionCopyConflicts("WAIT", aligned.memoMarkdown, aligned.userNextSteps),
      false,
    );
  });
});
