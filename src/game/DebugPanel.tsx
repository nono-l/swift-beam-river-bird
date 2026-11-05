/*
  設定とデバッグ。戦闘のルールは持たない。
  タイトルの設定から誰でもON。右上のトグルに戻すな。
*/
import { useEffect, useRef, useState } from "react";
import type { Game, HeroId } from "./types";
import type { DebugField } from "./sim";
import { debugNudge, debugOpenBuff, debugOpenRoute, debugOpenWeapon, debugSummon, debugUnlockAll } from "./sim";
import { nudgeGuest } from "./guests";
import { setAutoMerge, setDebugMode, setItemTap, setPlayStyle, setVoiceOn, mergeMeta, saveMeta, snapshotMeta } from "./persist";
import { applyMeta } from "./sim";
import { pullPreviousSave } from "@/server/migrate";
import { startVoice, stopVoice, voiceStatus } from "./mic";
import { GUEST_KINDS, HEROES, ROSTER_IDS, displayLevel, isGuest, roleLabel } from "./data";

const ROWS: Array<{ id: DebugField; label: string; fmt: (g: Game) => string }> = [
  { id: "bank", label: "所持両", fmt: (g) => String(g.bank) },
  { id: "shopAtk", label: "店・攻撃Lv", fmt: (g) => String(g.shop.atk) },
  { id: "shopSpd", label: "店・速度Lv", fmt: (g) => String(g.shop.spd) },
  { id: "shopCoin", label: "店・開始両Lv", fmt: (g) => String(g.shop.coin) },
  { id: "shopOkiku", label: "店・二人目Lv", fmt: (g) => String(g.shop.okiku) },
  { id: "shopPath", label: "店・道Lv", fmt: (g) => String(g.shop.path) },
  { id: "shopBase", label: "店・基礎攻撃", fmt: (g) => String(1 + g.shop.base) },
  { id: "shopSeed", label: "店・口寄せ", fmt: (g) => String(g.shop.seed) },
  { id: "shopBack", label: "店・押し戻し", fmt: (g) => String(g.shop.back) },
  { id: "shopArms", label: "店・輪刃", fmt: (g) => String(1 + g.shop.arms) },
  { id: "shopSlow", label: "店・足枷", fmt: (g) => String(g.shop.slow) },
  { id: "shopThin", label: "店・薄皮", fmt: (g) => String(g.shop.thin) },
  { id: "shopAuto", label: "店・自動重ね", fmt: (g) => (g.shop.auto ? "解禁" : "未") },
  { id: "marks", label: "ランの華", fmt: (g) => String(g.marks) },
  { id: "markBank", label: "所持華", fmt: (g) => String(g.markBank) },
  { id: "coins", label: "ランの両", fmt: (g) => String(g.coins) },
  { id: "wave", label: "WAVE", fmt: (g) => String(g.wave) },
  { id: "highWave", label: "最高WAVE", fmt: (g) => String(g.highWave) },
  { id: "processed", label: "処理数", fmt: (g) => String(g.processed) },
  { id: "goldKills", label: "金皿撃破", fmt: (g) => String(g.goldKills) },
  { id: "bossHp", label: "花魁HP", fmt: (g) => String(Math.round(g.boss.hp)) },
  { id: "track", label: "花魁位置", fmt: (g) => g.boss.track.toFixed(2) },
  { id: "atkMul", label: "攻撃倍率", fmt: (g) => `×${g.atkMul.toFixed(2)}` },
  { id: "spdMul", label: "速度倍率", fmt: (g) => `×${g.spdMul.toFixed(2)}` },
  { id: "twin", label: "口寄せ札", fmt: (g) => `+${g.twinSummon}` },
];

const LIVE: Array<{ id: DebugField; label: string; fmt: (g: Game) => string }> = [
  { id: "bossHp", label: "花魁HP", fmt: (g) => String(Math.round(g.boss.hp)) },
  { id: "track", label: "位置", fmt: (g) => g.boss.track.toFixed(2) },
  { id: "wave", label: "WAVE", fmt: (g) => String(g.wave) },
  { id: "processed", label: "処理", fmt: (g) => String(g.processed) },
];

const SHOP_ROW_IDS = new Set<DebugField>([
  "bank",
  "markBank",
  "shopAtk",
  "shopSpd",
  "shopCoin",
  "shopOkiku",
  "shopPath",
  "shopBase",
  "shopSeed",
  "shopBack",
  "shopArms",
  "shopSlow",
  "shopThin",
  "shopAuto",
]);
const FIGHT_ROWS = ROWS.filter((row) => !SHOP_ROW_IDS.has(row.id));
const SHOP_ROWS = ROWS.filter((row) => SHOP_ROW_IDS.has(row.id));

type SettingsTab = "play" | "debug";
type DebugTab = "fight" | "shop" | "guest" | "scene";

function DebugRows({
  rows,
  g,
  onBump,
}: {
  rows: Array<{ id: DebugField; label: string; fmt: (g: Game) => string }>;
  g: Game;
  onBump: (id: DebugField, dir: 1 | -1) => void;
}) {
  return (
    <div className="shop-list debug-list">
      {rows.map((row) => (
        <div key={row.id} className="debug-row">
          <div className="shop-copy">
            <div className="nm">{row.label}</div>
            <div className="lv">{row.fmt(g)}</div>
          </div>
          <div className="debug-step">
            <button type="button" onClick={() => onBump(row.id, -1)} aria-label="減らす">
              −
            </button>
            <button type="button" onClick={() => onBump(row.id, 1)} aria-label="増やす">
              ＋
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroCard({
  g,
  id,
  hint,
  inPanel = false,
}: {
  g: Game;
  id: HeroId;
  hint?: string;
  inPanel?: boolean;
}) {
  const d = HEROES[id];
  return (
    <div className={`guest-card${inPanel ? " in-panel" : ""}${isGuest(id) ? "" : " roster"}`}>
      <img src={`/assets/${id}.png`} alt="" width={72} height={72} />
      <div className="guest-copy">
        <p className="guest-name">{d.name}</p>
        <p className="guest-title">{d.title}　{roleLabel(d.role)}</p>
        <p className="guest-weapon">{d.weapon}</p>
        <p className="guest-stat">
          攻撃 {d.atk + g.shop.base}　間隔 {d.interval.toFixed(2)}秒　射程 {d.range}
        </p>
        <p className="guest-blurb">{d.blurb}</p>
        {hint ? <p className="guest-hint">{hint}</p> : null}
      </div>
    </div>
  );
}

export function SettingsPanel({
  g,
  onClose,
  onChange,
  tutorialOn,
  tutorialMode,
  onTutorial,
  onReplayTutorial,
}: {
  g: Game;
  onClose: () => void;
  onChange: () => void;
  tutorialOn: boolean;
  tutorialMode: "once" | "on" | "off";
  onTutorial: (on: boolean) => void;
  onReplayTutorial: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("play");
  const [debugTab, setDebugTab] = useState<DebugTab>("fight");
  const [carryNote, setCarryNote] = useState("");
  const bump = (id: DebugField, dir: 1 | -1) => {
    debugNudge(g, id, dir);
    onChange();
  };
  return (
    <div className="overlay-scrim is-shop is-modal">
      <div className="overlay-panel enter shop-panel">
        <div className="shop-head">
          <div className="ribbon stagger">設定</div>
          <p className="shop-hint stagger">開いているあいだ、円陣は止まる。</p>
          <div className="shop-tabs" role="tablist" aria-label="設定">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "play"}
              className={tab === "play" ? "on" : ""}
              onClick={() => setTab("play")}
            >
              操作
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "debug"}
              className={tab === "debug" ? "on" : ""}
              onClick={() => setTab("debug")}
            >
              デバッグ
            </button>
          </div>
        </div>
        <div className="shop-scroll">
          {tab === "play" && (
            <>
              <p className="shop-hint stagger">操作</p>
              <div className="play-style stagger">
                <button
                  type="button"
                  className={`debug-switch${g.playStyle === "active" ? " on" : ""}`}
                  onClick={() => {
                    setPlayStyle(g, "active");
                    onChange();
                  }}
                >
                  アクティブ
                </button>
                <button
                  type="button"
                  className={`debug-switch${g.playStyle === "manual" ? " on" : ""}`}
                  onClick={() => {
                    setPlayStyle(g, "manual");
                    onChange();
                  }}
                >
                  マニュアル
                </button>
              </div>
              <p className="shop-hint stagger">
                {g.playStyle === "manual"
                  ? "ユニットを動かしている間と、客神を置くまでの間、円陣は休止と同じく止まる。"
                  : "動かしながら戦う。今までの仕様。"}
              </p>
              <p className="shop-hint stagger">札</p>
              <div className="play-style stagger">
                <button
                  type="button"
                  className={`debug-switch${g.itemTap !== "now" ? " on" : ""}`}
                  onClick={() => {
                    setItemTap(g, "peek");
                    onChange();
                  }}
                >
                  効果を見て使う
                </button>
                <button
                  type="button"
                  className={`debug-switch${g.itemTap === "now" ? " on" : ""}`}
                  onClick={() => {
                    setItemTap(g, "now");
                    onChange();
                  }}
                >
                  すぐ使う
                </button>
              </div>
              <p className="shop-hint stagger">
                {g.itemTap === "now"
                  ? "札を一度押すと、すぐ使う。"
                  : "札を一度押すと効果が出る。その札をもう一度押すと使う。"}
              </p>
              <p className="shop-hint stagger">叫び</p>
              <div className="play-style stagger">
                <button
                  type="button"
                  className={`debug-switch${g.voiceOn ? " on" : ""}`}
                  onClick={() => {
                    setVoiceOn(g, true);
                    void startVoice();
                    onChange();
                  }}
                >
                  ON
                </button>
                <button
                  type="button"
                  className={`debug-switch${!g.voiceOn ? " on" : ""}`}
                  onClick={() => {
                    setVoiceOn(g, false);
                    stopVoice();
                    onChange();
                  }}
                >
                  OFF
                </button>
              </div>
              <p className="shop-hint stagger">
                {voiceStatus() === "denied"
                  ? "マイクが拒否されました。ブラウザの許可を出してください。"
                  : g.voiceOn
                    ? "叫んでいるあいだ、大きさで最大3倍、声が高いほどさらに最大10倍。合わせて最大30倍。"
                    : "マイクは使わない。"}
              </p>
              <p className="shop-hint stagger">チュートリアルを表示する</p>
              <div className="play-style stagger">
                <button
                  type="button"
                  className={`debug-switch${tutorialOn ? " on" : ""}`}
                  onClick={() => onTutorial(true)}
                >
                  ON
                </button>
                <button
                  type="button"
                  className={`debug-switch${!tutorialOn ? " on" : ""}`}
                  onClick={() => onTutorial(false)}
                >
                  OFF
                </button>
              </div>
              <p className="shop-hint stagger">
                {tutorialMode === "on"
                  ? "挑戦を始めるたびに、動かしながら出る。"
                  : tutorialMode === "once"
                    ? "次の挑戦で一度、動かしながら出る。終わるとOFFになる。"
                    : "開始時には出さない。"}
              </p>
              <button type="button" className="ghost-btn stagger" onClick={onReplayTutorial}>
                最初から見る
              </button>
              <p className="shop-hint stagger">前のドメインから引継ぐ</p>
              <button
                type="button"
                className="ghost-btn stagger"
                onClick={() => {
                  setCarryNote("聞いています");
                  void pullPreviousSave()
                    .then((res) => {
                      if (!res.ok) {
                        setCarryNote(res.reason);
                        return;
                      }
                      applyMeta(g, mergeMeta(snapshotMeta(g), { version: 2, ...res.save }));
                      saveMeta(g);
                      setCarryNote("引継いだ。両と華と店と客神は、大きい方を残した");
                      onChange();
                    })
                    .catch(() => setCarryNote("先に Google で保存してください"));
                }}
              >
                引継ぐ
              </button>
              <p className="shop-hint stagger">
                {carryNote || "今の Google のメールで、前のサーバに一度だけ聞く。貼り付けた数字は使わない。"}
              </p>
              {g.shop.auto >= 1 && (
                <>
                  <p className="shop-hint stagger">自動重ね</p>
                  <div className="play-style stagger">
                    <button
                      type="button"
                      className={`debug-switch${g.autoMerge ? " on" : ""}`}
                      onClick={() => {
                        setAutoMerge(g, true);
                        onChange();
                      }}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      className={`debug-switch${!g.autoMerge ? " on" : ""}`}
                      onClick={() => {
                        setAutoMerge(g, false);
                        onChange();
                      }}
                    >
                      OFF
                    </button>
                  </div>
                  <p className="shop-hint stagger">
                    {g.autoMerge ? "同じレベルが3体そろうと、重ねてレベルが上がる。" : "自分で重ねる。"}
                  </p>
                </>
              )}
            </>
          )}
          {tab === "debug" && (
            <>
              <p className="shop-hint stagger">開発中。誰でもデバッグを付けられます。</p>
              <button
                type="button"
                className={`debug-switch stagger${g.debug ? " on" : ""}`}
                onClick={() => {
                  setDebugMode(g, !g.debug);
                  onChange();
                }}
              >
                デバッグ {g.debug ? "ON" : "OFF"}
              </button>
              {g.debug ? (
                <>
                  <div className="shop-tabs four" role="tablist" aria-label="デバッグ">
                    {(
                      [
                        ["fight", "戦闘"],
                        ["shop", "店"],
                        ["guest", "客神"],
                        ["scene", "場面"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={debugTab === id}
                        className={debugTab === id ? "on" : ""}
                        onClick={() => setDebugTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {debugTab === "fight" && <DebugRows rows={FIGHT_ROWS} g={g} onBump={bump} />}
                  {debugTab === "shop" && <DebugRows rows={SHOP_ROWS} g={g} onBump={bump} />}
                  {debugTab === "guest" && (
                    <div className="shop-list debug-list">
                      {GUEST_KINDS.map((k) => (
                        <div key={k.id} className="debug-row">
                          <div className="shop-copy">
                            <div className="nm">客神・{HEROES[k.id].name}</div>
                            <div className="lv">{g.guestStock[k.id] ?? 0}</div>
                          </div>
                          <div className="debug-step">
                            <button
                              type="button"
                              onClick={() => {
                                nudgeGuest(g, k.id, -1);
                                onChange();
                              }}
                              aria-label="減らす"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                nudgeGuest(g, k.id, 1);
                                onChange();
                              }}
                              aria-label="増やす"
                            >
                              ＋
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {debugTab === "scene" && (
                    <div className="debug-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          debugUnlockAll(g);
                          onChange();
                        }}
                      >
                        式神を全解禁
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          debugOpenWeapon(g);
                          onClose();
                          onChange();
                        }}
                      >
                        武器3択
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          debugOpenRoute(g);
                          onClose();
                          onChange();
                        }}
                      >
                        上級の道
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          debugOpenBuff(g);
                          onClose();
                          onChange();
                        }}
                      >
                        金皿3択
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="shop-hint">ONにすると、ヒットボックスと数値の増減が出る。</p>
              )}
            </>
          )}
        </div>
        <div className="shop-foot">
          <button type="button" className="ghost-btn stagger" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

type DockEdge = "left" | "right" | "top" | "bottom";

function dockEdge(el: HTMLElement, stage: HTMLElement, x: number, y: number): DockEdge | null {
  const left = el.offsetLeft + x;
  const top = el.offsetTop + y;
  const gaps: Array<{ edge: DockEdge; g: number }> = [
    { edge: "left", g: left },
    { edge: "right", g: stage.clientWidth - (left + el.offsetWidth) },
    { edge: "top", g: top },
    { edge: "bottom", g: stage.clientHeight - (top + el.offsetHeight) },
  ];
  const near = gaps.filter((item) => item.g <= 14).sort((a, b) => a.g - b.g)[0];
  return near?.edge ?? null;
}

export function DebugDock({ g, onChange }: { g: Game; onChange: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;
  const [tab, setTab] = useState<"live" | "summon">("live");
  const [who, setWho] = useState<HeroId>("okiku");
  const [lv, setLv] = useState(1);
  const [note, setNote] = useState("");
  const [mini, setMini] = useState(false);
  const [edge, setEdge] = useState<DockEdge>("right");
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    const stage = el?.offsetParent as HTMLElement | null;
    if (!el || !stage) return;
    const pad = 4;
    let x = posRef.current.x;
    let y = posRef.current.y;
    if (mini) {
      if (edge === "left") x = pad - el.offsetLeft;
      if (edge === "right") x = stage.clientWidth - pad - el.offsetWidth - el.offsetLeft;
      if (edge === "top") y = pad - el.offsetTop;
      if (edge === "bottom") y = stage.clientHeight - pad - el.offsetHeight - el.offsetTop;
    }
    const maxX = stage.clientWidth - el.offsetWidth - el.offsetLeft;
    const minX = -el.offsetLeft;
    const maxY = stage.clientHeight - el.offsetHeight - el.offsetTop;
    const minY = -el.offsetTop;
    const next = {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
    if (next.x === posRef.current.x && next.y === posRef.current.y) return;
    posRef.current = next;
    setPos(next);
  }, [mini, edge]);

  if (!g.debug) return null;

  const nudge = (id: DebugField, dir: 1 | -1) => {
    debugNudge(g, id, dir);
    onChange();
  };
  const summon = () => {
    const ok = debugSummon(g, who, lv);
    setNote(ok ? `${HEROES[who].name} Lv${displayLevel(lv)}` : "空きがない");
    onChange();
  };

  return (
    <div
      ref={ref}
      className={`debug-dock${mini ? " is-mini" : ""}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.stopPropagation();
        drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.px;
        const dy = e.clientY - d.py;
        if (Math.hypot(dx, dy) <= 5) return;
        const el = ref.current;
        const stage = el?.offsetParent as HTMLElement | null;
        let x = d.x + dx;
        let y = d.y + dy;
        if (el && stage) {
          x = Math.min(stage.clientWidth - el.offsetWidth - el.offsetLeft, Math.max(-el.offsetLeft, x));
          y = Math.min(stage.clientHeight - el.offsetHeight - el.offsetTop, Math.max(-el.offsetTop, y));
        }
        posRef.current = { x, y };
        setPos({ x, y });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        const moved = Math.hypot(e.clientX - d.px, e.clientY - d.py) > 5;
        if (!moved) {
          if (mini) setMini(false);
          return;
        }
        const el = ref.current;
        const stage = el?.offsetParent as HTMLElement | null;
        const hit = el && stage ? dockEdge(el, stage, posRef.current.x, posRef.current.y) : null;
        if (hit) {
          setEdge(hit);
          setMini(true);
        } else {
          setMini(false);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div className="debug-dock-mini">数値</div>
      <div className="debug-dock-tabs" role="tablist" aria-label="デバッグ">
        <button type="button" role="tab" aria-selected={tab === "live"} className={tab === "live" ? "on" : ""} onPointerDown={(e) => e.stopPropagation()} onClick={() => setTab("live")}>
          数値
        </button>
        <button type="button" role="tab" aria-selected={tab === "summon"} className={tab === "summon" ? "on" : ""} onPointerDown={(e) => e.stopPropagation()} onClick={() => setTab("summon")}>
          召喚
        </button>
      </div>
      {tab === "live" ? (
        LIVE.map((row) => (
          <div key={row.id} className="debug-dock-row">
            <span>{row.label}</span>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => nudge(row.id, -1)}>
              −
            </button>
            <b>{row.fmt(g)}</b>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => nudge(row.id, 1)}>
              ＋
            </button>
          </div>
        ))
      ) : (
        <div className="debug-dock-summon">
          <div className="debug-dock-faces">
            {ROSTER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={who === id ? "on" : ""}
                aria-pressed={who === id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setWho(id)}
              >
                <img src={`/assets/${id}.png`} alt="" width={28} height={28} />
                <span>{HEROES[id].name}</span>
              </button>
            ))}
          </div>
          <div className="debug-dock-level">
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setLv((n) => Math.max(1, n - 1))} aria-label="レベルを下げる">
              −
            </button>
            <b>Lv{displayLevel(lv)}</b>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setLv((n) => Math.min(8, n + 1))} aria-label="レベルを上げる">
              ＋
            </button>
          </div>
          <button type="button" className="debug-dock-go" onPointerDown={(e) => e.stopPropagation()} onClick={summon}>
            出す
          </button>
          {note ? <p>{note}</p> : null}
        </div>
      )}
    </div>
  );
}
