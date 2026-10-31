/*
  数値と配置の置き場。sim はルール、draw は絵。
  マスを正方形グリッドに戻すな。円陣は同心円 SLOT_LAYOUT。
  近接の長さは swingLen / swingTip が描画と当たりの唯一の定義。
*/
import type { BuffPickId, GuestCardId, GuestGrowth, GuestGrowthBook, GuestStock, HeroDef, HeroId, ItemId, Role, RouteOption, ShopId, ShopUpgrades, WeaponOption, WeaponPickId } from "./types";

export const VW = 390;
export const VH = 844;

export const PIT_X = 195;
export const PIT_Y = 448;
export const PIT_R = 156;

export const SLOT_R = 15;
export const SWING_REACH = 1.34;
export const STARTER_SLOT = 0;

// 同心円（1+8+12+16）。3x3 にも 6x6 の真四角にも戻すな。縁が空き、角が円からはみ出す。
export const SLOT_LAYOUT: Array<{ x: number; y: number }> = (() => {
  const out: Array<{ x: number; y: number }> = [];
  const rings: Array<{ n: number; r: number; a0: number }> = [
    { n: 1, r: 0, a0: 0 },
    { n: 8, r: 46, a0: Math.PI / 8 },
    { n: 12, r: 88, a0: 0 },
    { n: 16, r: 130, a0: Math.PI / 16 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const ang = ring.a0 + (i / ring.n) * Math.PI * 2 - Math.PI / 2;
      out.push({
        x: PIT_X + Math.cos(ang) * ring.r,
        y: PIT_Y + Math.sin(ang) * ring.r,
      });
    }
  }
  return out;
})();

export const SLOT_COUNT = SLOT_LAYOUT.length;
export const SLOT_HIT_R = 19;

export const BALL_R = 24;
export const HEX_DX = 47;
export const HEX_DY = 41;
export const STACK_BOTTOM = PIT_Y - PIT_R + 10;
export const STACK_CAP = 15;
export const STACK_START = 10;

export const WRAP_R = 168;
export const WRAP_ORB_R = 13;
export const WRAP_CAP = 18;
export const WRAP_START = Math.PI * 1.18;
export const WRAP_SPAN = Math.PI * 1.85;

/** t=0 がゴール（11時）。t が増えると縁をゴールから離れて進む。0 をスタートにするとゴールが近くなる。 */
export const GOAL_A = (Math.PI * 4) / 3;
export const BELT_SPAN = Math.PI * 1.72;
export const BELT_SLOTS = 20;
/** 花魁の開始。下付近。ゴールを近い左下に戻すな。 */
export const BELT_START = 0.48;
/** 花魁の位置がこれ未満ならゴールが近い。0 がゴール。 */
export const DANGER_TRACK = 0.14;

export function oiranDanger(track: number): number {
  if (track >= DANGER_TRACK) return 0;
  return Math.max(0, Math.min(1, 1 - track / DANGER_TRACK));
}
export const BELT_FILL = 10;
export const NETA_SPAWN_CD = 2;
export const NETA_RESERVE = 240;
// 9時は a=π。t がこれ以下＝11時ゴール側へ進んだ。花魁バックはここを過ぎてから出す。
export const NINE_T = (GOAL_A - Math.PI) / BELT_SPAN;

export const BOSS_X = 236;
export const BOSS_Y = PIT_Y + 92;

export function beltPose(t: number): { x: number; y: number; a: number } {
  const tt = Math.max(0, Math.min(1, t));
  const a = GOAL_A - tt * BELT_SPAN;
  return {
    x: PIT_X + Math.cos(a) * WRAP_R,
    y: PIT_Y + Math.sin(a) * WRAP_R,
    a,
  };
}

/** 11時ゴールの反対（5時）。本編レーンより内側の短い弧。ゴールには繋がらない。 */
export const COLLAB_R = 148;
export const COLLAB_MID = Math.PI / 3;
export const COLLAB_SPAN = 0.98;
export const COLLAB_FILL = 4;
export const COLLAB_CAP = 6;
export const COLLAB_CD = 1.7;
export const COLLAB_SPEED = 0.075;
export const COLLAB_ORB_R = 12;

export function collabPose(t: number): { x: number; y: number; a: number } {
  const tt = Math.max(0, Math.min(1, t));
  const a = COLLAB_MID + COLLAB_SPAN / 2 - tt * COLLAB_SPAN;
  return {
    x: PIT_X + Math.cos(a) * COLLAB_R,
    y: PIT_Y + Math.sin(a) * COLLAB_R,
    a,
  };
}

/** 基礎攻撃は全部 1。上げるのは店の shop.base だけ。定数を上げるな。 */
export const HEROES: Record<HeroId, HeroDef> = {
  okiku: {
    id: "okiku",
    name: "お菊",
    title: "井戸の童",
    rarity: "common",
    role: "melee",
    atk: 1,
    interval: 0.92,
    range: 64,
    color: "#d4a07a",
    projectile: "#e8c9a0",
    weapon: "井戸の柄杓",
    blurb: "井戸から上がった童。円の手前を守る。",
    reachBase: 47,
    reachPer: 0,
    tipBase: 8,
  },
  mio: {
    id: "mio",
    name: "澪",
    title: "白狐巫女",
    rarity: "rare",
    role: "ranged",
    atk: 1,
    interval: 1.08,
    range: 96,
    color: "#f0e6d8",
    projectile: "#9ad8e8",
    weapon: "白狐の幣",
    blurb: "白い狐の巫女。遠くの皿へ光を放つ。",
    reachBase: 33,
    reachPer: 3,
    tipBase: 5,
  },
  kuro: {
    id: "kuro",
    name: "黒",
    title: "二尾の刃",
    rarity: "rare",
    role: "melee",
    atk: 1,
    interval: 0.78,
    range: 68,
    color: "#3a2a28",
    projectile: "#c45a4a",
    weapon: "二尾の刃",
    blurb: "短い刃を速く回す。縁に近いほど強い。",
    reachBase: 46,
    reachPer: 4,
    tipBase: 6,
  },
  hakumen: {
    id: "hakumen",
    name: "白面",
    title: "無貌の杖",
    rarity: "elite",
    role: "ranged",
    atk: 1,
    interval: 1.14,
    range: 104,
    color: "#c8b8d8",
    projectile: "#b48cff",
    weapon: "無貌の杖",
    blurb: "顔のない客人。杖の先から怨を飛ばす。",
    reachBase: 33,
    reachPer: 3,
    tipBase: 5,
  },
  takaten: {
    id: "takaten",
    name: "高天",
    title: "白帽の鎌",
    rarity: "elite",
    role: "melee",
    atk: 1,
    interval: 0.86,
    range: 74,
    color: "#e8e4dc",
    projectile: "#7ec8e0",
    weapon: "白帽の鎌",
    blurb: "白い帽子の刈り手。鎌は円の外まで届く。",
    reachBase: 48,
    reachPer: 4,
    tipBase: 7,
  },
  shion: {
    id: "shion",
    name: "紫苑",
    title: "客神",
    rarity: "elite",
    role: "melee",
    atk: 1,
    interval: 0.84,
    range: 70,
    color: "#b080d8",
    projectile: "#d4b0f0",
    weapon: "紫陽のかんざし",
    blurb: "侵食に招かれた客。花の簪で円の縁を払う。",
    reachBase: 47,
    reachPer: 0,
    tipBase: 7,
  },
  monika: {
    id: "monika",
    name: "モニカ",
    title: "客神",
    rarity: "elite",
    role: "melee",
    atk: 1,
    interval: 0.96,
    range: 76,
    color: "#9ec8ea",
    projectile: "#d6ecff",
    weapon: "蒼のリボン",
    blurb: "白い帽子の客。光のリボンで円の縁を払う。",
    reachBase: 50,
    reachPer: 0,
    tipBase: 6,
  },
};

export const CORE_HERO_IDS: HeroId[] = ["okiku", "mio", "kuro", "hakumen", "takaten"];

export type GuestKind = { id: HeroId; max: number; start: number };

/** 客神のカタログ。在庫の増え方は guestSlipCost。華の値段は持たない。 */
export const GUEST_KINDS: GuestKind[] = [
  { id: "shion", max: 8, start: 2 },
  { id: "monika", max: 8, start: 0 },
];

export const GUEST_ID: HeroId = GUEST_KINDS[0]!.id;
/** 右上の華の当たり。客神一覧は HTML。Canvas に客神の当たりを戻すとボタンと重なる。 */
export const MARK_BADGE = { x: 306, y: 48, w: 76, h: 40 };
export const GUEST_CARD = { x: 10, y: 54, w: 288, h: 124 };
export const GUEST_HINT = "空いているマスを選ぶ";

export type { GuestStock } from "./types";

function clampGuest(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(n)));
}

export function guestKind(id: HeroId): GuestKind | undefined {
  return GUEST_KINDS.find((k) => k.id === id);
}

/** 次の1体に使う客神札。開始在庫の次が3枚、以後は3倍。 */
export function guestSlipCost(kind: GuestKind, owned: number): number {
  const step = Math.max(0, owned - kind.start);
  return 3 * 3 ** step;
}

export function isGuest(id: HeroId): boolean {
  return guestKind(id) != null;
}

export function readGuestStock(raw: unknown, legacyBank?: number): GuestStock {
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object") obj = p as Record<string, unknown>;
    } catch {
      obj = null;
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  const out: GuestStock = {};
  for (const k of GUEST_KINDS) {
    const n = obj?.[k.id];
    if (typeof n === "number" && Number.isFinite(n)) out[k.id] = clampGuest(n, k.max);
  }
  const first = GUEST_KINDS[0];
  if (first && typeof legacyBank === "number" && Number.isFinite(legacyBank)) {
    const legacy = clampGuest(legacyBank, first.max);
    out[first.id] = Math.max(out[first.id] ?? 0, legacy);
  }
  for (const k of GUEST_KINDS) {
    if (out[k.id] == null) out[k.id] = k.start;
  }
  return out;
}

export function mergeGuestStock(a: GuestStock, b: GuestStock): GuestStock {
  const out: GuestStock = {};
  for (const k of GUEST_KINDS) {
    const av = a[k.id];
    const bv = b[k.id];
    out[k.id] = av == null && bv == null ? k.start : Math.min(k.max, Math.max(av ?? 0, bv ?? 0));
  }
  return out;
}

export function guestLine(stock: GuestStock): string {
  return GUEST_KINDS.map((k) => `${HEROES[k.id].name}${stock[k.id] ?? 0}`).join(" ");
}

export function hitMarkBadge(x: number, y: number): boolean {
  const r = MARK_BADGE;
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function roleLabel(role: Role): string {
  return role === "melee" ? "近接" : "遠距離";
}

export const ROSTER_IDS: HeroId[] = [...CORE_HERO_IDS, ...GUEST_KINDS.map((k) => k.id)];

export const RARITY_WEIGHT: Record<string, number> = {
  common: 72,
  rare: 22,
  elite: 6,
};

export function slotXY(i: number): { x: number; y: number } {
  return SLOT_LAYOUT[i] ?? { x: PIT_X, y: PIT_Y };
}

export const BUFF_CARD_W = 300;
export const BUFF_CARD_H = 80;
export const BUFF_CARD_GAP = 14;

export function buffCardRect(i: number): { x: number; y: number; w: number; h: number } {
  const total = 3 * BUFF_CARD_H + 2 * BUFF_CARD_GAP;
  const y0 = (VH - total) / 2 + 18;
  return {
    x: (VW - BUFF_CARD_W) / 2,
    y: y0 + i * (BUFF_CARD_H + BUFF_CARD_GAP),
    w: BUFF_CARD_W,
    h: BUFF_CARD_H,
  };
}

/** 描画と当たりで共有する武器の長さ。drawWeapon の rotate(+Y) と同じ向き。cos/sin で先端を取ると90度ずれる。 */
export function swingLen(h: { defId: HeroId; level: number; reachMul?: number }): number {
  const hs = (SLOT_R / 27) * SWING_REACH;
  const s = 0.92 + h.level * 0.18;
  const d = HEROES[h.defId];
  const L = d.reachBase + h.level * d.reachPer;
  return L * s * hs * (h.reachMul ?? 1);
}

export function swingTipR(h: { defId: HeroId; level: number }): number {
  return HEROES[h.defId].tipBase + h.level;
}

export function swingTip(
  h: { defId: HeroId; level: number; swing: number },
  x: number,
  y: number,
  arm = 0,
  arms = 1,
): { x: number; y: number } {
  const n = Math.max(1, arms);
  const a = h.swing + (arm * Math.PI * 2) / n;
  const len = swingLen(h);
  return {
    x: x - Math.sin(a) * len,
    y: y + Math.cos(a) * len,
  };
}

export function wrapAngle(index: number): number {
  return WRAP_START - (index + 0.5) * (WRAP_SPAN / WRAP_CAP);
}

export function wrapXY(index: number): { x: number; y: number } {
  const a = wrapAngle(index);
  return {
    x: PIT_X + Math.cos(a) * WRAP_R,
    y: PIT_Y + Math.sin(a) * WRAP_R,
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GOLD_FAST_KILLS = 4;
export const GOLD_EARLY_EVERY = 4;
export const GOLD_LATE_NORMAL = 10;

// 新しく出す皿だけ。レーン上の皿の HP は出たときのまま。開始は 1。wave は掛けない。
export function netaHpAt(goldKills: number): number {
  const k = Math.max(0, goldKills);
  const earlyTimes = 2;
  const earlyInterval = 3;
  let doubles: number;
  if (k < earlyTimes * earlyInterval) {
    doubles = Math.floor(k / earlyInterval);
  } else {
    doubles = earlyTimes + (k - earlyTimes * earlyInterval);
  }
  return Math.max(1, 2 ** doubles);
}

export function summonCostAt(count: number): number {
  return Math.min(40, 10 + count * 2);
}

/** 召喚コストと同じ回数。分けると手毬の硬さと両の増え方がずれる。 */
export function temariHpAt(count: number, rng: () => number, wave = 1, thin = 0): number {
  let mul: number;
  if (count <= 2) mul = 1;
  else if (count <= 5) mul = 3;
  else if (count <= 9) mul = rng() > 0.48 ? 9 : 4.5;
  else if (count <= 14) {
    const r = rng();
    mul = r > 0.84 ? 17.5 : r > 0.5 ? 10 : 7.5;
  } else {
    const grow = Math.pow(1.42, 1 + Math.floor((count - 15) / 5));
    const r = rng();
    mul = (r > 0.8 ? 16 : r > 0.4 ? 9 : 6) * grow;
  }
  const waveMul = Math.pow(1.28, Math.max(0, wave - 1));
  return Math.max(1, Math.round(2 * mul * waveMul * temariThinAt(thin)));
}

export function makeWave(
  wave: number,
  rng: () => number,
  startN = 0,
  thin = 0,
): Array<{ hp: number; pattern: number }> {
  const count = 18 + wave * 7;
  const out: Array<{ hp: number; pattern: number }> = [];
  for (let i = 0; i < count; i++) {
    out.push({
      hp: temariHpAt(startN + i, rng, wave, thin),
      pattern: (i + wave * 3) % 5,
    });
  }
  return out;
}

/** 199 や 999 に戻すな。wave ごとに 1.38 倍。 */
export function bossHp(wave: number): number {
  return Math.round(9999 * Math.pow(1.38, wave - 1));
}

export function dropInterval(wave: number): number {
  return Math.max(3.0, 5.2 - wave * 0.16);
}

/** 表示レベルと攻撃倍率は同じ奇数。分けるとレベル1が1でなくなる。 */
export function displayLevel(level: number): number {
  return 2 * level - 1;
}

/** 表示10まで単体。11以上は弾を出さず、先端が通った寿司すべてに入る。 */
export function isMultiHit(level: number): boolean {
  return displayLevel(level) > 10;
}

export const WEAPON_POOL: Array<WeaponOption & { id: WeaponPickId }> = [
  { id: "atk", name: "鬼金棒", desc: "全員の攻撃力 +30%" },
  { id: "spd", name: "時雨", desc: "攻撃速度 +22%" },
  { id: "gold", name: "金運", desc: "獲得コイン +40%" },
  { id: "cheap", name: "口寄せ札", desc: "手毬1つにつき式神がもう1体。重ねると増える" },
];

export const BUFF_POOL: Array<WeaponOption & { id: BuffPickId }> = [
  { id: "atk", name: "攻撃力UP", desc: "全員の攻撃力 +15%" },
  { id: "spd", name: "攻撃速度UP", desc: "振りと攻撃間隔が速くなる" },
  { id: "gold", name: "金運UP", desc: "入手両が増える" },
  { id: "back", name: "花魁バック", desc: "花魁が大きく下がる" },
  { id: "both", name: "冴え", desc: "攻撃力と速度が少し上がる" },
];

export function routeFor(wave: number): RouteOption[] {
  if (wave <= 2) {
    return [
      {
        id: "hakumen",
        name: "白面",
        atkLabel: "攻撃力 +1000%",
        chanceLabel: "失敗確率 50%",
        risk: true,
        failChance: 0.5,
        atkMul: 11,
      },
      {
        id: "takaten",
        name: "高天",
        atkLabel: "攻撃力 +500%",
        chanceLabel: "成功率 100%",
        risk: false,
        failChance: 0,
        atkMul: 6,
      },
    ];
  }
  return [
    {
      id: "kuro",
      name: "黒",
      atkLabel: "攻撃力 +800%",
      chanceLabel: "失敗確率 35%",
      risk: true,
      failChance: 0.35,
      atkMul: 9,
    },
    {
      id: "mio",
      name: "澪",
      atkLabel: "攻撃力 +400%",
      chanceLabel: "成功率 100%",
      risk: false,
      failChance: 0,
      atkMul: 5,
    },
  ];
}

export const SAVE_KEY = "onryo-ring-v1";
export const DEBUG_KEY = "onryo-ring-debug";
export const PLAY_KEY = "onryo-ring-play";
export const AUTO_KEY = "onryo-ring-auto";
export const VOICE_KEY = "onryo-ring-voice";
export const TUTORIAL_KEY = "onryo-ring-tutorial";
export const ITEM_TAP_KEY = "onryo-ring-item-tap";

export const GACHA_COST = 100;
export const GACHA_MULTI = 11;
export const GACHA_MULTI_COST = 1000;
/** 刃・足・縁。この値未満。3枚で等分するので、幅を別の数に書かない。 */
export const GACHA_UPGRADE_P = 0.24;
/** 客神札。この値未満。 */
export const GACHA_SLIP_P = 0.6;
/** 端両。この値未満。 */
export const GACHA_COIN_P = 0.78;
/** 花びら。この値未満。残りは封。 */
export const GACHA_MARK_P = 0.9;
export const GACHA_COIN_MISS = 40;
export const GACHA_MARK_MISS = 8;
/** 段ごとの倍率。sim に散らすとガチャの説明と戦闘がずれる。 */
export const GUEST_CARD_STEP: Record<GuestCardId, number> = { blade: 0.08, step: 0.06, reach: 0.05 };

export function guestCardMul(card: GuestCardId, level: number): number {
  return 1 + GUEST_CARD_STEP[card] * Math.max(0, level);
}
export const GUEST_CARD_MAX = 5;
export const GUEST_CARDS: Array<{ id: GuestCardId; name: string; blurb: string }> = [
  { id: "blade", name: "刃", blurb: "攻撃" },
  { id: "step", name: "足", blurb: "振りと間隔" },
  { id: "reach", name: "縁", blurb: "届く長さ" },
];

export function emptyGuestGrowth(): GuestGrowth {
  return { blade: 0, step: 0, reach: 0, seal: 0, slips: 0 };
}

export function readGuestGrowth(raw: unknown): GuestGrowthBook {
  const out: GuestGrowthBook = {};
  for (const k of GUEST_KINDS) out[k.id] = emptyGuestGrowth();
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const k of GUEST_KINDS) {
    const row = o[k.id];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const g = emptyGuestGrowth();
    for (const key of ["blade", "step", "reach", "seal", "slips"] as const) {
      const n = r[key];
      const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
      const cap = key === "seal" ? 2 : key === "slips" ? 9999 : GUEST_CARD_MAX;
      g[key] = Math.max(0, Math.min(cap, v));
    }
    out[k.id] = g;
  }
  return out;
}

export function mergeGuestGrowth(a: GuestGrowthBook, b: GuestGrowthBook): GuestGrowthBook {
  const out = readGuestGrowth(null);
  for (const k of GUEST_KINDS) {
    const x = a[k.id] ?? emptyGuestGrowth();
    const y = b[k.id] ?? emptyGuestGrowth();
    out[k.id] = {
      blade: Math.max(x.blade, y.blade),
      step: Math.max(x.step, y.step),
      reach: Math.max(x.reach, y.reach),
      seal: Math.max(x.seal, y.seal),
      slips: Math.max(x.slips, y.slips),
    };
  }
  return out;
}

export function guestGrowthOf(book: GuestGrowthBook, id: HeroId): GuestGrowth {
  return book[id] ?? emptyGuestGrowth();
}

export const START_COINS = 60;
export const SHOP_MAX = 12;
export const SHOP_T2_OKIKU_MAX = 5;
export const SHOP_T2_PATH_MAX = 5;
export const SHOP_T2_BASE_MAX = 6;
export const SHOP_T3_MAX = 5;
export const SHOP_T3_SPEND = 10000;
export const SHOP_T3_MIN_LV = 2;
export const SHOP_T4_MAX = 5;
export const SHOP_T4_SPEND = 10000;
export const SHOP_T4_MIN_LV = 2;
export const SHOP_AUTO_COST = 500_000;
export const SHOP_AUTO_MAX = 1;

export function emptyShop(): ShopUpgrades {
  return {
    atk: 0, spd: 0, coin: 0, okiku: 0, path: 0, base: 0, seed: 0, back: 0, arms: 0, slow: 0, thin: 0, auto: 0,
  };
}

export function readShop(p?: Partial<ShopUpgrades> | null): ShopUpgrades {
  const e = emptyShop();
  if (!p) return e;
  return {
    atk: p.atk ?? 0,
    spd: p.spd ?? 0,
    coin: p.coin ?? 0,
    okiku: p.okiku ?? 0,
    path: p.path ?? 0,
    base: p.base ?? 0,
    seed: p.seed ?? 0,
    back: p.back ?? 0,
    arms: p.arms ?? (p as { luck?: number }).luck ?? 0,
    slow: p.slow ?? 0,
    thin: p.thin ?? 0,
    auto: p.auto ?? 0,
  };
}

export function shopT1Maxed(shop: ShopUpgrades): boolean {
  return shop.atk >= SHOP_MAX && shop.spd >= SHOP_MAX && shop.coin >= SHOP_MAX;
}

export function shopMax(id: ShopId): number {
  if (id === "okiku") return SHOP_T2_OKIKU_MAX;
  if (id === "path") return SHOP_T2_PATH_MAX;
  if (id === "base") return SHOP_T2_BASE_MAX;
  if (id === "seed" || id === "back" || id === "arms") return SHOP_T3_MAX;
  if (id === "slow" || id === "thin") return SHOP_T4_MAX;
  if (id === "auto") return SHOP_AUTO_MAX;
  return SHOP_MAX;
}

export function isShopT2(id: ShopId): boolean {
  return id === "okiku" || id === "path" || id === "base";
}

export function isShopT3(id: ShopId): boolean {
  return id === "seed" || id === "back" || id === "arms";
}

export function isShopT4(id: ShopId): boolean {
  return id === "slow" || id === "thin" || id === "auto";
}

export const SHOP_T2_IDS: ShopId[] = ["okiku", "path", "base"];
export const SHOP_T3_IDS: ShopId[] = ["seed", "back", "arms"];

export function extraOkikuAt(lv: number): number {
  const n = Math.max(0, lv);
  return (n * (n + 1)) / 2;
}

export function weaponAt(count: number, path: number): number {
  const n = Math.max(0, path);
  const base = Math.max(1, Math.round(14 * 0.5 ** n));
  const step = Math.max(2, Math.round(22 * 0.55 ** n));
  return base + count * step;
}

export function routeProcessedAt(path: number): number {
  return Math.max(1, Math.round(38 * 0.5 ** Math.max(0, path)));
}

export function routeHpAt(path: number): number {
  return Math.min(0.8, 0.15 + Math.max(0, path) * 0.15);
}

export function wrapBackAt(lv: number): number {
  return 1 + Math.max(0, lv) * 0.5;
}

export function armCount(lv: number): number {
  return 1 + Math.max(0, lv);
}

export function oiranPaceAt(lv: number): number {
  return Math.max(0.2, 1 - 0.12 * Math.max(0, lv));
}

export type ItemDef = {
  id: ItemId;
  name: string;
  sec: number;
  price: number;
  blurb: string;
};

/** 挑戦中に両で買う使い捨て。効いている秒数のあいだ同じ札は買えない。 */
export const ITEMS: ItemDef[] = [
  { id: "senko", name: "線香", sec: 10, price: 40, blurb: "花魁が止まる" },
  { id: "shigure", name: "時雨", sec: 10, price: 30, blurb: "振りが速い" },
  { id: "ware", name: "割れ", sec: 5, price: 25, blurb: "手前の手毬を割る" },
  { id: "tanzaku", name: "短冊", sec: 20, price: 50, blurb: "客神が一時来る" },
  { id: "kinpaku", name: "金箔", sec: 10, price: 35, blurb: "両が倍" },
  { id: "fubuki", name: "吹雪", sec: 10, price: 40, blurb: "寿司を崩すと華" },
  { id: "kaeshi", name: "返刃", sec: 10, price: 45, blurb: "押し戻しが倍" },
  { id: "suzu", name: "鈴", sec: 10, price: 30, blurb: "刃の先が広い" },
  { id: "seijaku", name: "静寂", sec: 5, price: 55, blurb: "攻撃と速度が3倍" },
  { id: "maneki", name: "招き", sec: 20, price: 35, blurb: "壊すと追加召喚" },
];

/** 同じ札をこの挑戦で買った回数。0 が初回。次は元値の半分を足す。別の札と次の挑戦には持たない。 */
export function itemPrice(base: number, bought: number): number {
  const n = Math.max(0, Math.floor(bought));
  return Math.ceil(base * (1 + 0.5 * n));
}

export const SUZU_MUL = 1.9;
export const SEIJAKU_MUL = 3;
export const SHIGURE_MUL = 1.7;

export function emptyItemT(): Record<ItemId, number> {
  return {
    senko: 0,
    shigure: 0,
    ware: 0,
    tanzaku: 0,
    kinpaku: 0,
    fubuki: 0,
    kaeshi: 0,
    suzu: 0,
    seijaku: 0,
    maneki: 0,
  };
}

export function temariThinAt(lv: number): number {
  return 0.82 ** Math.max(0, lv);
}

export function shopCost(id: ShopId, lv: number): number {
  if (id === "okiku") return 120 * 2 ** lv;
  if (id === "path") return 400 * 4 ** lv;
  if (id === "base") return 500 * 3 ** lv;
  if (id === "seed" || id === "back" || id === "arms") return 800 * 3 ** lv;
  if (id === "slow" || id === "thin") return 2000 * 3 ** lv;
  if (id === "auto") return SHOP_AUTO_COST;
  return 25 + lv * 20;
}

export function shopSpent(ids: ShopId[], shop: ShopUpgrades): number {
  let n = 0;
  for (const id of ids) {
    const lv = shop[id] ?? 0;
    for (let i = 0; i < lv; i++) n += shopCost(id, i);
  }
  return n;
}

export function shopT2Spent(shop: ShopUpgrades): number {
  return shopSpent(SHOP_T2_IDS, shop);
}

export function shopT3Spent(shop: ShopUpgrades): number {
  return shopSpent(SHOP_T3_IDS, shop);
}

export function shopT3Open(shop: ShopUpgrades): boolean {
  return (
    shop.okiku >= SHOP_T3_MIN_LV &&
    shop.path >= SHOP_T3_MIN_LV &&
    shop.base >= SHOP_T3_MIN_LV &&
    shopT2Spent(shop) >= SHOP_T3_SPEND
  );
}

export function shopT4Open(shop: ShopUpgrades): boolean {
  return (
    shop.seed >= SHOP_T4_MIN_LV &&
    shop.back >= SHOP_T4_MIN_LV &&
    shop.arms >= SHOP_T4_MIN_LV &&
    shopT3Spent(shop) >= SHOP_T4_SPEND
  );
}

export function shopValue(id: ShopId, lv: number): string {
  if (id === "atk") return `攻撃 ×${(1 + lv * 0.12).toFixed(2)}`;
  if (id === "spd") return `速度 ×${(1 + lv * 0.07).toFixed(2)}`;
  if (id === "coin") return `開始 ${START_COINS + lv * 15} 両`;
  if (id === "okiku") return `開始 お菊 ${1 + extraOkikuAt(lv)} 体`;
  if (id === "path") {
    return `武器 ${weaponAt(0, lv)}/${weaponAt(1, lv)}/${weaponAt(2, lv)}　道 ${routeProcessedAt(lv)}`;
  }
  if (id === "base") return `基礎攻撃 ${1 + lv}`;
  if (id === "seed") return `手毬1つ +${lv} 体`;
  if (id === "back") return `バック ${wrapBackAt(lv)} 皿`;
  if (id === "arms") return `武器 ${armCount(lv)} 本`;
  if (id === "slow") return `花魁 ${Math.round(oiranPaceAt(lv) * 100)}%`;
  if (id === "thin") return `手毬 HP ×${temariThinAt(lv).toFixed(2)}`;
  return lv > 0 ? "設定で切替" : "未解禁";
}

export function runBankGain(coins: number, wave: number): number {
  return Math.max(0, Math.floor(coins / 5) + wave * 6);
}

export const SHOP_ITEMS: Array<{ id: ShopId; name: string; desc: string }> = [
  { id: "atk", name: "基礎攻撃", desc: "次の挑戦の攻撃倍率の底" },
  { id: "spd", name: "攻撃速度", desc: "次の挑戦の振りの速さの底" },
  { id: "coin", name: "開始の両", desc: "次の挑戦の所持両" },
];

export const SHOP_T2_ITEMS: Array<{ id: ShopId; name: string; desc: string }> = [
  { id: "okiku", name: "二人目", desc: "開始時お菊が増える。買うほど一気に増える" },
  { id: "path", name: "道が近い", desc: "買うたび待ちがだいたい半分。値段は 400、1600、6400…" },
  { id: "base", name: "基礎攻撃力", desc: "式神の基礎攻撃 1 を上げる。値段は急に跳ねる" },
];

/** 金運の底は置かない。金皿の金運とは別。 */
export const SHOP_T3_ITEMS: Array<{ id: ShopId; name: string; desc: string }> = [
  { id: "seed", name: "口寄せの種", desc: "最初から、手毬1つにつき式神がもう出る" },
  { id: "back", name: "押し戻し", desc: "寿司を倒したときの花魁バックが増える" },
  { id: "arms", name: "輪刃", desc: "振り回す武器が増える。円に等間隔" },
];

/** 回収は置かない。 */
export const SHOP_T4_ITEMS: Array<{ id: ShopId; name: string; desc: string }> = [
  { id: "slow", name: "足枷", desc: "花魁の歩みが遅くなる" },
  { id: "thin", name: "薄皮", desc: "手毬の耐久が下がる。召喚しやすくなる" },
  { id: "auto", name: "自動重ね", desc: "同じレベルが3体そろうと重ねる。設定で切替。50万両" },
];

