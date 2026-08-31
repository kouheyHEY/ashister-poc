import test from "node:test";
import assert from "node:assert/strict";
import { calculateWishStats, extractWishName, getSwipeDirection } from "../app.js";

test("実現率は欲しいものと購入済みだけを分母にする", () => {
  const stats = calculateWishStats([{ status: "active" }, { status: "active" }, { status: "purchased" }, { status: "hold" }, { status: "retired" }]);
  assert.deepEqual(stats, { active: 2, purchased: 1, rate: 33 });
});

test("対象が0件なら実現率は0になる", () => {
  assert.deepEqual(calculateWishStats([{ status: "hold" }]), { active: 0, purchased: 0, rate: 0 });
});

test("欲しいもの一覧の左右スワイプを判定する", () => {
  assert.equal(getSwipeDirection(320, 80), "next");
  assert.equal(getSwipeDirection(80, 320), "previous");
  assert.equal(getSwipeDirection(180, 155), null);
});

test("会話文から欲しいものの名前を取り出す", () => {
  assert.equal(extractWishName("折りたたみ自転車が欲しいです。"), "折りたたみ自転車");
  assert.equal(extractWishName("欲しいのは、電子書籍リーダー"), "電子書籍リーダー");
});
