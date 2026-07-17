/* QR 왕복 검증: 생성된 qr/*.png 를 실제 디코더(jsQR)로 읽어
   원래 토큰 → 올바른 지점으로 해석되는지 확인.
   물리 체인(인쇄→스캔→앱)의 정확성을 보장한다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PNG } from "pngjs";
import { buildTokenMap, resolveToken } from "../src/tokens.js";
import { CONTENT } from "../src/content.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// jsQR(UMD)을 격리 실행해 로드 (브라우저 <script> 태그와 동일 경로)
function loadJsQR() {
  const src = fs.readFileSync(path.join(ROOT, "vendor/jsqr.js"), "utf8");
  const sandbox = { window: {} };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.jsQR;
}
function decode(file) {
  const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, "qr", file)));
  const code = loadJsQR()(new Uint8ClampedArray(png.data), png.width, png.height);
  return code?.data;
}

const map = buildTokenMap(CONTENT);

test("각 지점 QR이 올바른 토큰→지점으로 디코드된다", () => {
  const expect = [
    ["NSM-01.png", "NSM-01", 0],
    ["NSM-02.png", "NSM-02", 1],
    ["NSM-03.png", "NSM-03", 2],
    ["NSM-04.png", "NSM-04", 3],
    ["NSM-05.png", "NSM-05", "finale"],
  ];
  for (const [file, token, stage] of expect) {
    const decoded = decode(file);
    assert.equal(decoded, token, `${file} 디코드`);
    const r = resolveToken(decoded, map);
    assert.equal(r.ok, true);
    assert.deepEqual(r.stage, stage, `${token} → ${JSON.stringify(stage)}`);
  }
});

test("시작 QR은 배포 URL(https)을 담는다", () => {
  const decoded = decode("START.png");
  assert.match(decoded, /^https:\/\//);
});
