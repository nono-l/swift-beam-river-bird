/*
  設定の「前のドメインから引継ぐ」が呼ぶ。中身は migrate.server。
  クライアントはメールも数字も送らない。
*/
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { MigrateResult } from "./migrate.server";

export const pullPreviousSave = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MigrateResult> => {
    const { pullPrevious } = await import("./migrate.server");
    return pullPrevious(context.userId);
  });
