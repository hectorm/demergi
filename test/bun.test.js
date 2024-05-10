import { describe, it } from "bun:test";
import assert from "node:assert/strict";

globalThis.describe = describe;
globalThis.it = it;
globalThis.itIf = (condition) => (condition ? it : it.skip);
globalThis.assert = assert;
globalThis.isBun = typeof Bun !== "undefined";

await import("./base.lru.test.js");
await import("./base.proxy.test.js");
await import("./base.resolver.test.js");
