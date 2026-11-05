import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { readGuestStock, mergeGuestStock, readGuestGrowth, mergeGuestGrowth, readShop } from "@/game/data";
import type { GuestGrowthBook, GuestStock, ShopUpgrades } from "@/game/types";

export type CloudMeta = {
  highWave: number;
  bank: number;
  markBank: number;
  guestStock: GuestStock;
  guestGrowth: GuestGrowthBook;
  shop: ShopUpgrades;
};

export const loadCloudSave = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      high_wave: number;
      bank: number;
      shop_atk: number;
      shop_spd: number;
      shop_coin: number;
      shop_okiku: number;
      shop_path: number;
      shop_base: number;
      shop_seed: number;
      shop_back: number;
      shop_arms: number;
      shop_slow: number;
      shop_thin: number;
      shop_auto: number;
      mark_bank: number;
      guest_bank: number;
      guest_stock: unknown;
      items: unknown;
    }>`select high_wave, bank, mark_bank, guest_bank, guest_stock, items, shop_atk, shop_spd, shop_coin, shop_okiku, shop_path, shop_base, shop_seed, shop_back, shop_arms, shop_slow, shop_thin, shop_auto from player_saves where user_id = ${context.userId} limit 1`;
    const row = rows[0];
    if (!row) return null;
    return {
      highWave: row.high_wave,
      bank: row.bank,
      markBank: row.mark_bank ?? 0,
      guestStock: readGuestStock(row.guest_stock, row.guest_bank ?? 2),
      guestGrowth: readGuestGrowth(row.items),
      shop: readShop({
        atk: row.shop_atk,
        spd: row.shop_spd,
        coin: row.shop_coin,
        okiku: row.shop_okiku,
        path: row.shop_path,
        base: row.shop_base,
        seed: row.shop_seed,
        back: row.shop_back,
        arms: row.shop_arms,
        slow: row.shop_slow,
        thin: row.shop_thin,
        auto: row.shop_auto,
      }),
    } satisfies CloudMeta;
  });

export const putCloudSave = createServerFn({ method: "POST" })
  .validator((data: CloudMeta) => data)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const shop = readShop(data.shop);
    const sql = await getSql();
    const prev = await sql<{ guest_bank: number; guest_stock: unknown; items: unknown }>`
      select guest_bank, guest_stock, items from player_saves where user_id = ${context.userId} limit 1
    `;
    const row = prev[0];
    const stock = mergeGuestStock(
      row ? readGuestStock(row.guest_stock, row.guest_bank) : {},
      readGuestStock(data.guestStock),
    );
    const growth = mergeGuestGrowth(
      readGuestGrowth(row?.items),
      readGuestGrowth(data.guestGrowth),
    );
    const shion = stock.shion ?? 0;
    await sql`
      insert into player_saves (user_id, high_wave, bank, mark_bank, guest_bank, guest_stock, items, shop_atk, shop_spd, shop_coin, shop_okiku, shop_path, shop_base, shop_seed, shop_back, shop_arms, shop_slow, shop_thin, shop_auto, updated_at)
      values (${context.userId}, ${data.highWave}, ${data.bank}, ${data.markBank}, ${shion}, ${JSON.stringify(stock)}::jsonb, ${JSON.stringify(growth)}::jsonb, ${shop.atk}, ${shop.spd}, ${shop.coin}, ${shop.okiku}, ${shop.path}, ${shop.base}, ${shop.seed}, ${shop.back}, ${shop.arms}, ${shop.slow}, ${shop.thin}, ${shop.auto}, now())
      on conflict (user_id) do update set
        high_wave = greatest(player_saves.high_wave, excluded.high_wave),
        bank = excluded.bank,
        mark_bank = greatest(player_saves.mark_bank, excluded.mark_bank),
        guest_bank = greatest(player_saves.guest_bank, excluded.guest_bank),
        guest_stock = excluded.guest_stock,
        items = excluded.items,
        shop_atk = greatest(player_saves.shop_atk, excluded.shop_atk),
        shop_spd = greatest(player_saves.shop_spd, excluded.shop_spd),
        shop_coin = greatest(player_saves.shop_coin, excluded.shop_coin),
        shop_okiku = greatest(player_saves.shop_okiku, excluded.shop_okiku),
        shop_path = greatest(player_saves.shop_path, excluded.shop_path),
        shop_base = greatest(player_saves.shop_base, excluded.shop_base),
        shop_seed = greatest(player_saves.shop_seed, excluded.shop_seed),
        shop_back = greatest(player_saves.shop_back, excluded.shop_back),
        shop_arms = greatest(player_saves.shop_arms, excluded.shop_arms),
        shop_slow = greatest(player_saves.shop_slow, excluded.shop_slow),
        shop_thin = greatest(player_saves.shop_thin, excluded.shop_thin),
        shop_auto = greatest(player_saves.shop_auto, excluded.shop_auto),
        updated_at = now()
    `;
    return true;
  });

/** 引継ぎだけ。所持両も大きい方を残す。ブラウザから来た数は渡さない。 */
export async function mergeCloudSave(userId: string, data: CloudMeta): Promise<void> {
  const shop = readShop(data.shop);
  const sql = await getSql();
  const prev = await sql<{ guest_bank: number; guest_stock: unknown; items: unknown }>`
    select guest_bank, guest_stock, items from player_saves where user_id = ${userId} limit 1
  `;
  const row = prev[0];
  const stock = mergeGuestStock(
    row ? readGuestStock(row.guest_stock, row.guest_bank) : {},
    readGuestStock(data.guestStock),
  );
  const growth = mergeGuestGrowth(readGuestGrowth(row?.items), readGuestGrowth(data.guestGrowth));
  const shion = stock.shion ?? 0;
  await sql`
    insert into player_saves (user_id, high_wave, bank, mark_bank, guest_bank, guest_stock, items, shop_atk, shop_spd, shop_coin, shop_okiku, shop_path, shop_base, shop_seed, shop_back, shop_arms, shop_slow, shop_thin, shop_auto, updated_at)
    values (${userId}, ${data.highWave}, ${data.bank}, ${data.markBank}, ${shion}, ${JSON.stringify(stock)}::jsonb, ${JSON.stringify(growth)}::jsonb, ${shop.atk}, ${shop.spd}, ${shop.coin}, ${shop.okiku}, ${shop.path}, ${shop.base}, ${shop.seed}, ${shop.back}, ${shop.arms}, ${shop.slow}, ${shop.thin}, ${shop.auto}, now())
    on conflict (user_id) do update set
      high_wave = greatest(player_saves.high_wave, excluded.high_wave),
      bank = greatest(player_saves.bank, excluded.bank),
      mark_bank = greatest(player_saves.mark_bank, excluded.mark_bank),
      guest_bank = greatest(player_saves.guest_bank, excluded.guest_bank),
      guest_stock = excluded.guest_stock,
      items = excluded.items,
      shop_atk = greatest(player_saves.shop_atk, excluded.shop_atk),
      shop_spd = greatest(player_saves.shop_spd, excluded.shop_spd),
      shop_coin = greatest(player_saves.shop_coin, excluded.shop_coin),
      shop_okiku = greatest(player_saves.shop_okiku, excluded.shop_okiku),
      shop_path = greatest(player_saves.shop_path, excluded.shop_path),
      shop_base = greatest(player_saves.shop_base, excluded.shop_base),
      shop_seed = greatest(player_saves.shop_seed, excluded.shop_seed),
      shop_back = greatest(player_saves.shop_back, excluded.shop_back),
      shop_arms = greatest(player_saves.shop_arms, excluded.shop_arms),
      shop_slow = greatest(player_saves.shop_slow, excluded.shop_slow),
      shop_thin = greatest(player_saves.shop_thin, excluded.shop_thin),
      shop_auto = greatest(player_saves.shop_auto, excluded.shop_auto),
      updated_at = now()
  `;
}
