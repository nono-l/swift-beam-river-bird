import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HEROES, START_COINS, itemPrice, slotXY, swingLen, swingTipR } from "./data.ts";
import { onPointerUp } from "./input.ts";
import { buyItem } from "./items.ts";
import { chooseBuff, chooseWeapon } from "./picks.ts";
import { createGame } from "./sim.ts";
import type { HeroId } from "./types.ts";

/** 届く長さ、客神は合成しない、札の両、武器と金皿の倍率。数値を動かす前にこのテストを落とすな。 */
const REACH: Record<HeroId, { base: number; per: number; tip: number }> = {
  okiku: { base: 47, per: 0, tip: 8 },
  mio: { base: 33, per: 3, tip: 5 },
  kuro: { base: 46, per: 4, tip: 6 },
  hakumen: { base: 33, per: 3, tip: 5 },
  takaten: { base: 48, per: 4, tip: 7 },
  shion: { base: 47, per: 0, tip: 7 },
  monika: { base: 50, per: 0, tip: 6 },
};

function expectLen(id: HeroId, level: number): number {
  const hs = (15 / 27) * 1.34;
  const s = 0.92 + level * 0.18;
  const row = REACH[id];
  return (row.base + level * row.per) * s * hs;
}

describe("play lock", () => {
  it("keeps weapon reach", () => {
    for (const id of Object.keys(REACH) as HeroId[]) {
      for (const level of [1, 3, 5]) {
        const h = { defId: id, level };
        assert.equal(swingLen(h), expectLen(id, level));
        assert.equal(swingTipR(h), REACH[id].tip + level);
        assert.equal(HEROES[id].reachBase, REACH[id].base);
        assert.equal(HEROES[id].reachPer, REACH[id].per);
        assert.equal(HEROES[id].tipBase, REACH[id].tip);
      }
    }
  });

  it("spends coins once for a slip and cracks the front temari", () => {
    const g = createGame({ demo: false, muted: true, voiceOn: false });
    g.mode = "playing";
    g.stack[0]!.hp = 10;
    const before = g.coins;
    assert.equal(before, START_COINS);
    assert.equal(buyItem(g, "ware"), true);
    assert.equal(g.coins, before - 25);
    assert.equal(g.itemT.ware, 5);
    assert.equal(g.stack[0]!.hp, 1);
    assert.equal(buyItem(g, "ware"), false);
    assert.equal(g.coins, before - 25);
    g.itemT.ware = 0;
    g.coins = 200;
    assert.equal(itemPrice(25, 1), 38);
    assert.equal(buyItem(g, "ware"), true);
    assert.equal(g.coins, 200 - 38);
    assert.equal(g.itemBuys.ware, 2);
  });

  it("does not merge guest gods", () => {
    const g = createGame({ demo: false, muted: true, voiceOn: false });
    g.mode = "playing";
    const base = g.slots[0]!;
    g.slots[1] = { ...base, id: 91, defId: "shion", slot: 1, stack: 2, level: 1, owner: "p", cleaveIds: [] };
    g.slots[2] = { ...base, id: 92, defId: "shion", slot: 2, stack: 2, level: 1, owner: "p", cleaveIds: [] };
    g.drag = { slot: 1, x: 0, y: 0 };
    const to = slotXY(2);
    onPointerUp(g, to.x, to.y);
    assert.equal(g.slots[1]?.defId, "shion");
    assert.equal(g.slots[2]?.defId, "shion");
    assert.equal(g.slots[1]?.level, 1);
    assert.equal(g.slots[2]?.level, 1);
    assert.equal(g.slots[1]?.id, 92);
    assert.equal(g.slots[2]?.id, 91);
  });

  it("still merges two okiku of the same level", () => {
    const g = createGame({ demo: false, muted: true, voiceOn: false });
    g.mode = "playing";
    const base = g.slots[0]!;
    g.slots[1] = { ...base, id: 93, defId: "okiku", slot: 1, stack: 1, level: 1, cleaveIds: [] };
    g.drag = { slot: 0, x: 0, y: 0 };
    const to = slotXY(1);
    onPointerUp(g, to.x, to.y);
    assert.equal(g.slots[0], null);
    assert.equal(g.slots[1]?.defId, "okiku");
    assert.equal(g.slots[1]?.stack, 2);
    assert.equal(g.slots[1]?.level, 1);
  });

  it("keeps weapon and gold-plate multipliers", () => {
    const g = createGame({ demo: false, muted: true, voiceOn: false });
    chooseWeapon(g, "atk");
    assert.equal(g.atkMul, 1.3);
    chooseWeapon(g, "spd");
    assert.equal(g.spdMul, 1.22);
    chooseWeapon(g, "gold");
    assert.equal(g.goldMul, 1.4);
    chooseWeapon(g, "cheap");
    assert.equal(g.twinSummon, 1);
    const b = createGame({ demo: false, muted: true, voiceOn: false });
    chooseBuff(b, "atk");
    assert.equal(b.atkMul, 1.15);
    chooseBuff(b, "spd");
    assert.equal(b.spdMul, 1.12);
    chooseBuff(b, "gold");
    assert.equal(b.goldMul, 1.18);
    b.boss.track = 0.5;
    chooseBuff(b, "back");
    assert.equal(b.boss.track, 0.64);
    chooseBuff(b, "both");
    assert.ok(Math.abs(b.atkMul - 1.15 * 1.08) < 1e-9);
    assert.ok(Math.abs(b.spdMul - 1.12 * 1.08) < 1e-9);
  });
});
