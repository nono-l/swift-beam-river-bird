/*
  引継ぎAPIの入口チェック。DBも秘密の値も持たない。
*/
import { timingSafeEqual } from "node:crypto";
import { readGuestGrowth, readGuestStock, readShop } from "../game/data.ts";
import type { CloudMeta } from "./saves";

export function bearerMatches(header: string | null, secret: string): boolean {
  const got = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** 環境変数のオリジンだけ。パスや別ホストは付けない。 */
export function migrateOrigin(raw: string | undefined): URL | null {
  if (!raw?.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return new URL(url.origin);
}

function whole(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function cloudFromWire(raw: unknown): CloudMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<CloudMeta>;
  if (typeof p.highWave !== "number" || typeof p.bank !== "number") return null;
  return {
    highWave: whole(p.highWave),
    bank: whole(p.bank),
    markBank: whole(p.markBank),
    guestStock: readGuestStock(p.guestStock),
    guestGrowth: readGuestGrowth(p.guestGrowth),
    shop: readShop(p.shop),
  };
}
