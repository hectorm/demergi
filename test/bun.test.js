import { describe, it } from "bun:test";
import assert from "node:assert/strict";

globalThis.runtime = "bun";
globalThis.describe = describe;
globalThis.it = it;
globalThis.itIf = (condition) => (condition ? it : it.skip);
globalThis.assert = assert;

await import("./base.lru.test.js");
await import("./base.proxy.test.js");
await import("./base.resolver.test.js");
