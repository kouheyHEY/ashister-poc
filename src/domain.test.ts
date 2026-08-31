import { describe, expect, it } from "vitest";
import { calculateWishStats, extractWishName, getSwipeDirection, parsePriority, validateWishList, type Wish } from "./domain";

const wish = (status: Wish["status"]): Wish => ({ id: crypto.randomUUID(), name: "テスト", reason: "", price: 0, priority: "medium", status, createdAt: "2026-08-31" });

describe("欲しいものの集計", () => {
  it("実現率は欲しいものと購入済みだけを分母にする", () => {
    expect(calculateWishStats([wish("active"), wish("active"), wish("purchased"), wish("hold"), wish("retired")])).toEqual({ active: 2, purchased: 1, rate: 33 });
  });

  it("対象が0件なら実現率は0になる", () => {
    expect(calculateWishStats([wish("hold")])).toEqual({ active: 0, purchased: 0, rate: 0 });
  });
});

describe("ルールベース会話", () => {
  it("会話文から欲しいものの名前を取り出す", () => {
    expect(extractWishName("折りたたみ自転車が欲しいです。")).toBe("折りたたみ自転車");
    expect(extractWishName("欲しいのは、電子書籍リーダー")).toBe("電子書籍リーダー");
  });

  it("想定される優先度表現を解釈する", () => {
    expect(parsePriority("ふつうぐらい")).toBe("medium");
    expect(parsePriority("優先度高め")).toBe("high");
    expect(parsePriority("いつかでいい")).toBe("low");
    expect(parsePriority("ちかい")).toBeNull();
  });
});

it("欲しいもの一覧の左右スワイプを判定する", () => {
  expect(getSwipeDirection(320, 80)).toBe("next");
  expect(getSwipeDirection(80, 320)).toBe("previous");
  expect(getSwipeDirection(180, 155)).toBeNull();
});

it("保存APIへ渡すデータを検証する", () => {
  expect(validateWishList([wish("active")])).not.toBeNull();
  expect(validateWishList([{ name: "IDなし" }])).toBeNull();
});
