import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authMode,
  createSessionToken,
  passcodeMatches,
  safeEqual,
  safeNextPath,
  verifySessionToken,
} from "../src/lib/auth";

function withEnv(patch: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const saved = Object.fromEntries(Object.keys(patch).map((key) => [key, process.env[key]]));
  const env = process.env as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });
}

test("production without a passcode refuses to run open unless explicitly allowed", () =>
  withEnv({ NODE_ENV: "production", APP_PASSCODE: undefined, ALLOW_OPEN_ACCESS: undefined }, async () => {
    assert.equal(authMode(), "misconfigured");
    await withEnv({ ALLOW_OPEN_ACCESS: "true" }, () => assert.equal(authMode(), "open"));
    await withEnv({ APP_PASSCODE: "river" }, () => assert.equal(authMode(), "passcode"));
  }));

test("development stays open when no passcode is set", () =>
  withEnv({ NODE_ENV: "development", APP_PASSCODE: undefined }, () => assert.equal(authMode(), "open")));

test("session tokens verify, expire and die when the passcode changes", () =>
  withEnv({ APP_PASSCODE: "full-house", AUTH_SECRET: "s3cret" }, async () => {
    const now = Date.now();
    const token = await createSessionToken(now);
    assert.equal(await verifySessionToken(token, now), true);
    assert.equal(await verifySessionToken(token, now + 31 * 24 * 60 * 60 * 1000), false, "expired");
    const [expires, signature] = token.split(".");
    assert.equal(await verifySessionToken(`${Number(expires) + 1}.${signature}`, now), false, "tampered expiry");
    assert.equal(await verifySessionToken(`${expires}.${"0".repeat(signature.length)}`, now), false, "forged signature");
    for (const junk of [undefined, "", "abc", "123.", ".abc", "12x.abc"]) assert.equal(await verifySessionToken(junk, now), false);
    await withEnv({ APP_PASSCODE: "flush" }, async () => assert.equal(await verifySessionToken(token, now), false, "rotated passcode"));
  }));

test("passcode comparison is exact", () =>
  withEnv({ APP_PASSCODE: "Aces-99" }, () => {
    assert.equal(passcodeMatches("Aces-99"), true);
    for (const wrong of ["aces-99", "Aces-9", "Aces-999", "", " Aces-99"]) assert.equal(passcodeMatches(wrong), false);
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abd"), false);
  }));

test("post-unlock redirects never leave the site", () => {
  assert.equal(safeNextPath("/games/abc?x=1"), "/games/abc?x=1");
  for (const hostile of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "", null, undefined, "/unlock?next=/x"]) {
    assert.equal(safeNextPath(hostile), "/");
  }
});
