const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getAppEnv,
  createLocalDbStub,
  CONFLICT_POLICY,
} = require("../src/index.js");

test("getAppEnv returns a known tier", () => {
  const env = getAppEnv();
  assert.ok(["development", "staging", "production"].includes(env));
});

test("createLocalDbStub queues operations", () => {
  const db = createLocalDbStub();
  db.enqueue({ type: "noop" });
  assert.equal(db.pending().length, 1);
});

test("CONFLICT_POLICY is frozen at top level", () => {
  assert.throws(() => {
    "use strict";
    CONFLICT_POLICY.simpleFields = "mutate";
  }, TypeError);
});
