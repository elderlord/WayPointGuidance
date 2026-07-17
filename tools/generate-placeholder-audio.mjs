/* =========================================================================
   테스트용 비프 음원 생성 — 실제 음원이 준비되기 전 오디오 재생을 "귀로" 확인하기
   위한 임시 사운드. 짧은 비프(880Hz) + 침묵으로 이루어진 3초 루프.
   · 루프이므로 재생 중 상태가 유지되고(테스트 안정), 주기적 비프로 소리 확인이 쉬움.
   · 실제 음원이 확정되면 assets/audio/ 파일을 교체하고 content.js의
     meta.audio.bgm 경로만 바꾸면 된다.

   사용: node tools/generate-placeholder-audio.mjs
   출력: assets/audio/test-beep.wav (모노 22.05kHz 16-bit, 3초 루프)
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/audio/test-beep.wav");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const SR = 22050;
const DUR = 3; // 초 — 3초마다 비프 1회
const N = SR * DUR;

const FREQ = 880; // 비프 음정(A5)
const BEEP = 0.18; // 비프 길이(초)
const ENV = 0.012; // 앞뒤 페이드(초) — 클릭 노이즈 방지, 이음새 없는 루프
const GAIN = 0.28;

const buf = Buffer.alloc(44 + N * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 2, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 2, 40);

const beepN = Math.floor(BEEP * SR);
const envN = Math.floor(ENV * SR);
for (let i = 0; i < N; i++) {
  let v = 0;
  if (i < beepN) {
    let amp = 1;
    if (i < envN) amp = i / envN; // 페이드 인
    else if (i > beepN - envN) amp = (beepN - i) / envN; // 페이드 아웃
    v = GAIN * amp * Math.sin((2 * Math.PI * FREQ * i) / SR);
  }
  if (v > 1) v = 1;
  if (v < -1) v = -1;
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}

fs.writeFileSync(OUT, buf);
console.log(`생성: ${path.relative(ROOT, OUT)}  (${(buf.length / 1024).toFixed(0)} KB, ${DUR}s 루프, ${FREQ}Hz 비프)`);
