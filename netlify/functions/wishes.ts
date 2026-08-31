import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { validateWishList, type Wish } from "../../src/domain";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export default async function handler(request: Request, _context: Context) {
  const user = await getUser();
  if (!user) return json({ error: "ログインが必要です。" }, 401);

  const store = getStore({ name: "ashister-wishes", consistency: "strong" });
  const key = `users/${user.id}/wishes.json`;

  if (request.method === "GET") {
    const wishes = await store.get(key, { type: "json" }) as Wish[] | null;
    return json({ wishes: validateWishList(wishes) ?? [] });
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => null) as { wishes?: unknown } | null;
    const wishes = validateWishList(body?.wishes);
    if (!wishes) return json({ error: "欲しいもののデータ形式が正しくありません。" }, 400);
    await store.setJSON(key, wishes);
    return json({ wishes });
  }

  return json({ error: "Method not allowed" }, 405);
}

export const config: Config = {
  path: "/api/wishes",
  method: ["GET", "PUT"],
};
