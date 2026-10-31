/*
  画面の切り替えと HTML。盤面のルールは sim、絵は draw。
  札と休止は左下の HTML。Canvas に戻すと重なる。
  金皿の3択はここでは出さない。
*/
import { useEffect, useRef, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadCloudSave, putCloudSave } from "@/server/saves";
import { GUEST_HINT, GUEST_KINDS, HEROES, guestLine, VH, VW, shopT1Maxed, shopT3Open, shopT4Open, hitMarkBadge, isGuest, ITEMS, itemPrice } from "./data";
import { BUILD_STAMP } from "./build-stamp";
import { DebugDock, HeroCard, SettingsPanel } from "./DebugPanel";
import { GachaPanel } from "./gacha-ui";
import { draw, loadAssets } from "./draw";
import {
  applyMeta,
  cashOutRun,
  continueClear,
  createGame,
  resetRun,
  setMode,
  startLesson,
  step,
} from "./sim";
import { buyItem } from "./items";
import { onPointerDown, onPointerMove, onPointerUp, slotAt } from "./input";
import { chooseRoute, chooseWeapon } from "./picks";
import { dismissTutorial, mergeMeta, setCloudFlush, setPlayStyle, setTutorialShow, snapshotMeta, tutorialShowMode, tutorialShowsOnStart, type TutorialMode } from "./persist";
import { armGuestLeft, moveOwnedGuest, refundOwnGuest, spendOwnGuest } from "./guests";
import type { Game, GuestStock, HeroId, ItemId, LessonStep } from "./types";
import * as audio from "./audio";
import { startVoice } from "./mic";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { applySnap, hostOnMessage, isNetMsg, packSnap, type NetMsg } from "./net";
import { GuestBar, GuestWait, RoomBox, RoomChip, RoomOpened } from "./room-ui";
import { CodexPanel, ShopPanel } from "./shop-ui";
import { ClearOverlay, DangerWarn, FailOverlay, LessonBar, PauseButton, PauseOverlay, RouteOverlay, WeaponOverlay } from "./match-ui";

type OverlayKind = "title" | "none" | "weapon" | "route" | "buff" | "fail" | "paused" | "clear" | "warn";
type Seat = "off" | "host" | "guest";

function roomCodeOk(code: string): boolean {
  return /^ring-[A-Z2-9]{4}$/.test(code);
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += alphabet[(Math.random() * alphabet.length) | 0];
  return `ring-${tail}`;
}

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [kind, setKind] = useState<OverlayKind>("title");
  const [tick, setTick] = useState(0);
  const [hexOnly, setHexOnly] = useState(true);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [gachaOpen, setGachaOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"base" | "guest">("base");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;
  const [lesson, setLesson] = useState<LessonStep | null>(null);
  const [slipPeek, setSlipPeek] = useState<ItemId | null>(null);
  const [tutorialOn, setTutorialOn] = useState(false);
  const [tutorialMode, setTutorialMode] = useState<TutorialMode>("once");
  const [codexOpen, setCodexOpen] = useState(false);
  const [failManual, setFailManual] = useState(false);
  const [seat, setSeat] = useState<Seat>("off");
  const [roomCode, setRoomCode] = useState("");
  const [joinDraft, setJoinDraft] = useState("");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [roomNote, setRoomNote] = useState("");
  const [linked, setLinked] = useState(false);
  const [roomHelp, setRoomHelp] = useState(false);
  const linkedRef = useRef(false);
  const seatRef = useRef<Seat>("off");
  seatRef.current = seat;
  const roomRef = useRef<P2PRoom | null>(null);
  const peerStockRef = useRef(new Map<string, GuestStock>());
  const pendingPlaceRef = useRef(new Map<number, HeroId>());
  const pendingMoveRef = useRef<{ n: number; heroId: number; to: number; at: number } | null>(null);
  const guestDragHeroRef = useRef<number | null>(null);
  const nonceRef = useRef(1);
  const selfIdRef = useRef(`p${Math.random().toString(36).slice(2, 10)}`);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    if (kind !== "fail") setFailManual(false);
  }, [kind]);

  useEffect(() => {
    const mode = tutorialShowMode();
    setTutorialMode(mode);
    setTutorialOn(mode !== "off");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAssets().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const game = createGame({ demo: true });
    gameRef.current = game;
    audio.setMuted(game.muted);
    setMuted(game.muted);

    const fit = () => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(VW * dpr);
      canvas.height = Math.round(VH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    let last = performance.now();
    let acc = 0;
    let sendAcc = 0;
    let helloAcc = 0;
    let raf = 0;
    let lastKind: OverlayKind = "title";
    let lastMarks = game.marks;
    let lastGuests = guestLine(game.guestLeft);
    const STEP = 1 / 60;

    let prevLesson: LessonStep | null = game.lesson;
    let slipAcc = 0;
    const loop = (now: number) => {
      const raw = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += raw;
      // 客は盤面を進めない。設定を開いているあいだも進めない。paused には落とさない。
      if (seatRef.current === "guest" || settingsOpenRef.current) {
        acc = 0;
      } else {
        while (acc >= STEP) {
          step(game, STEP);
          acc -= STEP;
        }
      }
      const room = roomRef.current;
      game.assist = seatRef.current === "guest";
      if (room && seatRef.current === "host") {
        sendAcc += raw;
        if (sendAcc >= 0.12) {
          sendAcc = 0;
          try {
            room.broadcast({ t: "snap", snap: packSnap(game) });
          } catch {
            /* 客の受信が追いつかない間は次の写しで足りる */
          }
        }
      }
      if (room && seatRef.current === "guest" && !linkedRef.current) {
        helloAcc += raw;
        if (helloAcc >= 0.35) {
          helloAcc = 0;
          room.send({ t: "hello", stock: { ...game.guestStock } } satisfies NetMsg);
        }
      }
      draw(ctx, game);
      if (game.lesson !== prevLesson) {
        const finished = prevLesson != null && game.lesson == null;
        prevLesson = game.lesson;
        setLesson(game.lesson);
        if (finished) {
          dismissTutorial();
          const mode = tutorialShowMode();
          setTutorialMode(mode);
          setTutorialOn(mode !== "off");
        }
      }
      const k = overlayOf(game);
      if (k !== lastKind) {
        lastKind = k;
        setKind(k);
        setTick((n) => n + 1);
      } else if (game.marks !== lastMarks || guestLine(game.guestLeft) !== lastGuests) {
        lastMarks = game.marks;
        lastGuests = guestLine(game.guestLeft);
        setTick((n) => n + 1);
      }
      slipAcc += raw;
      if (slipAcc >= 0.25) {
        slipAcc = 0;
        let hot = false;
        for (const t of Object.values(game.itemT)) {
          if (t > 0) hot = true;
        }
        if (hot) setTick((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (seatRef.current === "guest") return;
      if (document.visibilityState === "hidden") {
        if (game.mode === "playing") {
          setMode(game, "paused");
          setKind("paused");
        }
      } else {
        audio.resumeIfNeeded();
        audio.startTheme();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (seatRef.current === "guest") return;
      if (e.key === "Escape" && game.mode === "playing") {
        setMode(game, "paused");
        setKind("paused");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", fit);

    const kick = () => audio.unlockAudio();
    window.addEventListener("pointerdown", kick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
      window.removeEventListener("pointerdown", kick);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudFlush(null);
      return;
    }
    let cancelled = false;
    void loadCloudSave()
      .then((remote) => {
        const g = gameRef.current;
        if (cancelled || !g) return;
        if (remote) {
          applyMeta(g, mergeMeta(snapshotMeta(g), { version: 2, ...remote }));
        }
        setCloudFlush((m) => {
          void putCloudSave({ data: { highWave: m.highWave, bank: m.bank, markBank: m.markBank, guestStock: m.guestStock, guestGrowth: m.guestGrowth, shop: m.shop } }).catch(
            () => {},
          );
        });
        setTick((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (kind !== "weapon") return;
    setHexOnly(true);
    const t = window.setTimeout(() => setHexOnly(false), 1150);
    return () => window.clearTimeout(t);
  }, [kind, tick]);

  const toLocal = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * VW) / rect.width,
      y: ((e.clientY - rect.top) * VH) / rect.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g) return;
    audio.unlockAudio();
    if (g.voiceOn && seatRef.current !== "guest") void startVoice();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toLocal(e);
    if (seatRef.current === "guest") {
      guestDown(g, p.x, p.y);
      setTick((n) => n + 1);
      return;
    }
    const picking = g.guestPick;
    if (g.mode === "playing" || g.mode === "buff") onPointerDown(g, p.x, p.y);
    if (g.guestPick !== picking) setTick((n) => n + 1);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g) return;
    const p = toLocal(e);
    if (seatRef.current === "guest") {
      if (g.drag) onPointerMove(g, p.x, p.y);
      return;
    }
    onPointerMove(g, p.x, p.y);
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g) return;
    const p = toLocal(e);
    if (seatRef.current === "guest") {
      guestUp(g, p.x, p.y);
      return;
    }
    onPointerUp(g, p.x, p.y);
  };

  const nextNonce = () => {
    nonceRef.current += 1;
    return nonceRef.current;
  };

  const guestDown = (g: Game, x: number, y: number) => {
    if (g.mode !== "playing") return;
    if (hitMarkBadge(x, y)) {
      g.guestListOpen = !g.guestListOpen;
      if (!g.guestListOpen) g.guestPick = null;
      return;
    }
    if (g.guestPick) {
      const id = g.guestPick;
      const s = slotAt(x, y);
      g.guestPick = null;
      g.guestListOpen = false;
      if (s < 0 || g.slots[s]) return;
      if (!linkedRef.current) return;
      if (!spendOwnGuest(g, id)) return;
      const n = nextNonce();
      pendingPlaceRef.current.set(n, id);
      roomRef.current?.send({ t: "place", id, slot: s, n } satisfies NetMsg);
      return;
    }
    const s = slotAt(x, y);
    const hero = s >= 0 ? g.slots[s] : null;
    if (hero && isGuest(hero.defId) && hero.owner === selfIdRef.current) {
      g.drag = { slot: s, x, y };
      g.selectedSlot = s;
      guestDragHeroRef.current = hero.id;
    }
  };

  const guestUp = (g: Game, x: number, y: number) => {
    if (!g.drag) return;
    const from = g.drag.slot;
    const heroId = guestDragHeroRef.current;
    g.drag = null;
    guestDragHeroRef.current = null;
    const to = slotAt(x, y);
    if (heroId == null || to < 0 || to === from || !linkedRef.current) return;
    if (!moveOwnedGuest(g, from, to, selfIdRef.current)) return;
    const n = nextNonce();
    pendingMoveRef.current = { n, heroId, to, at: performance.now() };
    roomRef.current?.send({ t: "move", from, to, n } satisfies NetMsg);
  };

  const toggleMute = () => {
    const g = gameRef.current;
    if (!g) return;
    g.muted = !g.muted;
    audio.setMuted(g.muted);
    setMuted(g.muted);
  };

  const openRun = (forceLesson: boolean) => {
    const g = gameRef.current;
    if (!g || !ready || seatRef.current === "guest") return;
    audio.unlockAudio();
    if (g.voiceOn) void startVoice();
    resetRun(g, false);
    setShopOpen(false);
    setSettingsOpen(false);
    setRoomHelp(false);
    setKind("none");
    if (forceLesson || tutorialShowsOnStart()) {
      startLesson(g);
      setLesson("move");
    } else {
      setLesson(null);
    }
  };

  const start = () => openRun(false);

  const skipLesson = () => {
    const g = gameRef.current;
    if (g) g.lesson = null;
    setLesson(null);
    dismissTutorial();
    const mode = tutorialShowMode();
    setTutorialMode(mode);
    setTutorialOn(mode !== "off");
  };

  const openRoom = () => {
    peerStockRef.current.clear();
    setRoomNote("");
    setRoomCode(makeRoomCode());
    setSeat("host");
    setRoomHelp(true);
  };

  const joinRoom = () => {
    const code = joinDraft.trim().toUpperCase();
    const room = code.startsWith("RING-") ? `ring-${code.slice(5)}` : code.startsWith("ring-") ? code : `ring-${code}`;
    if (!roomCodeOk(room)) {
      setRoomNote("合い言葉は4文字です");
      return;
    }
    const g = gameRef.current;
    if (g) armGuestLeft(g);
    peerStockRef.current.clear();
    pendingPlaceRef.current.clear();
    pendingMoveRef.current = null;
    guestDragHeroRef.current = null;
    setRoomNote("");
    setRoomCode(room);
    setSeat("guest");
  };

  const leaveRoom = () => {
    setSeat("off");
    setRoomCode("");
    setRoomHelp(false);
    setPeers([]);
    setRoomNote("");
    peerStockRef.current.clear();
    pendingPlaceRef.current.clear();
    pendingMoveRef.current = null;
    guestDragHeroRef.current = null;
    linkedRef.current = false;
    setLinked(false);
  };

  useEffect(() => {
    if (seat === "off" || !roomCode) return;
    linkedRef.current = false;
    setLinked(false);
    const room = new P2PRoom({
      room: roomCode,
      selfId: selfIdRef.current,
      name: seat === "host" ? "主催" : "客",
      onPeersChanged: (list) => {
        setPeers(list);
        const g = gameRef.current;
        if (!g) return;
        if (seatRef.current === "guest" && list.some((p) => p.connectionState === "connected")) {
          room.send({ t: "hello", stock: { ...g.guestStock } } satisfies NetMsg);
        }
        if (seatRef.current === "host") {
          room.send({ t: "snap", snap: packSnap(g) } satisfies NetMsg);
        }
      },
      onMessage: (from, data, channel) => {
        const g = gameRef.current;
        if (!g || !isNetMsg(data)) return;
        if (seatRef.current === "host") {
          if (channel !== "reliable") return;
          hostOnMessage(g, from, data, peerStockRef.current, (msg, to) => room.send(msg, to));
          setTick((n) => n + 1);
          return;
        }
        if (data.t === "snap") {
          applySnap(g, data.snap, guestDragHeroRef.current ?? undefined);
          const pend = pendingMoveRef.current;
          if (pend) {
            const at = g.slots.findIndex((h) => h?.id === pend.heroId);
            if (at < 0 || at === pend.to || performance.now() - pend.at > 1500) pendingMoveRef.current = null;
            else moveOwnedGuest(g, at, pend.to, selfIdRef.current);
          }
          setTick((n) => n + 1);
          return;
        }
        if (data.t === "welcome") {
          if (!linkedRef.current) {
            linkedRef.current = true;
            setLinked(true);
          }
          return;
        }
        if (data.t === "ack") {
          const id = pendingPlaceRef.current.get(data.n);
          pendingPlaceRef.current.delete(data.n);
          if (id && !data.ok) refundOwnGuest(g, id);
          if (pendingMoveRef.current?.n === data.n && !data.ok) pendingMoveRef.current = null;
          setTick((n) => n + 1);
        }
      },
    });
    roomRef.current = room;
    void room.join().then(() => {
      if (seatRef.current === "guest") {
        const g = gameRef.current;
        if (g) room.send({ t: "hello", stock: { ...g.guestStock } } satisfies NetMsg);
      }
    });
    return () => {
      room.close();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [seat, roomCode]);

  const g = gameRef.current;
  const showPlayHud = (kind === "none" || kind === "paused") && !settingsOpen;

  return (
    <div className="game-shell">
      <div className="game-stage">
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="怨霊円陣"
        />
        {!shopOpen && !gachaOpen && !settingsOpen && !codexOpen && <LyricVeil />}
        {(kind === "title" || kind === "fail") && (
          <AuthSlot isPending={isPending} signedIn={!!user} />
        )}
        {seat !== "guest" && kind === "title" && shopOpen && g && (
          <ShopPanel
            g={g}
            tab={shopTab}
            ready={ready}
            onTab={setShopTab}
            onChange={() => setTick((n) => n + 1)}
            onStart={start}
            onTitle={() => setShopOpen(false)}
          />
        )}
        {seat !== "guest" && kind === "title" && gachaOpen && g && (
          <GachaPanel g={g} onChange={() => setTick((n) => n + 1)} onTitle={() => setGachaOpen(false)} />
        )}
        {seat !== "guest" && kind === "title" && !shopOpen && !gachaOpen && (
          <div className="overlay-scrim">
            <div className="overlay-panel enter">
              <div className="display-sub stagger">ONRYO RING</div>
              <h1 className="display-title stagger">怨霊円陣</h1>
              <p className="build-stamp stagger">ビルド {BUILD_STAMP}（日本時間）</p>
              <button type="button" className="cta stagger" onClick={start} disabled={!ready}>
                {ready ? "挑戦する" : "読み込み中"}
              </button>
              <RoomBox
                seat={seat}
                code={roomCode.slice(5)}
                connected={peers.filter((p) => p.connectionState === "connected").length}
                draft={joinDraft}
                note={roomNote}
                onDraft={setJoinDraft}
                onJoin={joinRoom}
                onOpen={openRoom}
                onLeave={leaveRoom}
              />
              <button type="button" className="ghost-btn stagger" onClick={() => { setGachaOpen(false); setShopOpen(true); }}>
                式神強化
              </button>
              <button type="button" className="ghost-btn stagger" onClick={() => { setShopOpen(false); setGachaOpen(true); }}>
                ガチャ
              </button>
              <button type="button" className="ghost-btn stagger" onClick={() => setCodexOpen(true)}>
                図鑑
              </button>
              {!ready && <p className="shimmer stagger">式神を呼び出しています</p>}
              <p className="stat-line stagger">
                {g && g.highWave > 0 ? `最高記録 WAVE ${g.highWave}` : "まだ記録なし"}
              </p>
              <p className="shop-bank stagger">
                所持両 <strong>{g?.bank ?? 0}</strong>
                {g && g.markBank > 0 ? <>　華 <strong>{g.markBank}</strong></> : null}
                {g && (g.shop.atk > 0 || g.shop.spd > 0 || g.shop.coin > 0) ? (
                  <>
                    <br />
                    攻撃 Lv.{g.shop.atk} ／ 速度 Lv.{g.shop.spd} ／ 両 Lv.{g.shop.coin}
                    {shopT1Maxed(g.shop) ? (
                      <>
                        <br />
                        二人目 {g.shop.okiku} ／ 道 {g.shop.path} ／ 基礎 {g.shop.base}
                      </>
                    ) : null}
                    {shopT3Open(g.shop) ? (
                      <>
                        <br />
                        口寄せ {g.shop.seed} ／ 押し戻し {g.shop.back} ／ 輪刃 {g.shop.arms}
                      </>
                    ) : null}
                    {shopT4Open(g.shop) ? (
                      <>
                        <br />
                        足枷 {g.shop.slow} ／ 薄皮 {g.shop.thin} ／ 自動重ね {g.shop.auto ? "解禁" : "—"}
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <br />
                    <span className="shop-hint">円陣を守ると両が貯まる。店で次の挑戦が有利になる。</span>
                  </>
                )}
              </p>
              {g && (
                <div className="title-guests stagger" aria-label="客神">
                  {GUEST_KINDS.map((k) => {
                    const n = g.guestStock[k.id] ?? 0;
                    return (
                      <span key={k.id} className="title-guest" aria-label={`${HEROES[k.id].name} ${n}`}>
                        <img src={`/assets/${k.id}.png`} alt="" width={28} height={28} />
                        <span>{n}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="title-links stagger">
                <a href="/how" className="terms-link">遊び方</a>
                <a href="/terms" className="terms-link">配信規約</a>
              </div>
            </div>
          </div>
        )}
        {seat !== "guest" && kind === "weapon" && g && (
          <WeaponOverlay
            options={g.weaponOptions}
            hexOnly={hexOnly}
            tick={tick}
            onReveal={() => setHexOnly(false)}
            onPick={(id) => {
              chooseWeapon(g, id);
              setKind("none");
            }}
          />
        )}
        {seat !== "guest" && kind === "route" && g && (
          <RouteOverlay
            options={g.routeOptions}
            tick={tick}
            onPick={(i) => {
              chooseRoute(g, i);
              setKind(g.mode === "fail" ? "fail" : "none");
            }}
          />
        )}
        {seat !== "guest" && kind === "warn" && g && (
          <DangerWarn
            onClose={() => {
              setMode(g, "playing");
              setKind("none");
            }}
          />
        )}
        {seat !== "guest" && kind === "clear" && g && (
          <ClearOverlay
            wave={g.wave}
            coins={Math.max(0, Math.floor(g.coins))}
            marks={g.marks}
            onContinue={() => {
              continueClear(g);
              setKind(g.mode === "route" ? "route" : "none");
            }}
            onCashOut={() => {
              cashOutRun(g);
              resetRun(g, true);
              setShopOpen(false);
              setKind("title");
            }}
          />
        )}
        {seat !== "guest" && kind === "fail" && g && (
          <FailOverlay
            wave={g.wave}
            power={g.combatPower}
            earned={g.lastEarned}
            marks={g.lastMarks}
            offerManual={g.playStyle === "active" && !failManual}
            manualOn={failManual}
            onManual={() => {
              setPlayStyle(g, "manual");
              setFailManual(true);
            }}
            onRetry={() => {
              audio.unlockAudio();
              resetRun(g, false);
              setShopOpen(false);
              setKind("none");
            }}
            onShop={() => {
              resetRun(g, true);
              setShopOpen(true);
              setKind("title");
            }}
            onTitle={() => {
              resetRun(g, true);
              setShopOpen(false);
              setKind("title");
            }}
            onCodex={() => setCodexOpen(true)}
          />
        )}
        {seat !== "guest" && kind === "paused" && g && (
          <PauseOverlay
            onResume={() => {
              setMode(g, "playing");
              setKind("none");
            }}
            onTitle={() => {
              resetRun(g, true);
              setKind("title");
            }}
            onCodex={() => setCodexOpen(true)}
          />
        )}
        {seat === "guest" && kind !== "none" && kind !== "clear" && kind !== "warn" && (
          <GuestWait
            code={roomCode.slice(5)}
            hostLinked={peers.some((p) => p.name === "主催" && p.connectionState === "connected")}
            phase={kind === "title" ? "title" : "watch"}
            onLeave={leaveRoom}
          />
        )}
        {showPlayHud && ready && g && (
          <div className="hud-corner">
            {g.itemListOpen && (
              <div className="hud-slips">
                {ITEMS.map((it) => {
                  const left = g.itemT[it.id] ?? 0;
                  const on = left > 0;
                  const price = itemPrice(it.price, g.itemBuys[it.id] ?? 0);
                  const afford = g.coins >= price;
                  const peek = g.itemTap !== "now" && slipPeek === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={`hud-slip${on ? " on" : ""}${peek ? " peek" : ""}`}
                      disabled={g.itemTap === "now" && !on && !afford}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (g.itemTap !== "now" && slipPeek !== it.id) {
                          setSlipPeek(it.id);
                          return;
                        }
                        if (seat === "guest") {
                          if (!linkedRef.current) return;
                          roomRef.current?.send({ t: "item", id: it.id, n: nextNonce() } satisfies NetMsg);
                        } else {
                          buyItem(g, it.id);
                        }
                        setSlipPeek(null);
                        setTick((n) => n + 1);
                      }}
                    >
                      <b>{it.name}</b>
                      <small>{on ? `${Math.ceil(left)}秒` : `${price}両`}</small>
                    </button>
                  );
                })}
              </div>
            )}
            {g.itemListOpen && g.itemTap !== "now" && slipPeek && (
              <p className="hud-slip-note">
                {ITEMS.find((it) => it.id === slipPeek)?.blurb}　もう一度で使う
              </p>
            )}
            <button
              type="button"
              className={`hud-icon slips${g.itemListOpen || ITEMS.some((it) => (g.itemT[it.id] ?? 0) > 0) ? " on" : ""}`}
              aria-expanded={g.itemListOpen}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                g.itemListOpen = !g.itemListOpen;
                if (!g.itemListOpen) setSlipPeek(null);
                setTick((n) => n + 1);
              }}
            >
              札
            </button>
            {seat !== "guest" && (
              <PauseButton
                paused={kind === "paused"}
                onToggle={() => {
                  const game = gameRef.current;
                  if (!game) return;
                  if (game.mode === "playing") {
                    setMode(game, "paused");
                    setKind("paused");
                  } else if (game.mode === "paused") {
                    setMode(game, "playing");
                    setKind("none");
                  }
                }}
              />
            )}
          </div>
        )}
        {showPlayHud && g && !settingsOpen && seat !== "guest" && <DebugDock g={g} onChange={() => setTick((n) => n + 1)} />}
        {showPlayHud && ready && g && g.guestPick && !settingsOpen && (
          <HeroCard g={g} id={g.guestPick} hint={GUEST_HINT} />
        )}
        {seat === "guest" && kind === "none" && (
          <GuestBar linked={linked} code={roomCode.slice(5)} onLeave={leaveRoom} />
        )}
        {showPlayHud && ready && g && !settingsOpen && (
          <div className="hud-guests">
            <button
              type="button"
              className={`hud-mark${g.guestListOpen ? " on" : ""}`}
              aria-label={seat === "guest" ? `客神 ${GUEST_KINDS.reduce((n, k) => n + (g.guestLeft[k.id] ?? 0), 0)}` : `華 ${g.marks}`}
              aria-expanded={g.guestListOpen}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                g.guestListOpen = !g.guestListOpen;
                if (!g.guestListOpen) g.guestPick = null;
                setTick((n) => n + 1);
              }}
            >
              <svg className="mark-flower" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="#e7c8ff">
                  <ellipse cx="12" cy="5.2" rx="3.1" ry="4.2" />
                  <ellipse cx="18.6" cy="9.6" rx="3.1" ry="4.2" transform="rotate(72 18.6 9.6)" />
                  <ellipse cx="16.1" cy="17.2" rx="3.1" ry="4.2" transform="rotate(144 16.1 17.2)" />
                  <ellipse cx="7.9" cy="17.2" rx="3.1" ry="4.2" transform="rotate(216 7.9 17.2)" />
                  <ellipse cx="5.4" cy="9.6" rx="3.1" ry="4.2" transform="rotate(288 5.4 9.6)" />
                </g>
                <circle cx="12" cy="12" r="2.6" fill="#fff4c8" />
              </svg>
              <span className="n">
                {seat === "guest"
                  ? GUEST_KINDS.reduce((n, k) => n + (g.guestLeft[k.id] ?? 0), 0)
                  : g.marks}
              </span>
            </button>
            {g.guestListOpen && (
              <div className="hud-guest-list">
                {GUEST_KINDS.map((kind) => {
                  const left = g.guestLeft[kind.id] ?? 0;
                  const on = g.guestPick === kind.id;
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      className={`hud-icon guest${on ? " on" : ""}`}
                      aria-label={HEROES[kind.id].name}
                      aria-pressed={on}
                      disabled={left <= 0}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (left <= 0) return;
                        g.guestPick = on ? null : kind.id;
                        g.drag = null;
                        g.selectedSlot = null;
                        setTick((n) => n + 1);
                      }}
                    >
                      <img src={`/assets/${kind.id}.png`} alt="" width={32} height={32} />
                      <span className="n">{on ? "マスへ" : HEROES[kind.id].name}</span>
                      <span className="c">{left}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {seat === "host" && kind === "none" && <RoomChip code={roomCode.slice(5)} />}
        {seat !== "guest" && (
          <button
            type="button"
            className="hud-icon settings"
            aria-label="設定"
            aria-pressed={settingsOpen}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((on) => !on);
            }}
          >
            設定
          </button>
        )}
        {!settingsOpen && (
        <button
          type="button"
          className={`hud-icon mute${muted ? " on" : ""}`}
          aria-label={muted ? "音声オン" : "消音"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            audio.unlockAudio();
            toggleMute();
          }}
        >
          {muted ? "消音" : "音声"}
        </button>
        )}
        {seat !== "guest" && settingsOpen && g && (
          <SettingsPanel
            g={g}
            tutorialOn={tutorialOn}
            tutorialMode={tutorialMode}
            onTutorial={(on) => {
              setTutorialShow(on);
              setTutorialOn(on);
              setTutorialMode(on ? "on" : "off");
            }}
            onReplayTutorial={() => {
              setSettingsOpen(false);
              const game = gameRef.current;
              if (!game) return;
              if (game.mode === "title" || game.mode === "fail" || game.demo) {
                openRun(true);
                return;
              }
              startLesson(game);
              setLesson("move");
            }}
            onClose={() => setSettingsOpen(false)}
            onChange={() => setTick((n) => n + 1)}
          />
        )}
        {codexOpen && g && <CodexPanel g={g} onClose={() => setCodexOpen(false)} />}
        {roomHelp && seat === "host" && kind === "title" && !shopOpen && !gachaOpen && !settingsOpen && (
          <RoomOpened code={roomCode.slice(5)} onClose={() => setRoomHelp(false)} />
        )}
        {lesson && seat !== "guest" && !settingsOpen && kind !== "title" && kind !== "fail" && kind !== "clear" && kind !== "warn" && (
          <LessonBar step={lesson} onSkip={skipLesson} />
        )}
      </div>
    </div>
  );
}

function LyricVeil() {
  const [line, setLine] = useState("");
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = lyricAt(audio.themeTime());
      setLine((cur) => (cur === next ? cur : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!line) return null;
  return (
    <div className="lyric-veil" aria-hidden>
      <p>{line}</p>
    </div>
  );
}

const THEME_LYRICS: Array<{ t: number; line: string }> = [
  { t: 16, line: "畳の上で指でなぞるは" },
  { t: 19.5, line: "解ける檻がまた結び" },
  { t: 23, line: "直す　赤の裏地に月が落ちてる" },
  { t: 27, line: "笑った" },
  { t: 30, line: "ままの秘密が揺れる" },
  { t: 34, line: "あの女をゴールさせない" },
  { t: 38, line: "ために武器を振り上げろ" },
  { t: 42, line: "息を" },
  { t: 45, line: "潜めて足音を消して" },
  { t: 48.5, line: "その背中まであと少し" },
  { t: 52, line: "だろう" },
  { t: 60, line: "" },
  { t: 76, line: "指先一つで運命を" },
  { t: 84, line: "痛みを潜めて足音を消して" },
  { t: 93, line: "その" },
  { t: 100, line: "" },
  { t: 117, line: "背中まであと少しだろう" },
  { t: 120.5, line: "指先一つで運命を" },
  { t: 124, line: "裂いて　今夜だけはまだ終わらせない" },
  { t: 133, line: "まだ生かせない　まだ生かせない" },
  { t: 136, line: "赤のうなじが燃えてる" },
  { t: 138.2, line: "まだ生かせない　まだ生かせない" },
  { t: 140, line: "この手で闇を止める" },
  { t: 148, line: "" },
  { t: 163, line: "花びらみたいに散るのが罪なら" },
  { t: 166.5, line: "この胸ごと盾にして" },
  { t: 170, line: "やる　月が見ている" },
  { t: 177, line: "隠しきれない名前も傷も抱えて進め" },
  { t: 185, line: "まだ行かせない　まだ行かせない" },
  { t: 187.5, line: "赤のうなじが燃えてる" },
  { t: 190, line: "まだ行かせない　まだ行かせない" },
  { t: 192, line: "この手で闇を問う" },
  { t: 194.5, line: "まだ行かせない　まだ行かせない" },
  { t: 196.5, line: "朝が来るまで守る" },
  { t: 199, line: "まだ行かせない　まだ行かせない" },
  { t: 202, line: "あの葉には渡させない" },
  { t: 208, line: "ああ…" },
  { t: 220, line: "" },
];

function lyricAt(t: number): string {
  if (t < 0) return "";
  let line = "";
  for (const row of THEME_LYRICS) {
    if (t < row.t) break;
    line = row.line;
  }
  return line;
}

function overlayOf(g: Game): OverlayKind {
  if (g.mode === "title") return "title";
  if (g.mode === "weapon") return "weapon";
  if (g.mode === "buff") return "buff";
  if (g.mode === "route") return "route";
  if (g.mode === "fail") return "fail";
  if (g.mode === "clear") return "clear";
  if (g.mode === "warn") return "warn";
  if (g.mode === "paused") return "paused";
  return "none";
}

function AuthSlot({ isPending, signedIn }: { isPending: boolean; signedIn: boolean }) {
  if (isPending) {
    return <div className="auth-slot shimmer">照合しています</div>;
  }
  if (signedIn) {
    return (
      <div className="auth-slot">
        <UserButton />
      </div>
    );
  }
  return (
    <div className="auth-slot">
      <a href="/login" className="terms-link">
        Googleで保存
      </a>
    </div>
  );
}
