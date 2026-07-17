/* =========================================================================
   QR 생성기 — 현장 배치용 QR 이미지를 만든다.
     · 각 지점 토큰(NSM-0X): "순수 식별 토큰"을 담은 QR → 앱 내장 스캐너가 읽음
     · 시작(START): 배포 URL을 담은 QR → 폰 기본 카메라로 앱을 최초 로드
   출력: qr/*.svg (인쇄 권장, 무손실) + qr/*.png (미리보기)

   사용:
     node tools/generate-qr.mjs
     node tools/generate-qr.mjs --url https://<owner>.github.io/<repo>/
   토큰 목록은 src/content.js에서 자동으로 읽는다(내용이 바뀌어도 동기화됨).
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { CONTENT } from "../src/content.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "qr");
fs.mkdirSync(OUT, { recursive: true });

// 배포 URL (시작 QR용). --url 인자 또는 기본값.
const argIdx = process.argv.indexOf("--url");
const START_URL =
  argIdx !== -1 ? process.argv[argIdx + 1] : "https://elderlord.github.io/WayPointGuidance/";

const opts = { errorCorrectionLevel: "H", margin: 2, scale: 12, color: { dark: "#000000", light: "#ffffff" } };

async function emit(name, payload, label) {
  const svg = await QRCode.toString(payload, { ...opts, type: "svg" });
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  await QRCode.toFile(path.join(OUT, `${name}.png`), payload, { ...opts, type: "png", width: 720 });
  console.log(`  ${name.padEnd(10)} → "${payload}"  (${label})`);
}

const targets = [];
CONTENT.nodes.forEach((n) =>
  targets.push({ name: n.token, payload: n.token, label: n.eyebrow })
);
if (CONTENT.finale?.token)
  targets.push({ name: CONTENT.finale.token, payload: CONTENT.finale.token, label: CONTENT.finale.eyebrow });

console.log(`QR 생성 → ${path.relative(ROOT, OUT)}/`);
console.log("• 지점 토큰(앱 내장 스캐너용):");
for (const t of targets) await emit(t.name, t.payload, t.label);
console.log("• 시작 QR(폰 기본 카메라 → 앱 로드):");
await emit("START", START_URL, "프롤로그 입구 · 앱 시작");
console.log(`\n완료: 지점 ${targets.length}개 + 시작 1개. SVG(인쇄) / PNG(미리보기)`);
console.log(`시작 URL: ${START_URL}`);
