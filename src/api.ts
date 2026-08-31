import type { Wish } from "./domain";

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : "通信に失敗しました。";
    throw new Error(message);
  }
  return payload;
}

export async function fetchWishes(): Promise<Wish[]> {
  const response = await fetch("/api/wishes", { credentials: "include" });
  const payload = await parseResponse(response);
  return Array.isArray(payload.wishes) ? payload.wishes : [];
}

export async function saveWishes(wishes: Wish[]): Promise<Wish[]> {
  const response = await fetch("/api/wishes", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wishes }),
  });
  const payload = await parseResponse(response);
  return Array.isArray(payload.wishes) ? payload.wishes : wishes;
}
