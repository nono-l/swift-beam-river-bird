/*
  1フレームのルール。描画は draw.ts。
  手毬を dropCd で落とすな。召喚ボタンを戻すな。近接は先端だけ。
  金皿3択は mode=buff で Canvas に出す。React overlay だけにするとプレビューで欠ける。
*/
import {
  BALL_R,
  BELT_FILL,
  BELT_SLOTS,
  BELT_START,
  DANGER_TRACK,
  BOSS_X,
  BOSS_Y,
  CORE_HERO_IDS,
  HEROES,
  isGuest,
  GOLD_EARLY_EVERY,
  GOLD_FAST_KILLS,
  GOLD_LATE_NORMAL,
  HEX_DX,
  HEX_DY,
  NETA_RESERVE,
  NETA_SPAWN_CD,
  PIT_R,
  PIT_X,
  PIT_Y,
  RARITY_WEIGHT,
  START_COINS,
  shopMax,
  extraOkikuAt,
  weaponAt,
  routeProcessedAt,
  routeHpAt,
  wrapBackAt,
  armCount,
  oiranPaceAt,
  emptyItemT,
  guestCardMul,
  guestGrowthOf,
  SEIJAKU_MUL,
  SHIGURE_MUL,
  SUZU_MUL,
  runBankGain,
  SLOT_COUNT,
  STACK_BOTTOM,
  STACK_CAP,
  STACK_START,
  STARTER_SLOT,
  WEAPON_POOL,
  BUFF_POOL,
  WRAP_CAP,
  WRAP_ORB_R,
  beltPose,
  collabPose,
  COLLAB_CAP,
  COLLAB_CD,
  COLLAB_FILL,
  COLLAB_ORB_R,
  COLLAB_SPEED,
  bossHp,
  displayLevel,
  isMultiHit,
  makeWave,
  mulberry32,
  netaHpAt,
  NINE_T,
  routeFor,
  slotXY,
  summonCostAt,
  swingTip,
  swingTipR,
  temariHpAt,
} from "./data";
import type { Ball, Game, GuestStock, Hero, HeroId, ItemId, Mode, PlayStyle, Projectile, Role, ShopUpgrades, WeaponOption } from "./types";
import * as audio from "./audio";
import { pollVoice } from "./mic";
import { assignMeta, loadAutoMerge, loadDebugFlag, loadItemTap, loadMeta, loadPlayStyle, loadVoiceFlag, saveMeta, type MetaSave } from "./persist";
import { tickItems } from "./items";
import { applyBuff } from "./picks";

function nid(g: Game): number {
  g.nextId += 1;
  return g.nextId;
}

export function applyMeta(g: Game, meta: MetaSave) {
  assignMeta(g, meta);
  if (g.demo || g.mode === "title") applyShop(g);
}

export type DebugField =
  | "bank"
  | "shopAtk"
  | "shopSpd"
  | "shopCoin"
  | "coins"
  | "wave"
  | "processed"
  | "goldKills"
  | "bossHp"
  | "track"
  | "atkMul"
  | "spdMul"
  | "twin"
  | "shopOkiku"
  | "shopPath"
  | "shopBase"
  | "shopSeed"
  | "shopBack"
  | "shopArms"
  | "shopSlow"
  | "shopThin"
  | "shopAuto"
  | "marks"
  | "markBank"
  | "highWave";

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function debugNudge(g: Game, field: DebugField, dir: 1 | -1) {
  const s = dir;
  if (field === "bank") g.bank = Math.max(0, g.bank + s * 10);
  else if (field === "shopAtk") g.shop.atk = clamp(g.shop.atk + s, 0, shopMax("atk"));
  else if (field === "shopSpd") g.shop.spd = clamp(g.shop.spd + s, 0, shopMax("spd"));
  else if (field === "shopCoin") g.shop.coin = clamp(g.shop.coin + s, 0, shopMax("coin"));
  else if (field === "shopOkiku") g.shop.okiku = clamp(g.shop.okiku + s, 0, shopMax("okiku"));
  else if (field === "shopPath") g.shop.path = clamp(g.shop.path + s, 0, shopMax("path"));
  else if (field === "shopBase") g.shop.base = clamp(g.shop.base + s, 0, shopMax("base"));
  else if (field === "shopSeed") g.shop.seed = clamp(g.shop.seed + s, 0, shopMax("seed"));
  else if (field === "shopBack") g.shop.back = clamp(g.shop.back + s, 0, shopMax("back"));
  else if (field === "shopArms") g.shop.arms = clamp(g.shop.arms + s, 0, shopMax("arms"));
  else if (field === "shopSlow") g.shop.slow = clamp(g.shop.slow + s, 0, shopMax("slow"));
  else if (field === "shopThin") g.shop.thin = clamp(g.shop.thin + s, 0, shopMax("thin"));
  else if (field === "shopAuto") g.shop.auto = clamp(g.shop.auto + s, 0, shopMax("auto"));
  else if (field === "coins") g.coins = Math.max(0, g.coins + s * 10);
  else if (field === "wave") g.wave = Math.max(1, g.wave + s);
  else if (field === "processed") g.processed = Math.max(0, g.processed + s);
  else if (field === "goldKills") g.goldKills = Math.max(0, g.goldKills + s);
  else if (field === "bossHp") {
    g.boss.hp = Math.max(1, g.boss.hp + s * 100);
    g.boss.maxHp = Math.max(g.boss.maxHp, g.boss.hp);
  } else if (field === "track") g.boss.track = clamp(g.boss.track + s * 0.05, 0.02, 0.95);
  else if (field === "atkMul") g.atkMul = Math.max(0.1, Math.round((g.atkMul + s * 0.1) * 10) / 10);
  else if (field === "spdMul") g.spdMul = Math.max(0.1, Math.round((g.spdMul + s * 0.1) * 10) / 10);
  else if (field === "twin") g.twinSummon = Math.max(0, g.twinSummon + s);
  else if (field === "highWave") g.highWave = Math.max(0, g.highWave + s);
  else if (field === "marks") g.marks = Math.max(0, g.marks + s);
  else if (field === "markBank") g.markBank = Math.max(0, g.markBank + s * 5);
  if (field === "shopAtk" || field === "shopSpd" || field === "shopCoin" || field === "shopSeed") {
    if (g.demo || g.mode === "title") applyShop(g);
  }
  if (field === "bank" || field.startsWith("shop") || field === "highWave" || field === "markBank") saveMeta(g);
  recomputePower(g);
}

export function debugUnlockAll(g: Game) {
  g.unlocked = CORE_HERO_IDS.slice();
}

/** デバッグ。空マスへ指定レベル（内部1〜8、表示は奇数）で式神を置く。在庫は減らさない。 */
export function debugSummon(g: Game, id: HeroId, level: number): boolean {
  if (g.mode !== "playing" && g.mode !== "paused") return false;
  const slot = firstEmpty(g);
  if (slot < 0) return false;
  const lv = Math.max(1, Math.min(8, Math.floor(level) || 1));
  const hero = seedHero(g, id, slot);
  hero.level = lv;
  hero.stack = isGuest(id) ? 2 : 1;
  g.slots[slot] = hero;
  const p = slotXY(slot);
  burst(g, p.x, p.y, HEROES[id].color, 10, "puff");
  recomputePower(g);
  return true;
}

export function debugOpenWeapon(g: Game) {
  if (g.mode === "fail") return;
  openWeapon(g);
}

export function debugOpenRoute(g: Game) {
  if (g.mode === "fail") return;
  openRoute(g);
}

export function debugOpenBuff(g: Game) {
  if (g.mode === "fail") return;
  g.buffOptions = pickBuffs(g);
  g.mode = "buff";
}

export function applyShop(g: Game) {
  g.atkMul = 1 + g.shop.atk * 0.12;
  g.spdMul = 1 + g.shop.spd * 0.07;
  g.coins = START_COINS + g.shop.coin * 15;
  g.twinSummon = g.shop.seed;
}

function awardBank(g: Game) {
  if (g.demo || g.lastEarned > 0) return;
  const gain = runBankGain(g.coins, g.wave);
  g.lastEarned = gain;
  g.bank += gain;
  if (g.marks > 0) {
    g.lastMarks = g.marks;
    g.markBank += g.marks;
  }
  saveMeta(g);
}

export function makeBall(g: Game, spec: { hp: number; pattern: number }, kind: Ball["kind"] = "stack"): Ball {
  const b: Ball = {
    id: nid(g),
    hp: spec.hp,
    maxHp: spec.hp,
    pattern: spec.pattern,
    x: PIT_X,
    y: STACK_BOTTOM - 5 * HEX_DY - 30,
    vx: 0,
    vy: 0,
    kind,
    wrapIndex: 0,
    bob: g.rng() * Math.PI * 2,
    gold: false,
    laneT: 0,
  };
  if (kind === "wrap") stampGoldNeta(g, b);
  return b;
}

function stampGoldNeta(g: Game, b: Ball) {
  g.netaCount += 1;
  // 4 個壊すまでは 4 皿に 1 金。多いとパワーアップが簡単すぎるので、その後はノーマル 10 に金 1。
  if (g.goldKills < GOLD_FAST_KILLS) {
    b.gold = g.netaCount % GOLD_EARLY_EVERY === 0;
    return;
  }
  g.netaSinceGold += 1;
  if (g.netaSinceGold > GOLD_LATE_NORMAL) {
    b.gold = true;
    g.netaSinceGold = 0;
  } else {
    b.gold = false;
  }
}

function spawnBeltNeta(g: Game): boolean {
  if (g.netaReserve <= 0) return false;
  if (g.wrap.length >= WRAP_CAP - 1) return false;
  g.netaReserve -= 1;
  const n = g.netaCount + 1;
  const b = makeBall(g, { hp: netaHpAt(g.goldKills), pattern: n % 5 }, "wrap");
  const p = beltPose(Math.min(0.98, g.boss.track + (g.wrap.length + 1) / BELT_SLOTS));
  b.x = p.x;
  b.y = p.y;
  g.wrap.push(b);
  reindexWrap(g);
  return true;
}

function refillBelt(g: Game, dt: number) {
  g.netaCd -= dt;
  let n = 0;
  while (g.wrap.length < BELT_FILL && g.netaReserve > 0 && n < 3) {
    spawnBeltNeta(g);
    n += 1;
  }
  if (g.netaCd <= 0 && g.wrap.length < WRAP_CAP - 1 && g.netaReserve > 0) {
    spawnBeltNeta(g);
    g.netaCd = NETA_SPAWN_CD;
  }
}

function emptySlots(): Array<Hero | null> {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

export function seedHero(g: Game, defId: HeroId, slot: number, buffMul = 1): Hero {
  const swing = g.rng() * Math.PI * 2;
  return {
    id: nid(g),
    defId,
    level: 1,
    stack: 1,
    slot,
    atkCd: 0.2,
    facing: 1,
    attackT: 0,
    swing,
    prevSwing: swing,
    cleaveIds: [],
    targetX: BOSS_X,
    targetY: BOSS_Y,
    buffMul,
    rank: 0,
    reachMul: isGuest(defId) ? guestCardMul("reach", guestGrowthOf(g.guestGrowth, defId).reach) : 1,
  };
}

function heroAtk(g: Game, h: Hero): number {
  const d = HEROES[h.defId];
  let atk = (d.atk + g.shop.base) * displayLevel(h.level) * g.atkMul * h.buffMul * g.screamMul;
  if (isGuest(h.defId)) atk *= guestCardMul("blade", guestGrowthOf(g.guestGrowth, h.defId).blade);
  if ((g.itemT.seijaku ?? 0) > 0) atk *= SEIJAKU_MUL;
  return atk;
}

function liveSpd(g: Game) {
  let spd = g.spdMul * g.screamMul;
  if ((g.itemT.shigure ?? 0) > 0) spd *= SHIGURE_MUL;
  if ((g.itemT.seijaku ?? 0) > 0) spd *= SEIJAKU_MUL;
  return spd;
}

function tipR(g: Game, h: Hero): number {
  const r = swingTipR(h);
  return (g.itemT.suzu ?? 0) > 0 ? r * SUZU_MUL : r;
}

export function createGame(opts?: { demo?: boolean; muted?: boolean; debug?: boolean; playStyle?: PlayStyle; autoMerge?: boolean; voiceOn?: boolean }): Game {
  const rng = mulberry32((Math.random() * 0xffffffff) | 0);
  const meta = loadMeta();
  const g: Game = {
    mode: "title",
    lesson: null,
    dangerTold: false,
    demo: !!opts?.demo,
    t: 0,
    wave: 1,
    coins: START_COINS,
    summonCost: 10,
    summonCount: 0,
    combatPower: 0,
    slots: emptySlots(),
    stack: [],
    falling: [],
    wrap: [],
    collab: [],
    boss: { hp: bossHp(1), maxHp: bossHp(1), hitFlash: 0, x: BOSS_X, y: BOSS_Y, track: BELT_START, spin: 0 },
    projectiles: [],
    particles: [],
    floats: [],
    selectedSlot: null,
    drag: null,
    moveSeq: 0,
    shake: 0,
    hitstop: 0,
    spawnQueue: makeWave(1, rng, 0, meta.shop.thin),
    dropCd: 0,
    muted: opts?.muted ?? false,
    debug: opts?.debug ?? loadDebugFlag(),
    playStyle: opts?.playStyle ?? loadPlayStyle(),
    autoMerge: opts?.autoMerge ?? loadAutoMerge(),
    voiceOn: opts?.voiceOn ?? loadVoiceFlag(),
    screamMul: 1,
    unlocked: ["okiku"],
    atkMul: 1,
    spdMul: 1,
    goldMul: 1,
    twinSummon: 0,
    rng,
    nextId: 1,
    highWave: meta.highWave,
    bank: meta.bank,
    markBank: meta.markBank,
    marks: 0,
    lastMarks: 0,
    guestStock: meta.guestStock,
    guestLeft: { ...meta.guestStock },
    guestGrowth: meta.guestGrowth,
    guestPick: null,
    guestListOpen: false,
    itemListOpen: false,
    itemTap: loadItemTap(),
    assist: false,
    itemT: emptyItemT(),
    itemBuys: emptyItemT(),
    shop: meta.shop,
    lastEarned: 0,
    weaponOptions: [],
    buffOptions: [],
    routeOptions: [],
    flashBanner: null,
    flashT: 0,
    justMerged: 0,
    processed: 0,
    weaponCount: 0,
    routeCount: 0,
    netaCount: 0,
    goldKills: 0,
    netaSinceGold: 0,
    netaCd: 0,
    netaReserve: NETA_RESERVE,
    collabCd: 0,
  };
  g.slots[STARTER_SLOT] = seedHero(g, "okiku", STARTER_SLOT);
  const extra = extraOkikuAt(g.shop.okiku);
  for (let i = 0; i < extra; i++) {
    const slot = firstEmpty(g);
    if (slot < 0) break;
    g.slots[slot] = seedHero(g, "okiku", slot);
  }
  for (let i = 0; i < BELT_FILL; i++) spawnBeltNeta(g);
  layoutBelt(g, true);
  for (let i = 0; i < COLLAB_FILL; i++) spawnCollab(g, i * 0.18);
  layoutCollab(g, true);
  refillStack(g, STACK_START);
  layoutStack(g, true);
  applyShop(g);
  recomputePower(g);
  return g;
}

export function resetRun(g: Game, demo = false) {
  const high = g.highWave;
  const muted = g.muted;
  const debug = g.debug;
  const playStyle = g.playStyle;
  const autoMerge = g.autoMerge;
  const voiceOn = g.voiceOn;
  const bank = g.bank;
  const markBank = g.markBank;
  const guestStock = { ...g.guestStock };
  const guestGrowth = g.guestGrowth;
  const shop = { ...g.shop };
  const lastEarned = g.lastEarned;
  const lastMarks = g.lastMarks;
  const fresh = createGame({ demo, muted, debug, playStyle, autoMerge, voiceOn });
  Object.assign(g, fresh);
  g.highWave = high;
  g.debug = debug;
  g.playStyle = playStyle;
  g.autoMerge = autoMerge;
  g.voiceOn = voiceOn;
  g.bank = bank;
  g.markBank = markBank;
  g.guestStock = guestStock;
  g.guestLeft = { ...guestStock };
  g.guestGrowth = guestGrowth;
  g.guestPick = null;
  g.shop = shop;
  g.lastEarned = demo ? lastEarned : 0;
  g.lastMarks = demo ? lastMarks : 0;
  applyShop(g);
  g.mode = demo ? "title" : "playing";
  g.demo = demo;
}

function refillStack(g: Game, cap = STACK_CAP) {
  while (g.stack.length < cap && g.spawnQueue.length) {
    const spec = g.spawnQueue.shift()!;
    const live = temariHpAt(g.summonCount, g.rng, g.wave, g.shop.thin);
    const hp = Math.max(spec.hp, live);
    g.stack.push(makeBall(g, { hp, pattern: spec.pattern }));
  }
}

function layoutStack(g: Game, snap = false) {
  const counts = [1, 2, 3, 4, 5];
  let i = 0;
  for (let r = 0; r < counts.length; r++) {
    const n = counts[r]!;
    const y = STACK_BOTTOM - r * HEX_DY;
    for (let j = 0; j < n; j++) {
      if (i >= g.stack.length) return;
      const b = g.stack[i]!;
      const tx = PIT_X + (j - (n - 1) / 2) * HEX_DX;
      if (snap) {
        b.x = tx;
        b.y = y;
      } else {
        b.x += (tx - b.x) * 0.22;
        b.y += (y - b.y) * 0.22;
      }
      i++;
    }
  }
}

export function recomputePower(g: Game) {
  let p = 0;
  for (const h of g.slots) {
    if (!h) continue;
    const d = HEROES[h.defId];
    const atk = heroAtk(g, h);
    const iv = d.interval / liveSpd(g);
    p += (atk / iv) * 10;
  }
  g.combatPower = Math.round(p);
}

export function burst(g: Game, x: number, y: number, color: string, n = 8, kind: "spark" | "puff" = "spark") {
  for (let i = 0; i < n; i++) {
    const a = g.rng() * Math.PI * 2;
    const s = 40 + g.rng() * 90;
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 20,
      life: 0.28 + g.rng() * 0.25,
      maxLife: 0.45,
      r: kind === "puff" ? 6 + g.rng() * 6 : 2 + g.rng() * 3,
      color,
      kind,
    });
  }
}

function slashFx(g: Game, x: number, y: number) {
  g.particles.push({
    x,
    y,
    vx: (g.rng() - 0.5) * 20,
    vy: (g.rng() - 0.5) * 20,
    life: 0.16,
    maxLife: 0.16,
    r: 16 + g.rng() * 8,
    color: "#fff4d0",
    kind: "slash",
  });
}

export function float(g: Game, x: number, y: number, text: string, color = "#fff4e0", scale = 1) {
  g.floats.push({
    x: x + (g.rng() - 0.5) * 10,
    y,
    vy: scale > 1.4 ? -22 : -38,
    text,
    life: scale > 1.4 ? 0.9 : 0.7,
    color,
    scale,
  });
}

function noteProcessed(g: Game, kind: Ball["kind"]) {
  if (kind === "wrap" || kind === "collab") return;
  g.processed += 1;
}

function popBall(g: Game, b: Ball) {
  burst(g, b.x, b.y, b.kind === "collab" ? "#c8a0e8" : "#f0d9a0", 12, "puff");
  if (b.kind === "collab") {
    g.marks += 1;
    float(g, b.x, b.y - 8, "+華", "#d4b4f0");
    if (!g.demo) audio.sfxPop();
    return;
  }
  const gold = Math.max(1, Math.round((1 + b.maxHp * 0.18) * g.goldMul * ((g.itemT.kinpaku ?? 0) > 0 ? 2 : 1)));
  g.coins += gold;
  float(g, b.x, b.y - 8, `+${gold}`, "#e8c15a");
  noteProcessed(g, b.kind);
  if (b.kind === "wrap") {
    let back = wrapBackAt(g.shop.back);
    if ((g.itemT.kaeshi ?? 0) > 0) back *= 2;
    g.boss.track = Math.min(0.9, g.boss.track + back / BELT_SLOTS);
    float(g, g.boss.x, g.boss.y - 36, "バック", "#9ad8e8");
    if ((g.itemT.fubuki ?? 0) > 0) {
      g.marks += 1;
      float(g, b.x, b.y - 26, "+華", "#d4b4f0");
    }
    if (b.gold) {
      g.goldKills += 1;
      if (g.goldKills === GOLD_FAST_KILLS) g.netaSinceGold = 0;
      onGoldPlate(g, b);
    }
  }
  if (!g.demo) audio.sfxPop();
  if (b.kind === "stack" || b.kind === "fall") {
    trySummon(g, { free: true });
    if ((g.itemT.maneki ?? 0) > 0) trySummon(g, { free: true });
    if (g.lesson === "break") {
      g.lesson = "merge";
      ensureOkikuPair(g);
    }
  }
}

function pickBuffs(g: Game): WeaponOption[] {
  // 花魁バックは 9 時よりゴール側にいないと意味が薄い。序盤は出さない。
  const pool = BUFF_POOL.filter((o) => o.id !== "back" || g.boss.track <= NINE_T);
  const out: WeaponOption[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = (g.rng() * pool.length) | 0;
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

function onGoldPlate(g: Game, b: Ball) {
  // HTML の3択だけにするとプレビューで欠ける。mode が buff のあいだは進まない。
  g.shake = Math.min(1, g.shake + 0.28);
  burst(g, b.x, b.y, "#ffe28a", 16, "puff");
  float(g, b.x, b.y - 22, "金皿", "#ffe28a", 1.45);
  if (!g.demo) audio.sfxSelect();
  if (g.lesson) return;
  const picks = pickBuffs(g);
  if (g.demo) {
    applyBuff(g, picks[0]!.id);
    return;
  }
  g.buffOptions = picks;
  g.mode = "buff";
  g.flashBanner = "パワーアップ";
  g.flashT = 1.2;
}

function applyBallDmg(g: Game, b: Ball, dmg: number) {
  hurtBall(g, b, dmg);
}

function applyBossDmg(g: Game, dmg: number) {
  hurtBoss(g, dmg);
}

type HitResult = { applied: number; hp: number; dead: boolean };

function rollStrike(g: Game, h: Hero): number {
  return Math.max(1, Math.round(heroAtk(g, h) * (0.88 + g.rng() * 0.24)));
}

function resolveHit(hp: number, amount: number): HitResult {
  const applied = Math.max(0, amount);
  const next = Math.max(0, hp - applied);
  return { applied, hp: next, dead: next <= 0 };
}

/** 戦闘の HP 減算は hurtBall と hurtBoss だけ。振りや弾から hp -= するな。 */
export function hurtBall(g: Game, b: Ball, amount: number): HitResult | null {
  if (b.hp <= 0) return null;
  const hit = resolveHit(b.hp, amount);
  b.hp = hit.hp;
  float(g, b.x, b.y, `${Math.round(hit.applied)}`, "#fff8ee");
  burst(g, b.x, b.y, "#fff", 4);
  if (hit.dead) popBall(g, b);
  return hit;
}

function hurtBoss(g: Game, amount: number): HitResult | null {
  if (g.boss.hp <= 0) return null;
  const hit = resolveHit(g.boss.hp, amount);
  g.boss.hp = hit.hp;
  g.boss.hitFlash = 0.12;
  g.shake = Math.min(1, g.shake + 0.18);
  g.hitstop = Math.max(g.hitstop, 0.04);
  if (hit.applied >= 22) {
    float(g, g.boss.x + 4, g.boss.y - 52, "BOOM!", "#ffe28a", 2.1);
    burst(g, g.boss.x, g.boss.y - 8, "#ffe28a", 16, "puff");
    slashFx(g, g.boss.x, g.boss.y - 12);
  } else {
    float(g, g.boss.x, g.boss.y - 28, `${Math.round(hit.applied)}`, "#ffe8a0");
    burst(g, g.boss.x, g.boss.y - 10, "#e8c15a", 6);
  }
  if (!g.demo) audio.sfxHit();
  if (hit.dead) onBossDown(g);
  return hit;
}

function onBossDown(g: Game) {
  burst(g, g.boss.x, g.boss.y, "#e8c15a", 22, "puff");
  g.shake = 1;
  g.coins += Math.round(12 * g.wave * g.goldMul);
  if (!g.demo) audio.sfxBoss();
  if (!g.demo) {
    g.mode = "clear";
    return;
  }
  advanceWave(g);
}

function advanceWave(g: Game) {
  g.wave += 1;
  saveMeta(g);
  g.boss = {
    hp: bossHp(g.wave),
    maxHp: bossHp(g.wave),
    hitFlash: 0,
    x: g.boss.x,
    y: g.boss.y,
    track: Math.min(0.85, g.boss.track + 0.14),
    spin: g.boss.spin,
  };
  g.spawnQueue.push(...makeWave(g.wave, g.rng, g.summonCount, g.shop.thin));
  g.netaReserve += NETA_RESERVE;
  refillStack(g, g.processed >= 4 ? STACK_CAP : STACK_START);
  if (g.demo) return;
  g.mode = "playing";
  if (g.routeCount === 0) openRoute(g);
}

export function continueClear(g: Game) {
  if (g.mode !== "clear") return;
  advanceWave(g);
}

export function cashOutRun(g: Game) {
  if (g.mode !== "clear" || g.demo || g.lastEarned > 0) return;
  const gain = Math.max(0, Math.floor(g.coins));
  g.lastEarned = gain;
  g.bank += gain;
  if (g.marks > 0) {
    g.lastMarks = g.marks;
    g.markBank += g.marks;
  }
  saveMeta(g);
}

function convertToWrap(g: Game, b: Ball) {
  const idx = g.falling.indexOf(b);
  if (idx >= 0) g.falling.splice(idx, 1);
  if (b.hp <= 0) return;
  b.kind = "wrap";
  b.vy = 0;
  stampGoldNeta(g, b);
  const hp = netaHpAt(g.goldKills);
  b.hp = hp;
  b.maxHp = hp;
  g.wrap.push(b);
  g.processed += 1;
  reindexWrap(g);
  if (g.wrap.length >= WRAP_CAP) {
    g.boss.track -= 1 / BELT_SLOTS;
  }
}

function failIfGoal(g: Game) {
  if (g.boss.track > 0) return;
  g.boss.track = 0;
  if (g.demo) {
    resetRun(g, true);
    return;
  }
  if (g.mode === "fail") return;
  g.mode = "fail";
  awardBank(g);
  saveMeta(g);
  audio.sfxFail();
}

function layoutBelt(g: Game, snap = false, dt = 1 / 60) {
  const pose = beltPose(g.boss.track);
  const k = snap ? 1 : Math.min(1, 10 * dt);
  g.boss.x += (pose.x - g.boss.x) * k;
  g.boss.y += (pose.y - g.boss.y) * k;
  g.boss.spin = pose.a;
  for (let i = 0; i < g.wrap.length; i++) {
    const b = g.wrap[i]!;
    const p = beltPose(g.boss.track + (i + 1) / BELT_SLOTS);
    const bk = snap ? 1 : Math.min(1, 8 * dt);
    b.x += (p.x - b.x) * bk;
    b.y += (p.y - b.y) * bk;
    b.wrapIndex = i;
    b.bob += dt * 4;
  }
}

export function reindexWrap(g: Game) {
  for (let i = 0; i < g.wrap.length; i++) {
    g.wrap[i]!.wrapIndex = i;
  }
}

function spawnCollab(g: Game, t = 0): boolean {
  if (g.collab.length >= COLLAB_CAP) return false;
  if (g.collab.some((b) => Math.abs(b.laneT - t) < 0.14)) return false;
  const b = makeBall(g, { hp: 1, pattern: (g.marks + g.collab.length) % 5 }, "collab");
  b.laneT = t;
  const p = collabPose(t);
  b.x = p.x;
  b.y = p.y;
  g.collab.push(b);
  return true;
}

function refillCollab(g: Game, dt: number) {
  g.collabCd -= dt;
  if (g.collab.length < COLLAB_FILL && g.collabCd <= 0) {
    if (spawnCollab(g, 0)) g.collabCd = COLLAB_CD;
  }
}

function layoutCollab(g: Game, snap = false, dt = 1 / 60) {
  for (let i = g.collab.length - 1; i >= 0; i--) {
    const b = g.collab[i]!;
    if (b.hp <= 0) continue;
    b.laneT += COLLAB_SPEED * dt;
    if (b.laneT >= 1) {
      g.collab.splice(i, 1);
      continue;
    }
    const p = collabPose(b.laneT);
    const k = snap ? 1 : Math.min(1, 10 * dt);
    b.x += (p.x - b.x) * k;
    b.y += (p.y - b.y) * k;
    b.bob += dt * 5;
  }
}

type Target = { kind: "ball"; ball: Ball } | { kind: "boss" };

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function nearestBall(hx: number, hy: number, range2: number, balls: Ball[]): Ball | null {
  let best: Ball | null = null;
  let bestD = 1e12;
  for (const b of balls) {
    if (b.hp <= 0) continue;
    const d = dist2(hx, hy, b.x, b.y);
    if (d <= range2 && d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function inReach(hx: number, hy: number, tx: number, ty: number, range: number, extra: number) {
  const r = range + extra;
  return dist2(hx, hy, tx, ty) <= r * r;
}

function inPit(hx: number, hy: number) {
  return dist2(hx, hy, PIT_X, PIT_Y) <= (PIT_R - 4) * (PIT_R - 4);
}

function heroRange(h: Hero): number {
  return HEROES[h.defId].range + (h.level - 1) * 3;
}

function tipHits(tip: { x: number; y: number }, r: number, x: number, y: number, extra: number) {
  const rr = r + extra;
  return dist2(tip.x, tip.y, x, y) <= rr * rr;
}

function meleeTipTouching(g: Game, h: Hero, pos: { x: number; y: number }): boolean {
  const r = tipR(g, h);
  const n = armCount(g.shop.arms);
  for (let i = 0; i < n; i++) {
    const tip = swingTip(h, pos.x, pos.y, i, n);
    for (const b of g.falling) {
      if (b.hp > 0 && tipHits(tip, r, b.x, b.y, BALL_R)) return true;
    }
    if (g.stack.length) {
      const m = g.stack[0]!;
      if (m.hp > 0 && tipHits(tip, r, m.x, m.y, BALL_R)) return true;
    }
    for (const b of g.wrap) {
      if (b.hp > 0 && tipHits(tip, r, b.x, b.y, WRAP_ORB_R)) return true;
    }
    for (const b of g.collab) {
      if (b.hp > 0 && tipHits(tip, r, b.x, b.y, COLLAB_ORB_R)) return true;
    }
    if (tipHits(tip, r, g.boss.x, g.boss.y - 10, 26)) return true;
  }
  return false;
}

function pickTarget(g: Game, hx: number, hy: number, range: number, role: Role, buffMul: number): Target | null {
  const falling = nearestBall(hx, hy, (range + BALL_R) * (range + BALL_R), g.falling);
  if (falling) return { kind: "ball", ball: falling };

  if (g.stack.length) {
    const mouth = g.stack[0]!;
    if (mouth.hp > 0 && inPit(hx, hy)) {
      return { kind: "ball", ball: mouth };
    }
  }

  const bossIn = inReach(hx, hy, g.boss.x, g.boss.y - 20, range, 34);

  if (role === "melee") {
    if (buffMul >= 4 && bossIn) return { kind: "boss" };
    const wrap = nearestBall(hx, hy, (range + WRAP_ORB_R) * (range + WRAP_ORB_R), g.wrap);
    if (wrap) return { kind: "ball", ball: wrap };
    const collab = nearestBall(hx, hy, (range + COLLAB_ORB_R) * (range + COLLAB_ORB_R), g.collab);
    if (collab) return { kind: "ball", ball: collab };
    if (bossIn) return { kind: "boss" };
    return null;
  }

  if (bossIn) return { kind: "boss" };
  const wrap = nearestBall(hx, hy, (range + WRAP_ORB_R) * (range + WRAP_ORB_R), g.wrap);
  if (wrap) return { kind: "ball", ball: wrap };
  const collab = nearestBall(hx, hy, (range + COLLAB_ORB_R) * (range + COLLAB_ORB_R), g.collab);
  if (collab) return { kind: "ball", ball: collab };
  return null;
}

function meleeSweep(g: Game, h: Hero, pos: { x: number; y: number }) {
  // 体の周囲円・inPit 全当てを戻すな。当たるのは今の振りの先端だけ。
  // 表示10までは重なったうち最近傍の1体。11以上は cleaveSweep。
  const amount = rollStrike(g, h);
  h.attackT = 1;
  const r = tipR(g, h);
  const n = armCount(g.shop.arms);
  const first = swingTip(h, pos.x, pos.y, 0, n);
  h.targetX = first.x;
  h.targetY = first.y;

  type Hit = { kind: "ball"; b: Ball } | { kind: "boss" };
  let hitBoss = false;
  let hitBall = false;

  const sweepTip = (tip: { x: number; y: number }) => {
    const overlapped: Hit[] = [];
    const consider = (b: Ball, extra: number) => {
      if (b.hp <= 0) return;
      if (tipHits(tip, r, b.x, b.y, extra)) overlapped.push({ kind: "ball", b });
    };
    for (const b of g.falling) consider(b, BALL_R);
    if (g.stack.length) consider(g.stack[0]!, BALL_R);
    for (const b of g.wrap) consider(b, WRAP_ORB_R);
    for (const b of g.collab) consider(b, COLLAB_ORB_R);
    if (tipHits(tip, r, g.boss.x, g.boss.y - 10, 26)) overlapped.push({ kind: "boss" });

    if (overlapped.length) {
      let best = overlapped[0]!;
      let bestD = Infinity;
      for (const hit of overlapped) {
        const x = hit.kind === "boss" ? g.boss.x : hit.b.x;
        const y = hit.kind === "boss" ? g.boss.y - 10 : hit.b.y;
        const d = dist2(tip.x, tip.y, x, y);
        if (d < bestD) {
          bestD = d;
          best = hit;
        }
      }
      if (best.kind === "boss") {
        if (hurtBoss(g, amount)) hitBoss = true;
      } else if (hurtBall(g, best.b, amount)) {
        hitBall = true;
      }
    }
    slashFx(g, tip.x, tip.y);
  };

  for (let i = 0; i < n; i++) sweepTip(swingTip(h, pos.x, pos.y, i, n));

  pruneDead(g);
  if (!hitBoss && hitBall && !g.demo) audio.sfxHit();
}

function arcTouches(
  g: Game,
  h: Hero,
  pos: { x: number; y: number },
  arm: number,
  arms: number,
  x: number,
  y: number,
  extra: number,
): boolean {
  const r = tipR(g, h);
  let d = h.swing - h.prevSwing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const steps = Math.max(2, Math.ceil(Math.abs(d) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const a = h.prevSwing + (d * i) / steps;
    const tip = swingTip({ ...h, swing: a }, pos.x, pos.y, arm, arms);
    if (tipHits(tip, r, x, y, extra)) return true;
  }
  return false;
}

function cleaveSweep(g: Game, h: Hero, pos: { x: number; y: number }) {
  // 表示11以上。弾は出さない。先端が通った寿司はすべて削る。1回の通過で1回。
  const n = armCount(g.shop.arms);
  let amount: number | null = null;
  const now: number[] = [];
  let struck = false;
  const pass = (id: number, hit: () => boolean) => {
    if (now.includes(id)) return;
    now.push(id);
    if (h.cleaveIds.includes(id)) return;
    if (amount == null) amount = rollStrike(g, h);
    if (hit()) struck = true;
  };

  for (let i = 0; i < n; i++) {
    for (const b of g.wrap) {
      if (b.hp <= 0) continue;
      if (!arcTouches(g, h, pos, i, n, b.x, b.y, WRAP_ORB_R)) continue;
      pass(b.id, () => !!hurtBall(g, b, amount!));
    }
    for (const b of g.collab) {
      if (b.hp <= 0) continue;
      if (!arcTouches(g, h, pos, i, n, b.x, b.y, COLLAB_ORB_R)) continue;
      pass(b.id, () => !!hurtBall(g, b, amount!));
    }
    for (const b of g.falling) {
      if (b.hp <= 0) continue;
      if (!arcTouches(g, h, pos, i, n, b.x, b.y, BALL_R)) continue;
      pass(b.id, () => !!hurtBall(g, b, amount!));
    }
    if (g.stack.length) {
      const m = g.stack[0]!;
      if (m.hp > 0 && arcTouches(g, h, pos, i, n, m.x, m.y, BALL_R)) {
        pass(m.id, () => !!hurtBall(g, m, amount!));
      }
    }
    if (arcTouches(g, h, pos, i, n, g.boss.x, g.boss.y - 10, 26)) {
      pass(-1, () => !!hurtBoss(g, amount!));
    }
  }

  const first = swingTip(h, pos.x, pos.y, 0, n);
  h.targetX = first.x;
  h.targetY = first.y;
  if (struck) {
    h.attackT = 1;
    slashFx(g, first.x, first.y);
    if (!g.demo) audio.sfxHit();
  }
  h.cleaveIds = now;
  pruneDead(g);
}

function fireRanged(g: Game, h: Hero, target: Target) {
  const def = HEROES[h.defId];
  const pos = slotXY(h.slot);
  const amount = rollStrike(g, h);
  h.attackT = 1;
  const tx = target.kind === "boss" ? g.boss.x : target.ball.x;
  const ty = target.kind === "boss" ? g.boss.y - 18 : target.ball.y;
  h.targetX = tx;
  h.targetY = ty;
  h.facing = tx < pos.x ? -1 : 1;
  const ang = Math.atan2(ty - pos.y, tx - pos.x);
  h.swing = ang;

  const n = armCount(g.shop.arms);
  const spd = 380;
  const kind = target.kind === "boss" ? "boss" : target.ball.kind === "wrap" ? "wrap" : "ball";
  const targetId = target.kind === "boss" ? -1 : target.ball.id;
  for (let i = 0; i < n; i++) {
    const tip = swingTip(h, pos.x, pos.y, i, n);
    const a = Math.atan2(ty - tip.y, tx - tip.x);
    g.projectiles.push({
      id: nid(g),
      x: tip.x,
      y: tip.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      dmg: amount,
      life: 0.55,
      color: def.projectile,
      homing: true,
      tx,
      ty,
      target: kind,
      targetId,
      multi: false,
    });
  }
}

function findBall(g: Game, id: number): Ball | null {
  for (const b of g.falling) if (b.id === id) return b;
  for (const b of g.wrap) if (b.id === id) return b;
  for (const b of g.collab) if (b.id === id) return b;
  for (const b of g.stack) if (b.id === id) return b;
  return null;
}

function pruneDead(g: Game) {
  const keep = (b: Ball) => b.hp > 0;
  if (g.stack.some((b) => b.hp <= 0)) {
    g.stack = g.stack.filter(keep);
    const cap = g.processed >= 4 ? STACK_CAP : STACK_START;
    refillStack(g, cap);
  }
  g.falling = g.falling.filter(keep);
  const wlen = g.wrap.length;
  g.wrap = g.wrap.filter(keep);
  if (g.wrap.length !== wlen) reindexWrap(g);
  g.collab = g.collab.filter(keep);
}

function stepProjectiles(g: Game, dt: number) {
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const p = g.projectiles[i]!;
    p.life -= dt;
    if (p.homing) {
      if (p.target === "boss") {
        p.tx = g.boss.x;
        p.ty = g.boss.y - 18;
      } else {
        const b = findBall(g, p.targetId);
        if (b && b.hp > 0) {
          p.tx = b.x;
          p.ty = b.y;
        }
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 400;
      p.vx = p.vx * 0.55 + (dx / len) * spd * 0.45;
      p.vy = p.vy * 0.55 + (dy / len) * spd * 0.45;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const hitR = p.target === "boss" ? 36 : 18;
    if (Math.hypot(p.x - p.tx, p.y - p.ty) < hitR || p.life <= 0) {
      if (p.multi) {
        const rBall = 18;
        const ballHit = (b: Ball, extra: number) =>
          b.hp > 0 && dist2(p.x, p.y, b.x, b.y) <= (rBall + extra) * (rBall + extra);
        for (const b of g.falling) if (ballHit(b, BALL_R)) applyBallDmg(g, b, p.dmg);
        for (const b of g.stack) if (ballHit(b, BALL_R)) applyBallDmg(g, b, p.dmg);
        for (const b of g.wrap) if (ballHit(b, WRAP_ORB_R)) applyBallDmg(g, b, p.dmg);
        for (const b of g.collab) if (ballHit(b, COLLAB_ORB_R)) applyBallDmg(g, b, p.dmg);
        if (dist2(p.x, p.y, g.boss.x, g.boss.y - 18) <= 36 * 36) applyBossDmg(g, p.dmg);
      } else if (p.target === "boss") applyBossDmg(g, p.dmg);
      else {
        const b = findBall(g, p.targetId);
        if (b && b.hp > 0) applyBallDmg(g, b, p.dmg);
      }
      burst(g, p.x, p.y, p.color, 5);
      g.projectiles.splice(i, 1);
    }
  }
  pruneDead(g);
}

function stepHeroes(g: Game, dt: number) {
  for (const h of g.slots) {
    if (!h) continue;
    const step = isGuest(h.defId) ? guestCardMul("step", guestGrowthOf(g.guestGrowth, h.defId).step) : 1;
    h.prevSwing = h.swing;
    h.swing += (1.55 + h.attackT * 3.8) * liveSpd(g) * step * dt;
    h.attackT = Math.max(0, h.attackT - dt * (1.7 + liveSpd(g) * 1.1));
    const pos = slotXY(h.slot);
    if (isMultiHit(h.level)) {
      cleaveSweep(g, h, pos);
      continue;
    }
    h.atkCd -= dt;
    if (h.atkCd > 0) continue;
    const def = HEROES[h.defId];
    const range = heroRange(h);
    if (def.role === "melee") {
      if (!meleeTipTouching(g, h, pos)) continue;
      h.atkCd = def.interval / (liveSpd(g) * step);
      meleeSweep(g, h, pos);
    } else {
      const t = pickTarget(g, pos.x, pos.y, range, def.role, h.buffMul);
      if (!t) continue;
      h.atkCd = def.interval / (liveSpd(g) * step);
      fireRanged(g, h, t);
    }
  }
}

export function firstEmpty(g: Game): number {
  return g.slots.findIndex((s) => !s);
}

export function firstEmptyNearBoss(g: Game): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (g.slots[i]) continue;
    const p = slotXY(i);
    const d = Math.hypot(p.x - g.boss.x, p.y - g.boss.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function rollSummon(g: Game): HeroId {
  const pool = g.unlocked.map((id) => HEROES[id]).filter(Boolean);
  let total = 0;
  const weights = pool.map((d) => {
    const w = RARITY_WEIGHT[d.rarity] ?? 10;
    total += w;
    return w;
  });
  let r = g.rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!.id;
  }
  return pool[0]!.id;
}

/** 召喚ボタンは無い。free は手毬を壊したときだけ。両を払って出す UI を戻すな。 */
export function trySummon(g: Game, opts?: { free?: boolean }): boolean {
  if (g.mode !== "playing" && !g.demo) return false;
  const slot = firstEmpty(g);
  if (slot < 0) return false;
  const free = !!opts?.free;
  if (!free) {
    if (g.coins < g.summonCost) return false;
    g.coins -= g.summonCost;
  }
  g.summonCount += 1;
  g.summonCost = summonCostAt(g.summonCount);
  const id = g.lesson === "break" ? "okiku" : rollSummon(g);
  g.slots[slot] = seedHero(g, id, slot);
  const p = slotXY(slot);
  burst(g, p.x, p.y, "#e8c15a", 10, "puff");
  if (free) float(g, p.x, p.y - 26, "召喚", "#e8c15a");
  if (free && g.twinSummon > 0) {
    for (let i = 0; i < g.twinSummon; i++) {
      const extra = firstEmpty(g);
      if (extra < 0) break;
      const id2 = rollSummon(g);
      g.slots[extra] = seedHero(g, id2, extra);
      const p2 = slotXY(extra);
      burst(g, p2.x, p2.y, "#c9e8ff", 8, "puff");
      float(g, p2.x, p2.y - 26, "二重", "#c9e8ff");
    }
  }
  recomputePower(g);
  if (!g.demo) audio.sfxSummon();
  return true;
}

export function startLesson(g: Game) {
  if (g.mode === "title" || g.mode === "fail") return;
  if (g.mode !== "playing") g.mode = "playing";
  if (!g.slots.some((h) => h?.defId === "okiku")) {
    const slot = firstEmpty(g);
    if (slot >= 0) g.slots[slot] = seedHero(g, "okiku", slot);
  }
  g.lesson = "move";
  g.dangerTold = false;
}

function armBreakLesson(g: Game) {
  g.lesson = "break";
  const b = g.stack[0];
  if (b && b.hp > 2) b.hp = 2;
}

function ensureOkikuPair(g: Game) {
  const levels = new Map<number, number>();
  for (const h of g.slots) {
    if (!h || h.defId !== "okiku" || h.level >= 8) continue;
    levels.set(h.level, (levels.get(h.level) ?? 0) + 1);
  }
  for (const n of levels.values()) if (n >= 2) return;
  const mate = g.slots.find((h) => h && h.defId === "okiku" && h.level < 8);
  const slot = firstEmpty(g);
  if (slot < 0) return;
  const twin = seedHero(g, "okiku", slot);
  twin.level = mate?.level ?? 1;
  g.slots[slot] = twin;
  recomputePower(g);
}

/** 客神は合成しない。上がるのはレベルと武器の見た目。間隔と回転はレベルで伸ばさない。 */
export function tryMergeOrSwap(g: Game, from: number, to: number): boolean {
  if (from === to) return false;
  const a = g.slots[from];
  const b = g.slots[to];
  if (!a) return false;
  if (!b) {
    a.slot = to;
    g.slots[to] = a;
    g.slots[from] = null;
    if (g.lesson === "move" && a.defId === "okiku") armBreakLesson(g);
    return true;
  }
  if (a.defId === b.defId && !isGuest(a.defId) && a.level === b.level && a.level < 8) {
    const combined = a.stack + b.stack;
    const p = slotXY(to);
    if (combined >= 3) {
      b.level += 1;
      b.stack = combined - 2;
      g.slots[from] = null;
      burst(g, p.x, p.y, "#fff4c0", 16, "puff");
      g.justMerged = 0.35;
      g.shake = Math.min(1, g.shake + 0.25);
      float(g, p.x, p.y - 28, `${displayLevel(b.level)}`, "#e8c15a");
      recomputePower(g);
      if (!g.demo) audio.sfxMerge();
    } else {
      b.stack = combined;
      g.slots[from] = null;
      burst(g, p.x, p.y, "#e8c15a", 8, "puff");
      g.justMerged = 0.18;
    }
    if (g.lesson === "merge" && a.defId === "okiku") g.lesson = null;
    else if (g.lesson === "move" && a.defId === "okiku") armBreakLesson(g);
    return true;
  }
  a.slot = to;
  b.slot = from;
  g.slots[to] = a;
  g.slots[from] = b;
  if (g.lesson === "move" && (a.defId === "okiku" || b.defId === "okiku")) armBreakLesson(g);
  return true;
}

export function bumpRank(g: Game, h: Hero) {
  g.moveSeq += 1;
  h.rank = g.moveSeq;
}

function tryAutoMerge(g: Game) {
  if (g.lesson || g.demo || !g.autoMerge || g.shop.auto < 1 || g.drag) return;
  const groups = new Map<string, number[]>();
  g.slots.forEach((h, i) => {
    if (!h || h.level >= 8 || isGuest(h.defId)) return;
    const k = `${h.defId}:${h.level}`;
    const arr = groups.get(k) ?? [];
    arr.push(i);
    groups.set(k, arr);
  });
  for (const idxs of groups.values()) {
    if (idxs.length < 3) continue;
    const ranked = idxs
      .map((i) => ({ i, h: g.slots[i]! }))
      .filter((x) => x.h)
      .sort((a, b) => a.h.rank - b.h.rank || b.h.id - a.h.id);
    if (ranked.length < 3) continue;
    const keep = ranked[ranked.length - 1]!;
    // 下から2体を、いちばん上へ。置いた地点があればそこ。なければ古い召喚側に積む。
    const eat = ranked.slice(0, 2);
    const a = keep.h;
    let total = a.stack;
    for (const x of eat) {
      total += x.h.stack;
      g.slots[x.i] = null;
    }
    a.level += 1;
    a.stack = Math.max(1, total - 2);
    const p = slotXY(keep.i);
    burst(g, p.x, p.y, "#fff4c0", 16, "puff");
    g.justMerged = 0.35;
    g.shake = Math.min(1, g.shake + 0.25);
    float(g, p.x, p.y - 28, `${displayLevel(a.level)}`, "#e8c15a");
    recomputePower(g);
    if (!g.demo) audio.sfxMerge();
    return;
  }
}

function openWeapon(g: Game) {
  g.weaponCount += 1;
  const pool = [...WEAPON_POOL];
  g.weaponOptions = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = (g.rng() * pool.length) | 0;
    g.weaponOptions.push(pool.splice(idx, 1)[0]!);
  }
  g.mode = "weapon";
  g.flashBanner = "武器昇格";
  g.flashT = 1.35;
  if (!g.demo) audio.sfxSelect();
}

function openRoute(g: Game) {
  g.routeCount += 1;
  g.routeOptions = routeFor(g.wave);
  g.mode = "route";
  if (!g.demo) audio.sfxSelect();
}

function maybeEvents(g: Game) {
  if (g.demo || g.lesson || g.mode !== "playing") return;
  if (g.routeCount === 0) {
    const low = g.boss.hp / g.boss.maxHp <= routeHpAt(g.shop.path);
    if (low || g.processed >= routeProcessedAt(g.shop.path)) {
      openRoute(g);
      return;
    }
  }
  if (g.weaponCount < 3 && g.processed >= weaponAt(g.weaponCount, g.shop.path)) {
    openWeapon(g);
  }
}

function demoBrain(g: Game, dt: number) {
  if (g.rng() < dt * 0.28) {
    const groups = new Map<string, number[]>();
    g.slots.forEach((h, i) => {
      if (!h) return;
      const k = `${h.defId}:${h.level}`;
      const arr = groups.get(k) ?? [];
      arr.push(i);
      groups.set(k, arr);
    });
    for (const idxs of groups.values()) {
      if (idxs.length < 2) continue;
      const stacked = idxs.find((i) => (g.slots[i]?.stack ?? 0) >= 2);
      if (stacked != null) {
        const other = idxs.find((i) => i !== stacked);
        if (other != null) {
          tryMergeOrSwap(g, other, stacked);
          return;
        }
      }
      if (idxs.length >= 2) {
        tryMergeOrSwap(g, idxs[0]!, idxs[1]!);
        return;
      }
    }
  }
}

export function step(g: Game, dt: number) {
  if (g.voiceOn) g.screamMul = pollVoice(dt);
  else g.screamMul = 1;
  const held = g.playStyle === "manual" && g.mode === "playing" && (!!g.drag || g.guestPick != null);
  const simming = (g.mode === "playing" && !held) || (g.mode === "title" && g.demo);
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt * 2.4);
  g.justMerged = Math.max(0, g.justMerged - dt);
  if (g.flashT > 0) {
    g.flashT -= dt;
    if (g.flashT <= 0) g.flashBanner = null;
  }
  g.boss.hitFlash = Math.max(0, g.boss.hitFlash - dt);
  if (g.mode === "playing") tickItems(g, dt);

  if (g.hitstop > 0) {
    g.hitstop -= dt;
    stepFx(g, dt);
    return;
  }

  if (!simming) {
    stepFx(g, dt);
    return;
  }

  if (g.demo && g.mode === "title") demoBrain(g, dt);

  const cap = g.processed >= 4 ? STACK_CAP : STACK_START;
  refillStack(g, cap);
  layoutStack(g);

  // 手毬は列に残す。dropCd で stack を falling に入れると「壊す＝召喚」が壊れる。
  for (let i = g.falling.length - 1; i >= 0; i--) {
    const b = g.falling[i]!;
    b.y += b.vy * dt;
    b.x += (PIT_X - b.x) * 1.8 * dt;
    b.bob += dt * 6;
    if (b.hp <= 0) continue;
    if (b.y >= PIT_Y + 18) convertToWrap(g, b);
  }

  const packed = g.wrap.length / BELT_SLOTS;
  const pace = (g.itemT.senko ?? 0) > 0 ? 0 : oiranPaceAt(g.shop.slow);
  g.boss.track -= (0.018 + g.wave * 0.0032 + packed * 0.01) * dt * pace;
  if (g.lesson && !g.dangerTold && g.boss.track <= DANGER_TRACK) {
    g.boss.track = DANGER_TRACK * 0.85;
    g.dangerTold = true;
    g.mode = "warn";
    layoutBelt(g, true);
    return;
  }
  failIfGoal(g);
  refillBelt(g, dt);
  layoutBelt(g, false, dt);
  refillCollab(g, dt);
  layoutCollab(g, false, dt);

  stepHeroes(g, dt);
  tryAutoMerge(g);
  stepProjectiles(g, dt);
  pruneDead(g);
  stepFx(g, dt);
  recomputePower(g);
  maybeEvents(g);

  if (g.spawnQueue.length === 0 && g.stack.length === 0 && g.falling.length === 0 && g.boss.hp > 0) {
    g.spawnQueue.push(...makeWave(g.wave, g.rng, g.summonCount, g.shop.thin));
  }
}

function stepFx(g: Game, dt: number) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i]!;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind !== "slash") p.vy += 70 * dt;
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i]!;
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= 0.98;
    if (f.life <= 0) g.floats.splice(i, 1);
  }
  if (g.particles.length > 180) g.particles.splice(0, g.particles.length - 180);
  if (g.floats.length > 40) g.floats.splice(0, g.floats.length - 40);
}

export function setMode(g: Game, m: Mode) {
  g.mode = m;
}
