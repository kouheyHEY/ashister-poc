import test from "node:test";
import assert from "node:assert/strict";
import { calculateWishStats, getSwipeDirection, selectNextWish } from "../app.js";

test("実現率は欲しいものと購入済みだけを分母にする", () => {
  const stats = calculateWishStats([{ status: "active" }, { status: "active" }, { status: "purchased" }, { status: "hold" }, { status: "retired" }]);
  assert.deepEqual(stats, { active: 2, purchased: 1, rate: 33 });
});

test("対象が0件なら実現率は0になる", () => {
  assert.deepEqual(calculateWishStats([{ status: "hold" }]), { active: 0, purchased: 0, rate: 0 });
});

test("次に叶えたいものは欲しい状態の優先度が高い項目になる", () => {
  const next = selectNextWish([
    { name: "いつか", status: "active", priority: "low", createdAt: "2026-01-01" },
    { name: "購入済み", status: "purchased", priority: "high", createdAt: "2026-01-01" },
    { name: "優先", status: "active", priority: "high", createdAt: "2026-02-01" }
  ]);
  assert.equal(next.name, "優先");
});

test("欲しいもの一覧の左右スワイプを判定する", () => {
  assert.equal(getSwipeDirection(320, 80), "next");
  assert.equal(getSwipeDirection(80, 320), "previous");
  assert.equal(getSwipeDirection(180, 155), null);
});
