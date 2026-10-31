/*
  盤面の形。数値と配置は data.ts。判定は sim.ts。
  ここに HP や倍率を書かない。
*/
export type HeroId = "okiku" | "mio" | "kuro" | "hakumen" | "takaten" | "shion" | "monika";
export type ItemId =
  | "senko"
  | "shigure"
  | "ware"
  | "tanzaku"
  | "kinpaku"
  | "fubuki"
  | "kaeshi"
  | "suzu"
  | "seijaku"
  | "maneki";
/** 武器昇格の3択。未知の文字列は倍率を掛けず、選択の終了だけ行う。 */
export type WeaponPickId = "atk" | "spd" | "gold" | "cheap";
/** 金皿の3択。未知の文字列は倍率を掛けず、選択の終了だけ行う。 */
export type BuffPickId = "atk" | "spd" | "gold" | "back" | "both";
export type GuestStock = Partial<Record<HeroId, number>>;
export type Rarity = "common" | "rare" | "elite";
export type Role = "melee" | "ranged";
export type BallKind = "stack" | "fall" | "wrap" | "collab";
export type PlayStyle = "active" | "manual";
/** 客神ガチャの当たり。刃は攻撃、足は速さ、縁は届く長さ。 */
export type GuestCardId = "blade" | "step" | "reach";
export type GuestGrowth = { blade: number; step: number; reach: number; seal: number; slips: number };
export type GuestGrowthBook = Partial<Record<HeroId, GuestGrowth>>;
/** 札。peek は一度押すと効果、もう一度で使う。now は一度で使う。 */
export type ItemTap = "peek" | "now";
export type Mode = "title" | "playing" | "paused" | "weapon" | "route" | "buff" | "fail" | "clear" | "warn";
/** 初回の実演。説明文は出さず、操作できたとき次へ進む。 */
export type LessonStep = "move" | "break" | "merge";

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  rarity: Rarity;
  role: Role;
  atk: number;
  interval: number;
  range: number;
  color: string;
  projectile: string;
  /** 図鑑に出す武器の名前。攻撃の数値とは別。 */
  weapon: string;
  blurb: string;
  /** 届く長さの底。計算は swingLen だけ。defId で射程を足すな。 */
  reachBase: number;
  reachPer: number;
  /** 先端の半径。tipBase + level */
  tipBase: number;
}

export interface Ball {
  id: number;
  hp: number;
  maxHp: number;
  pattern: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BallKind;
  wrapIndex: number;
  bob: number;
  gold: boolean;
  laneT: number;
}

export interface Hero {
  id: number;
  defId: HeroId;
  level: number;
  stack: number;
  slot: number;
  atkCd: number;
  facing: 1 | -1;
  attackT: number;
  swing: number;
  prevSwing: number;
  cleaveIds: number[];
  targetX: number;
  targetY: number;
  buffMul: number;
  rank: number;
  /** 客神の縁。1 は強化なし。 */
  reachMul?: number;
  ephemeral?: boolean;
  /** 客が置いた客神。移動できるのはこの本人だけ。 */
  owner?: string;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  color: string;
  homing: boolean;
  tx: number;
  ty: number;
  target: "ball" | "boss" | "wrap";
  targetId: number;
  multi: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
  kind: "spark" | "puff" | "ring" | "slash";
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  color: string;
  scale: number;
}

export interface WeaponOption {
  id: string;
  name: string;
  desc: string;
}

export interface RouteOption {
  id: HeroId;
  name: string;
  atkLabel: string;
  chanceLabel: string;
  risk: boolean;
  failChance: number;
  atkMul: number;
}

export type ShopId =
  | "atk"
  | "spd"
  | "coin"
  | "okiku"
  | "path"
  | "base"
  | "seed"
  | "back"
  | "arms"
  | "slow"
  | "thin"
  | "auto";
export interface ShopUpgrades {
  atk: number;
  spd: number;
  coin: number;
  okiku: number;
  path: number;
  base: number;
  seed: number;
  back: number;
  arms: number;
  slow: number;
  thin: number;
  auto: number;
}

export interface DragState {
  slot: number;
  x: number;
  y: number;
}

export interface Game {
  mode: Mode;
  /** 実演中だけ。終わったら null。客の写しには載せない。 */
  lesson: LessonStep | null;
  /** 実演中に、赤い線の警告を出した。 */
  dangerTold: boolean;
  demo: boolean;
  t: number;
  wave: number;
  coins: number;
  summonCost: number;
  summonCount: number;
  combatPower: number;
  slots: Array<Hero | null>;
  stack: Ball[];
  falling: Ball[];
  wrap: Ball[];
  collab: Ball[];
  boss: {
    hp: number;
    maxHp: number;
    hitFlash: number;
    x: number;
    y: number;
    track: number;
    spin: number;
  };
  projectiles: Projectile[];
  particles: Particle[];
  floats: FloatText[];
  selectedSlot: number | null;
  drag: DragState | null;
  moveSeq: number;
  shake: number;
  hitstop: number;
  spawnQueue: Array<{ hp: number; pattern: number }>;
  dropCd: number;
  muted: boolean;
  debug: boolean;
  playStyle: PlayStyle;
  autoMerge: boolean;
  voiceOn: boolean;
  screamMul: number;
  unlocked: HeroId[];
  atkMul: number;
  spdMul: number;
  goldMul: number;
  rng: () => number;
  nextId: number;
  highWave: number;
  bank: number;
  shop: ShopUpgrades;
  lastEarned: number;
  twinSummon: number;
  weaponOptions: WeaponOption[];
  buffOptions: WeaponOption[];
  routeOptions: RouteOption[];
  flashBanner: string | null;
  flashT: number;
  justMerged: number;
  processed: number;
  weaponCount: number;
  routeCount: number;
  netaCount: number;
  goldKills: number;
  netaSinceGold: number;
  netaCd: number;
  netaReserve: number;
  collabCd: number;
  marks: number;
  markBank: number;
  lastMarks: number;
  guestStock: GuestStock;
  guestLeft: GuestStock;
  /** 客神ガチャ。札の段と、封の数。 */
  guestGrowth: GuestGrowthBook;
  guestPick: HeroId | null;
  /** 客席。盤面は主催の写しで、式神そのものは動かさない。 */
  assist: boolean;
  /** 右上の華を開いたときだけ客神一覧を出す。常時並べない。 */
  guestListOpen: boolean;
  /** 画面下の「札」を開いたときだけ10枚を出す。常時並べない。 */
  itemListOpen: boolean;
  /** 札の押し方。未設定は効果を見てから使う。 */
  itemTap: ItemTap;
  itemT: Record<ItemId, number>;
  /** この挑戦で、その札を買った回数。次の挑戦では 0。 */
  itemBuys: Record<ItemId, number>;
}
