import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bearerMatches, cloudFromWire, migrateOrigin } from "./migrate-guard.ts";

describe("migrate api", () => {
  it("accepts only the same bearer secret", () => {
    assert.equal(bearerMatches("Bearer secret-key", "secret-key"), true);
    assert.equal(bearerMatches("bearer secret-key", "secret-key"), true);
    assert.equal(bearerMatches("Bearer other-key!", "secret-key"), false);
    assert.equal(bearerMatches(null, "secret-key"), false);
    assert.equal(bearerMatches("Bearer secret-key", ""), false);
  });

  it("keeps only an https origin", () => {
    assert.equal(migrateOrigin("https://swift-beam-river-bird.grok.me/api")?.origin, "https://swift-beam-river-bird.grok.me");
    assert.equal(migrateOrigin("http://swift-beam-river-bird.grok.me"), null);
    assert.equal(migrateOrigin("https://user:pw@evil.example"), null);
    assert.equal(migrateOrigin(""), null);
  });

  it("drops fields that are not a save", () => {
    const save = cloudFromWire({ highWave: 4, bank: 12.9, markBank: -3, shop: { atk: 2 }, extra: 99999 });
    assert.equal(save?.highWave, 4);
    assert.equal(save?.bank, 12);
    assert.equal(save?.markBank, 0);
    assert.equal(save?.shop.atk, 2);
    assert.equal(cloudFromWire({ bank: 1 }), null);
  });
});
