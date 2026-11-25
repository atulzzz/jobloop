import test from "node:test";
import assert from "node:assert/strict";
import {
  AppError,
  ErrorCodes,
  normalizeUrl,
  sanitizeBounds,
  toPublicError
} from "./validation.mjs";
import fs from "node:fs";
import { sanitizePageText } from "./page-sanitizer.mjs";

test("normalizeUrl adds HTTPS to a bare host", () => {
  assert.equal(normalizeUrl("example.com/jobs"), "https://example.com/jobs");
});

test("normalizeUrl preserves supported URLs", () => {
  assert.equal(
    normalizeUrl("http://localhost:3000/path?q=1"),
    "http://localhost:3000/path?q=1"
  );
});

test("normalizeUrl rejects empty and unsupported protocols", () => {
  assert.throws(
    () => normalizeUrl(""),
    (error) =>
      error instanceof AppError && error.code === ErrorCodes.INVALID_URL
  );
  assert.throws(
    () => normalizeUrl("javascript:alert(1)"),
    (error) =>
      error instanceof AppError && error.code === ErrorCodes.INVALID_URL
  );
});

test("normalizeUrl rejects oversized URLs", () => {
  assert.throws(
    () => normalizeUrl(`https://example.com/${"a".repeat(2048)}`),
    (error) =>
      error instanceof AppError && error.code === ErrorCodes.INVALID_URL
  );
});

test("sanitizeBounds clamps bounds to the viewport", () => {
  assert.deepEqual(
    sanitizeBounds(
      { x: 40, y: 50, width: 1000, height: 900 },
      { width: 800, height: 600 }
    ),
    { x: 40, y: 50, width: 760, height: 550 }
  );
});

test("sanitizeBounds rejects invalid dimensions", () => {
  assert.throws(
    () =>
      sanitizeBounds(
        { x: 0, y: 0, width: 0, height: 500 },
        { width: 800, height: 600 }
      ),
    (error) =>
      error instanceof AppError && error.code === ErrorCodes.INVALID_BOUNDS
  );
});

test("toPublicError does not expose internal error messages", () => {
  assert.deepEqual(toPublicError(new Error("secret path")), {
    code: ErrorCodes.INTERNAL_ERROR,
    message: "发生了未预期的内部错误。"
  });
});

test("sandboxed preload channel names match the shared contract", () => {
  const sharedChannels = JSON.parse(
    fs.readFileSync(new URL("../shared/ipc-channels.json", import.meta.url))
  );
  const preloadSource = fs.readFileSync(
    new URL("./preload.cjs", import.meta.url),
    "utf8"
  );

  for (const channel of Object.values(sharedChannels)) {
    assert.equal(
      preloadSource.includes(`\"${channel}\"`),
      true,
      `Preload is missing channel ${channel}`
    );
  }
});

test("sanitizePageText removes private-use salary glyphs", () => {
  const result = sanitizePageText("岗位：前端\n-K·薪\n地点：深圳");

  assert.equal(result.privateUseCharacterCount, 6);
  assert.equal(result.salaryObfuscated, true);
  assert.equal(result.text.includes(""), false);
  assert.match(result.text, /薪资：页面使用防抓取字符，需人工确认/);
});

test("sanitizePageText keeps ordinary visible text", () => {
  const result = sanitizePageText("35-65K·16薪\n深圳");

  assert.deepEqual(result, {
    text: "35-65K·16薪\n深圳",
    privateUseCharacterCount: 0,
    salaryObfuscated: false
  });
});
