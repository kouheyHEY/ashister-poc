import test from "node:test";
import assert from "node:assert/strict";
import { buildFeedback, calculateWishStats } from "../app.js";

test("実現率は欲しいものと購入済みだけを分母にする", () => {
  const stats = calculateWishStats([
    { status: "active" }, { status: "active" }, { status: "purchased" },
    { status: "hold" }, { status: "retired" }
  ]);
  assert.deepEqual(stats, { active: 2, purchased: 1, rate: 33 });
});

test("対象が0件なら実現率は0になる", () => {
  assert.deepEqual(calculateWishStats([{ status: "hold" }]), { active: 0, purchased: 0, rate: 0 });
});

test("回答に応じたフィードバックを返す", () => {
  const result = buildFeedback("結論から言うと、この本は具体例が多く、初めて学ぶ人にも読みやすいです。", "explain");
  assert.match(result.good, /伝え|具体/);
  assert.match(result.next, /結論/);
  assert.match(result.rewrite, /結論から言うと/);
  assert.doesNotMatch(result.rewrite, /ですです/);
});
