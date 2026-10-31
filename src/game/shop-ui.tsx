/*
  店の行と図鑑。買う処理は buyShop / buyGuest。
  客に店を出すかは親が seat で決める。P2P は持たない。
*/
import { useState } from "react";
import { HeroCard } from "./DebugPanel";
import {
  GUEST_KINDS,
  HEROES,
  ROSTER_IDS,
  SHOP_ITEMS,
  SHOP_T2_ITEMS,
  SHOP_T3_ITEMS,
  SHOP_T4_ITEMS,
  SHOP_T3_SPEND,
  SHOP_T4_SPEND,
  shopCost,
  shopMax,
  shopT1Maxed,
  shopT2Spent,
  shopT3Open,
  shopT3Spent,
  shopT4Open,
  shopValue,
  guestSlipCost,
} from "./data";
import { buyGuest, nudgeGuest } from "./guests";
import { buyShop } from "./picks";
import { debugNudge, type DebugField } from "./sim";
import type { Game, HeroId, ShopId } from "./types";

const SHOP_DEBUG_FIELD: Record<ShopId, DebugField> = {
  atk: "shopAtk",
  spd: "shopSpd",
  coin: "shopCoin",
  okiku: "shopOkiku",
  path: "shopPath",
  base: "shopBase",
  seed: "shopSeed",
  back: "shopBack",
  arms: "shopArms",
  slow: "shopSlow",
  thin: "shopThin",
  auto: "shopAuto",
};

export function ShopPanel({
  g,
  tab,
  ready,
  onTab,
  onChange,
  onStart,
  onTitle,
}: {
  g: Game;
  tab: "base" | "guest";
  ready: boolean;
  onTab: (tab: "base" | "guest") => void;
  onChange: () => void;
  onStart: () => void;
  onTitle: () => void;
}) {
  return (
    <div className="overlay-scrim is-shop">
      <div className="overlay-panel enter shop-panel">
        <div className="shop-head">
          <div className="shop-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "base"}
              className={tab === "base" ? "on" : ""}
              onClick={() => onTab("base")}
            >
              基礎強化
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "guest"}
              className={tab === "guest" ? "on" : ""}
              onClick={() => onTab("guest")}
            >
              侵食の客
            </button>
          </div>
          {g.lastEarned > 0 && <p className="shop-gain stagger">今回獲得 +{g.lastEarned} 両</p>}
          {g.lastMarks > 0 && <p className="shop-gain stagger">今回華 +{g.lastMarks}</p>}
          <p className="shop-bank stagger">
            所持両 <strong>{g.bank}</strong>
            　華 <strong>{g.markBank}</strong>
            {g.debug && (
              <span className="debug-step inline">
                <button type="button" onClick={() => { debugNudge(g, "bank", -1); onChange(); }}>−</button>
                <button type="button" onClick={() => { debugNudge(g, "bank", 1); onChange(); }}>＋</button>
              </span>
            )}
          </p>
          {tab === "base" && g.bank <= 0 && g.lastEarned <= 0 && (
            <p className="shop-hint stagger">両がありません。ランで稼ぐと強化できます。</p>
          )}
          {tab === "guest" && (
            <p className="shop-hint stagger">在庫は、その客神の札だけで増える。最初の1体は3枚、次から3倍。</p>
          )}
        </div>
        <div className="shop-scroll">
          {tab === "guest" ? (
            <div className="shop-list">
              {GUEST_KINDS.map((kind) => (
                <GuestRow key={kind.id} g={g} id={kind.id} onChange={onChange} />
              ))}
            </div>
          ) : (
            <>
              <div className="shop-list">
                {SHOP_ITEMS.map((item) => (
                  <ShopRow key={item.id} g={g} id={item.id} name={item.name} desc={item.desc} onChange={onChange} />
                ))}
              </div>
              {(shopT1Maxed(g.shop) || g.debug) && (
                <>
                  <div className="ribbon">二の強化</div>
                  <p className="shop-hint">
                    消費 {shopT2Spent(g.shop).toLocaleString("ja-JP")} / {SHOP_T3_SPEND.toLocaleString("ja-JP")} 両。全部 Lv.2 以上で三の強化。
                  </p>
                  <div className="shop-list">
                    {SHOP_T2_ITEMS.map((item) => (
                      <ShopRow key={item.id} g={g} id={item.id} name={item.name} desc={item.desc} onChange={onChange} />
                    ))}
                  </div>
                </>
              )}
              {(shopT3Open(g.shop) || g.debug) && (
                <>
                  <div className="ribbon">三の強化</div>
                  <p className="shop-hint">
                    消費 {shopT3Spent(g.shop).toLocaleString("ja-JP")} / {SHOP_T4_SPEND.toLocaleString("ja-JP")} 両。全部 Lv.2 以上で四の強化。
                  </p>
                  <div className="shop-list">
                    {SHOP_T3_ITEMS.map((item) => (
                      <ShopRow key={item.id} g={g} id={item.id} name={item.name} desc={item.desc} onChange={onChange} />
                    ))}
                  </div>
                </>
              )}
              {(shopT4Open(g.shop) || g.debug) && (
                <>
                  <div className="ribbon">四の強化</div>
                  <p className="shop-hint">足枷・薄皮・自動重ね。三の強化を深く買った先。</p>
                  <div className="shop-list">
                    {SHOP_T4_ITEMS.map((item) => (
                      <ShopRow key={item.id} g={g} id={item.id} name={item.name} desc={item.desc} onChange={onChange} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="shop-foot">
          <button type="button" className="cta stagger" onClick={onStart} disabled={!ready}>
            次の挑戦
          </button>
          <button type="button" className="ghost-btn stagger" onClick={onTitle}>
            タイトルへ
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopRow({
  g,
  id,
  name,
  desc,
  onChange,
}: {
  g: Game;
  id: ShopId;
  name: string;
  desc: string;
  onChange: () => void;
}) {
  const lv = g.shop[id];
  const cost = shopCost(id, lv);
  const maxed = lv >= shopMax(id);
  const can = !maxed && g.bank >= cost;
  return (
    <div className="shop-row stagger">
      <div className="shop-copy">
        <div className="nm">{name}</div>
        <div className="lv">
          Lv.{lv} → 現在 {shopValue(id, lv)}
        </div>
        <div className="st">{desc}</div>
      </div>
      <button
        type="button"
        className="shop-buy"
        disabled={!can}
        onClick={() => {
          if (buyShop(g, id)) onChange();
        }}
      >
        {maxed ? "最大" : `${cost.toLocaleString("ja-JP")} 両`}
      </button>
      {g.debug && (
        <div className="debug-step">
          <button type="button" onClick={() => { debugNudge(g, SHOP_DEBUG_FIELD[id], -1); onChange(); }}>−</button>
          <button type="button" onClick={() => { debugNudge(g, SHOP_DEBUG_FIELD[id], 1); onChange(); }}>＋</button>
        </div>
      )}
    </div>
  );
}

export function GuestRow({ g, id, onChange }: { g: Game; id: HeroId; onChange: () => void }) {
  const kind = GUEST_KINDS.find((k) => k.id === id)!;
  const n = g.guestStock[id] ?? 0;
  const slips = g.guestGrowth[id]?.slips ?? 0;
  const price = guestSlipCost(kind, n);
  const maxed = n >= kind.max;
  const can = !maxed && slips >= price;
  const hero = HEROES[id];
  return (
    <div className="shop-row stagger">
      <img src={`/assets/${id}.png`} alt="" width={48} height={48} className="guest-face" />
      <div className="shop-copy">
        <div className="nm">{hero.name}</div>
        <div className="lv">在庫 {n}/{kind.max}　札 {slips}</div>
      </div>
      <button
        type="button"
        className="shop-buy"
        disabled={!can}
        onClick={() => {
          if (buyGuest(g, id)) onChange();
        }}
      >
        {maxed ? "最大" : `${price.toLocaleString("ja-JP")} 札`}
      </button>
      {g.debug && (
        <div className="debug-step">
          <button type="button" onClick={() => { nudgeGuest(g, id, -1); onChange(); }}>−</button>
          <button type="button" onClick={() => { nudgeGuest(g, id, 1); onChange(); }}>＋</button>
        </div>
      )}
    </div>
  );
}

export function CodexPanel({ g, onClose }: { g: Game; onClose: () => void }) {
  const [face, setFace] = useState<HeroId>("okiku");
  return (
    <div className="overlay-scrim is-shop">
      <div className="overlay-panel enter shop-panel">
        <div className="shop-head">
          <div className="ribbon stagger">図鑑</div>
          <p className="shop-hint stagger">顔を選ぶと、肩書と性能が出る。</p>
        </div>
        <div className="shop-scroll">
          <div className="hero-faces stagger">
            {ROSTER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`hero-face${face === id ? " on" : ""}`}
                onClick={() => setFace(id)}
              >
                <img src={`/assets/${id}.png`} alt="" width={48} height={48} />
                <span>{HEROES[id].name}</span>
              </button>
            ))}
          </div>
          <HeroCard g={g} id={face} inPanel />
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
