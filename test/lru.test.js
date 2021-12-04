import { LRU } from "../src/lru.js";

describe("LRU", () => {
  test("Must have specific defaults", () => {
    const defaults = new LRU();

    expect(defaults.size).toBe(0);
    expect(defaults.max).toBe(-1);
  });

  test("Must set and get an entry", () => {
    const lru = new LRU();

    lru.set("key", "value");

    const value = lru.get("key");
    expect(value).toBe("value");
  });

  test("Must set and delete an entry", () => {
    const lru = new LRU();

    lru.set("key", "value");

    const deleted = lru.delete("key");
    expect(deleted).toBe("value");

    const unexistent = lru.get("key");
    expect(unexistent).toBeUndefined();
  });

  test("Must have a size and max properties", () => {
    const lru = new LRU(3);

    lru.set("key1", "value1");
    lru.set("key2", "value2");
    lru.set("key3", "value3");
    lru.set("key4", "value4");
    lru.delete("key3");
    lru.delete("key4");

    expect(lru.size).toBe(1);
    expect(lru.max).toBe(3);
  });

  test("Must evict old entries", () => {
    const lru = new LRU(2);

    lru.set("key1", "value1");
    lru.set("key2", "value2");
    lru.set("key3", "value3");

    const value = lru.get("key1");
    expect(value).toBeUndefined();
  });

  test("Must discard expired entries", async () => {
    const lru = new LRU(5);

    lru.set("key1", "value1", 2);
    lru.set("key2", "value2", 1);
    await new Promise((r) => setTimeout(r, 1100));

    const value1 = lru.get("key1");
    expect(value1).toBe("value1");

    const value2 = lru.get("key2");
    expect(value2).toBeUndefined();
  });

  test("Must be iterable", () => {
    const lru = new LRU(2);

    lru.set("key1", "value1");
    lru.set("key2", "value2");
    lru.set("key3", "value3");

    const values = [...lru];
    expect(values).toStrictEqual(["value3", "value2"]);
  });
});
