/* global describe, it, assert */

import { LRU } from "../src/lru.js";

describe("LRU", () => {
  it("Must have specific defaults", () => {
    const defaults = new LRU();

    assert(defaults.size === 0);
    assert(defaults.max === -1);
  });

  it("Must set and get an entry", () => {
    const lru = new LRU();

    lru.set("key", "value");

    const value = lru.get("key");
    assert(value === "value");
  });

  it("Must set and delete an entry", () => {
    const lru = new LRU();

    lru.set("key", "value");

    const deleted = lru.delete("key");
    assert(deleted === "value");

    const unexistent = lru.get("key");
    assert(unexistent === undefined);
  });

  it("Must have a size and max properties", () => {
    const lru = new LRU(3);

    lru.set("key1", "value1");
    lru.set("key2", "value2");
    lru.set("key3", "value3");
    lru.set("key4", "value4");
    lru.delete("key3");
    lru.delete("key4");

    assert(lru.size === 1);
    assert(lru.max === 3);
  });

  it("Must evict old entries", () => {
    const lru = new LRU(2);

    lru.set("key1", "value1");
    lru.set("key2", "value2");
    lru.set("key3", "value3");

    const value = lru.get("key1");
    assert(value === undefined);
  });

  it("Must discard expired entries", async () => {
    const lru = new LRU(5);

    lru.set("key1", "value1", 2);
    lru.set("key2", "value2", 1);
    await new Promise((r) => setTimeout(r, 1100));

    const value1 = lru.get("key1");
    assert(value1 === "value1");

    const value2 = lru.get("key2");
    assert(value2 === undefined);
  });

  it("Must be iterable", () => {
    const lru = new LRU(2);

    lru.set("key1", "value1");
    lru.set("key2", "value2");
    lru.set("key3", "value3");

    const values = [...lru];
    assert.deepStrictEqual(values, ["value3", "value2"]);
  });
});
