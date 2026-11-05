/*
  前のドメインの保存を、サーバ同士で一度だけ移す。
  ブラウザの数字は受け取らない。秘密は MIGRATE_SECRET。元は MIGRATE_FROM。
*/
import { readGuestGrowth, readGuestStock, readShop } from "@/game/data";
import { getSql } from "@/lib/db";
import { bearerMatches, cloudFromWire, migrateOrigin } from "./migrate-guard";
import { mergeCloudSave, type CloudMeta } from "@/server/saves";

export type MigrateResult = { ok: true; save: CloudMeta } | { ok: false; reason: string };

type SaveRow = {
  high_wave: number;
  bank: number;
  mark_bank: number;
  guest_bank: number;
  guest_stock: unknown;
  items: unknown;
  shop_atk: number;
  shop_spd: number;
  shop_coin: number;
  shop_okiku: number;
  shop_path: number;
  shop_base: number;
  shop_seed: number;
  shop_back: number;
  shop_arms: number;
  shop_slow: number;
  shop_thin: number;
  shop_auto: number;
};

function whole(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function rowToCloud(row: SaveRow): CloudMeta {
  return {
    highWave: whole(row.high_wave),
    bank: whole(row.bank),
    markBank: whole(row.mark_bank),
    guestStock: readGuestStock(row.guest_stock, row.guest_bank),
    guestGrowth: readGuestGrowth(row.items),
    shop: readShop({
      atk: row.shop_atk,
      spd: row.shop_spd,
      coin: row.shop_coin,
      okiku: row.shop_okiku,
      path: row.shop_path,
      base: row.shop_base,
      seed: row.shop_seed,
      back: row.shop_back,
      arms: row.shop_arms,
      slow: row.shop_slow,
      thin: row.shop_thin,
      auto: row.shop_auto,
    }),
  };
}

function mail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const email = raw.trim().toLowerCase();
  if (!email.includes("@") || email.length > 320) return "";
  return email;
}

/** 秘密を持つサーバだけが叩く。そのメールの保存を、このDBから返す。 */
export async function handleMigrateRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = process.env.MIGRATE_SECRET?.trim();
  if (!secret) return new Response(null, { status: 503 });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401 });
  }
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = mail(body.email);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!email) return new Response(null, { status: 400 });
  const sql = await getSql();
  const rows = await sql<SaveRow>`
    select s.high_wave, s.bank, s.mark_bank, s.guest_bank, s.guest_stock, s.items,
           s.shop_atk, s.shop_spd, s.shop_coin, s.shop_okiku, s.shop_path, s.shop_base,
           s.shop_seed, s.shop_back, s.shop_arms, s.shop_slow, s.shop_thin, s.shop_auto
    from player_saves s
    join "user" u on u."id" = s.user_id
    where lower(u."email") = ${email}
    limit 1
  `;
  const row = rows[0];
  if (!row) return new Response(null, { status: 404 });
  return Response.json(rowToCloud(row));
}

/** 今サインインしているメールだけを、前のドメインへ聞きに行く。 */
export async function pullPrevious(userId: string): Promise<MigrateResult> {
  const secret = process.env.MIGRATE_SECRET?.trim();
  const origin = migrateOrigin(process.env.MIGRATE_FROM);
  if (!secret) return { ok: false, reason: "引継ぎ用の秘密が未設定です" };
  if (!origin) return { ok: false, reason: "引継ぎ元が未設定です" };
  const sql = await getSql();
  const users = await sql<{ email: string }>`select "email" as email from "user" where "id" = ${userId} limit 1`;
  const email = mail(users[0]?.email);
  if (!email) return { ok: false, reason: "Google で保存してから引継いでください" };
  const done = await sql<{ email: string }>`select email from migrate_done where email = ${email} limit 1`;
  if (done[0]) return { ok: false, reason: "すでに引継ぎ済みです" };
  let res: Response;
  try {
    res = await fetch(new URL("/api/migrate", origin), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: "前のドメインに届きませんでした" };
  }
  if (res.status === 404) return { ok: false, reason: "前のドメインに保存がありません" };
  if (res.status === 401 || res.status === 503) return { ok: false, reason: "引継ぎ用の秘密が一致しません" };
  if (!res.ok) return { ok: false, reason: "前のドメインに届きませんでした" };
  const save = cloudFromWire(await res.json().catch(() => null));
  if (!save) return { ok: false, reason: "前のドメインの応答が読めません" };
  await mergeCloudSave(userId, save);
  await sql`insert into migrate_done (email) values (${email}) on conflict (email) do nothing`;
  return { ok: true, save };
}
