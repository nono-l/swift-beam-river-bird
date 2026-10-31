/*
  札を買った瞬間と、秒が切れた瞬間。
  効いているあいだの倍率は sim が itemT を読む。HP 減算は hurtBall だけ。
  タイトルの店には置かない。Canvas には描かない。
*/
import { ITEMS, itemPrice, slotXY } from "./data";
import * as audio from "./audio";
import { burst, firstEmpty, float, hurtBall, recomputePower, seedHero } from "./sim";
import type { Game, ItemId } from "./types";

function crackStack(g: Game) {
  for (const b of g.stack) {
    if (b.hp > 1) hurtBall(g, b, b.hp - 1);
  }
}

function placeTempGuest(g: Game, owner?: string): boolean {
  const slot = firstEmpty(g);
  if (slot < 0) return false;
  const hero = seedHero(g, "shion", slot);
  hero.stack = 2;
  hero.ephemeral = true;
  if (owner) hero.owner = owner;
  g.slots[slot] = hero;
  const p = slotXY(slot);
  burst(g, p.x, p.y, "#d4b0f0", 12, "puff");
  float(g, p.x, p.y - 26, "短冊", "#d4b4f0");
  recomputePower(g);
  return true;
}

function dropEphemeral(g: Game) {
  let dropped = false;
  for (let i = 0; i < g.slots.length; i++) {
    if (!g.slots[i]?.ephemeral) continue;
    g.slots[i] = null;
    dropped = true;
  }
  if (dropped) recomputePower(g);
}

/** 買う瞬間と、秒が切れた瞬間。継続中の倍率は itemT を読む側に残す。札を足したら空でもここを埋める。 */
const ITEM_FX: Record<ItemId, { onBuy?: (g: Game, owner?: string) => void; onEnd?: (g: Game) => void }> = {
  senko: {},
  shigure: {},
  ware: { onBuy: (g) => crackStack(g) },
  tanzaku: {
    onBuy: (g, owner) => placeTempGuest(g, owner),
    onEnd: (g) => dropEphemeral(g),
  },
  kinpaku: {},
  fubuki: {},
  kaeshi: {},
  suzu: {},
  seijaku: {},
  maneki: {},
};

export function tickItems(g: Game, dt: number) {
  for (const it of ITEMS) {
    const t = g.itemT[it.id] ?? 0;
    if (t <= 0) continue;
    const next = t - dt;
    g.itemT[it.id] = next > 0 ? next : 0;
    if (next <= 0) ITEM_FX[it.id].onEnd?.(g);
  }
}

export function buyItem(g: Game, id: ItemId, owner?: string): boolean {
  if (g.mode !== "playing" || g.demo) return false;
  const def = ITEMS.find((it) => it.id === id);
  if (!def) return false;
  if ((g.itemT[id] ?? 0) > 0) return false;
  if (id === "tanzaku" && firstEmpty(g) < 0) {
    g.flashBanner = "空きがない";
    g.flashT = 0.7;
    return false;
  }
  const price = itemPrice(def.price, g.itemBuys[id] ?? 0);
  if (g.coins < price) return false;
  g.coins -= price;
  g.itemBuys[id] = (g.itemBuys[id] ?? 0) + 1;
  g.itemT[id] = def.sec;
  ITEM_FX[id].onBuy?.(g, owner);
  g.flashBanner = def.name;
  g.flashT = 0.8;
  audio.sfxSelect();
  return true;
}
