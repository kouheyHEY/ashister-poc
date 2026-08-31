export type WishStatus = "active" | "purchased" | "hold" | "retired";
export type WishPriority = "high" | "medium" | "low";

export interface Wish {
  id: string;
  name: string;
  reason: string;
  price: number;
  priority: WishPriority;
  status: WishStatus;
  createdAt: string;
}

export interface WishDraft {
  name: string;
  reason: string;
  price: number;
  priority: WishPriority;
}

export function calculateWishStats(wishes: Wish[]) {
  const active = wishes.filter((wish) => wish.status === "active").length;
  const purchased = wishes.filter((wish) => wish.status === "purchased").length;
  const denominator = active + purchased;
  return { active, purchased, rate: denominator ? Math.round((purchased / denominator) * 100) : 0 };
}

export function getSwipeDirection(startX: number, endX: number, threshold = 48) {
  const distance = endX - startX;
  if (Math.abs(distance) < threshold) return null;
  return distance < 0 ? "next" : "previous";
}

export function extractWishName(message: string) {
  return message
    .trim()
    .replace(/^(欲しいものは|欲しいのは|追加したいのは)[、,:：\s]*/, "")
    .replace(/[、,]?\s*(が)?(欲しい|ほしい|買いたい|を追加したい)(です|です。|。)?$/, "")
    .trim();
}

export function parsePriority(message: string): WishPriority | null {
  const value = message.trim().toLowerCase();
  if (/高|たか|急ぎ|優先/.test(value)) return "high";
  if (/普通|ふつう|中くらい|真ん中|ほどほど/.test(value)) return "medium";
  if (/いつか|低|ひく|急がない/.test(value)) return "low";
  return null;
}

export function createWish(draft: WishDraft): Wish {
  return {
    id: crypto.randomUUID(),
    ...draft,
    price: Number(draft.price) || 0,
    status: "active",
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

export function isWish(value: unknown): value is Wish {
  if (!value || typeof value !== "object") return false;
  const wish = value as Record<string, unknown>;
  return typeof wish.id === "string"
    && typeof wish.name === "string"
    && wish.name.trim().length > 0
    && wish.name.length <= 60
    && typeof wish.reason === "string"
    && wish.reason.length <= 160
    && typeof wish.price === "number"
    && Number.isFinite(wish.price)
    && wish.price >= 0
    && ["high", "medium", "low"].includes(String(wish.priority))
    && ["active", "purchased", "hold", "retired"].includes(String(wish.status))
    && typeof wish.createdAt === "string";
}

export function validateWishList(value: unknown): Wish[] | null {
  if (!Array.isArray(value) || value.length > 500 || !value.every(isWish)) return null;
  return value;
}
