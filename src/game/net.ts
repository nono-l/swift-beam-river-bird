/*
  部屋の電文。盤面を進めるのは主催の sim。客は step しない。
  客の在庫と、ドラッグ中の客神は上書きしない。休止と武器選びは主催だけ。
  札の効果は主催の buyItem だけ。ack の id を変えるな。
*/
import { GUEST_KINDS, emptyItemT, isGuest, ITEMS } from "./data";
import { moveOwnedGuest, placeGuestFromPeer } from "./guests";
import { buyItem } from "./items";
import type { Ball, Game, GuestStock, Hero, HeroId, ItemId, Mode, Projectile } from "./types";

export type Snap = {
  mode: Mode;
  demo: boolean;
  t: number;
  wave: number;
  coins: number;
  marks: number;
  combatPower: number;
  summonCount: number;
  slots: Array<Hero | null>;
  stack: Ball[];
  falling: Ball[];
  wrap: Ball[];
  collab: Ball[];
  boss: Game["boss"];
  projectiles: Projectile[];
  itemT: Game["itemT"];
  itemBuys: Game["itemBuys"];
  flashBanner: string | null;
  flashT: number;
};

export type NetMsg =
  | { t: "hello"; stock: GuestStock }
  | { t: "welcome" }
  | { t: "place"; id: HeroId; slot: number; n: number }
  | { t: "move"; from: number; to: number; n: number }
  | { t: "item"; id: ItemId; n: number }
  | { t: "ack"; n: number; ok: boolean; id: HeroId }
  | { t: "snap"; snap: Snap };

export function packSnap(g: Game): Snap {
  return {
    mode: g.mode,
    demo: g.demo,
    t: g.t,
    wave: g.wave,
    coins: g.coins,
    marks: g.marks,
    combatPower: g.combatPower,
    summonCount: g.summonCount,
    slots: g.slots.map((h) => (h ? { ...h, cleaveIds: h.cleaveIds.slice(0, 8) } : null)),
    stack: g.stack.map((b) => ({ ...b })),
    falling: g.falling.map((b) => ({ ...b })),
    wrap: g.wrap.map((b) => ({ ...b })),
    collab: g.collab.map((b) => ({ ...b })),
    boss: { ...g.boss },
    projectiles: g.projectiles.slice(0, 24).map((p) => ({ ...p })),
    itemT: { ...g.itemT },
    itemBuys: { ...g.itemBuys },
    flashBanner: g.flashBanner,
    flashT: g.flashT,
  };
}

/** 客の手元の客神在庫は上書きしない。盤面だけ主催に合わせる。ドラッグ中の客神は指についていく。 */
export function applySnap(g: Game, s: Snap, dragHeroId?: number) {
  if (!s || !Array.isArray(s.slots) || s.slots.length !== g.slots.length) return;
  if (!s.boss || typeof s.mode !== "string") return;
  const drag = g.drag;
  g.mode = s.mode;
  g.demo = false;
  g.t = s.t;
  g.wave = s.wave;
  g.coins = s.coins;
  g.marks = s.marks;
  g.combatPower = s.combatPower;
  g.summonCount = s.summonCount;
  g.slots = s.slots;
  g.stack = s.stack;
  g.falling = s.falling;
  g.wrap = s.wrap;
  g.collab = s.collab;
  g.boss = s.boss;
  g.projectiles = s.projectiles;
  g.itemT = s.itemT;
  g.itemBuys = s.itemBuys ?? emptyItemT();
  g.flashBanner = s.flashBanner;
  g.flashT = s.flashT;
  if (drag && dragHeroId != null && g.slots[drag.slot]?.id === dragHeroId) g.drag = drag;
  else g.drag = null;
}

export function announcedStock(raw: unknown): GuestStock {
  const out: GuestStock = {};
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const k of GUEST_KINDS) {
    const n = obj[k.id];
    out[k.id] = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(k.max, Math.floor(n))) : 0;
  }
  return out;
}

export function isNetMsg(data: unknown): data is NetMsg {
  if (!data || typeof data !== "object") return false;
  const t = (data as { t?: unknown }).t;
  return typeof t === "string" && (NET_KINDS as readonly string[]).includes(t);
}

/** 部屋のメッセージ種。NetMsg の t と両方向に一致しないと型が落ちる。 */
const NET_KINDS = ["hello", "welcome", "place", "move", "item", "ack", "snap"] as const;
type NetKind = (typeof NET_KINDS)[number];
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
function assertNetKinds(ok: Equal<NetKind, NetMsg["t"]>) {
  return ok;
}
assertNetKinds(true);

export function hostOnMessage(
  g: Game,
  from: string,
  data: unknown,
  stocks: Map<string, GuestStock>,
  reply: (msg: NetMsg, to: string) => void,
) {
  if (!isNetMsg(data)) return;
  switch (data.t) {
    case "hello": {
      if (!stocks.has(from)) stocks.set(from, announcedStock(data.stock));
      reply({ t: "welcome" }, from);
      reply({ t: "snap", snap: packSnap(g) }, from);
      return;
    }
    case "move": {
      const ok =
        Number.isInteger(data.from) &&
        Number.isInteger(data.to) &&
        moveOwnedGuest(g, data.from, data.to, from);
      reply({ t: "ack", n: data.n, ok, id: "shion" }, from);
      return;
    }
    case "item": {
      const id = data.id;
      const known = typeof id === "string" && ITEMS.some((it) => it.id === id);
      const ok = known && buyItem(g, id, from);
      reply({ t: "ack", n: data.n, ok, id: "shion" }, from);
      return;
    }
    case "place": {
      const id = data.id;
      const slot = data.slot;
      if (typeof id !== "string" || !isGuest(id as HeroId) || !Number.isInteger(slot)) {
        reply({ t: "ack", n: data.n, ok: false, id: "shion" }, from);
        return;
      }
      const stock = stocks.get(from);
      const left = stock?.[id as HeroId] ?? 0;
      const ok = left > 0 && placeGuestFromPeer(g, id as HeroId, slot, from);
      if (ok && stock) stock[id as HeroId] = left - 1;
      reply({ t: "ack", n: data.n, ok, id: id as HeroId }, from);
      return;
    }
    case "welcome":
    case "ack":
    case "snap":
      return;
    default: {
      const _never: never = data;
      return _never;
    }
  }
}
