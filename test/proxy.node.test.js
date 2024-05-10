import { describe, it } from "node:test";
import assert from "node:assert/strict";

globalThis.describe = describe;
globalThis.it = it;
globalThis.itIf = (condition) => (condition ? it : it.skip);
globalThis.assert = assert;
globalThis.isBun = typeof Bun !== "undefined";

await import("./proxy.base.test.js");
