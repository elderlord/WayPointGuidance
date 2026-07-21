/* =========================================================================
   테스트용 QR 시트(PDF) 생성 — 첨부 양식(라벨 붙은 QR 그리드, A4 가로) 참고.
   qr/*.png(생성기가 만든 토큰/URL QR)을 라벨·캡션과 함께 한 장에 배치.
   시작(배포 URL) + 각 지점(NSM-0X). 지점 수는 content.js에서 자동 반영.

   선행: node tools/generate-qr.mjs (qr/ PNG 생성)
   사용: node tools/generate-qr-sheet.mjs
   출력: docs/qr-test-sheet.pdf, docs/qr-test-sheet.png(미리보기)
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CONTENT } from "../src/content.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXEC = process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const b64 = (p) => fs.readFileSync(path.join(ROOT, p)).toString("base64");
const img = (file) => `data:image/png;base64,${b64(path.join("qr", file))}`;

// 셀 구성: 시작 + 노드들 + 클라이맥스
const cells = [{ label: "시작", cap: "앱 시작 · URL", src: img("START.png") }];
CONTENT.nodes.forEach((n, i) =>
  cells.push({ label: String(i + 1), cap: `${n.token} · ${n.eyebrow.replace(/^제보 \d+ · /, "")}`, src: img(`${n.token}.png`) })
);
cells.push({
  label: String(CONTENT.nodes.length + 1),
  cap: `${CONTENT.finale.token} · ${CONTENT.finale.eyebrow.replace(/^최후의 조화 · /, "클라이맥스 ")}`,
  src: img(`${CONTENT.finale.token}.png`),
});

const cellHtml = cells
  .map(
    (c) => `
    <div class="cell">
      <div class="label">${c.label}</div>
      <img class="qr" src="${c.src}" alt="${c.label}" />
      <div class="cap">${c.cap}</div>
    </div>`
  )
  .join("");

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Malgun Gothic','Apple SD Gothic Neo',sans-serif; color:#111; }
  h1 { text-align:center; font-size:15pt; margin:2mm 0 5mm; font-weight:700; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6mm 8mm; }
  .cell { display:flex; flex-direction:column; align-items:center; break-inside:avoid; }
  .label { font-size:20pt; font-weight:700; margin-bottom:2mm; }
  .qr { width:48mm; height:48mm; image-rendering:pixelated; }
  .cap { font-size:9pt; color:#333; margin-top:2mm; font-family:ui-monospace,monospace; }
</style></head><body>
  <h1>기묘한 국중곽 : 21세기 도깨비 — 테스트 QR</h1>
  <div class="grid">${cellHtml}</div>
</body></html>`;

const browser = await chromium.launch({ headless: true, executablePath: EXEC });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
await page.pdf({
  path: path.join(ROOT, "docs/qr-test-sheet.pdf"),
  format: "A4",
  landscape: true,
  printBackground: true,
});
// 미리보기 PNG
const pv = await browser.newPage({ viewport: { width: 1400, height: 990 } });
await pv.setContent(html, { waitUntil: "networkidle" });
await pv.screenshot({ path: path.join(ROOT, "docs/qr-test-sheet.png") });
await browser.close();
console.log(`생성: docs/qr-test-sheet.pdf (셀 ${cells.length}개: ${cells.map((c) => c.label).join(", ")})`);
