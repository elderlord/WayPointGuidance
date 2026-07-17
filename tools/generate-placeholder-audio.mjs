/* =========================================================================
   placeholder 앰비언스 생성 — 실제 음원이 준비되기 전 오디오 재생을 테스트하기
   위한 임시 BGM. 이음새 없이 반복되는 부드러운 저음 패드(8초).
   실제 음원이 확정되면 assets/audio/ambience.* 를 교체하고 content.js의
   meta.audio.bgm 경로만 바꾸면 된다.

   사용: node tools/generate-placeholder-audio.mjs
   출력: assets/audio/ambience.wav (모노 22.05kHz 16-bit)
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/audio/ambience.wav");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const SR = 22050; // sample rate
const DUR = 8; // seconds — 아래 주파수/LFO가 모두 정수 주기라 8초에서 이음새 없이 루프
const N = SR * DUR;

// 정수 주기가 되도록 고른 주파수(가청 저음 패드) + 느린 진폭 LFO
const TONES = [
  { f: 55, a: 0.35 }, // 서브
  { f: 110, a: 0.5 }, // 근음
  { f: 165, a: 0.28 }, // 5도
];
const LFO = 0.25; // Hz (4초 주기) → 8초에 2주기
const GAIN = 0.16;

const buf = Buffer.alloc(44 + N * 2);
// WAV 헤더
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

for (let i = 0; i < N; i++) {
  const t = i / SR;
  let s = 0;
  for (const { f, a } of TONES) s += a * Math.sin(2 * Math.PI * f * t);
  const swell = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(2 * Math.PI * LFO * t)); // 0.55..1.0
  let v = GAIN * swell * s;
  if (v > 1) v = 1;
  if (v < -1) v = -1;
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}

fs.writeFileSync(OUT, buf);
console.log(`생성: ${path.relative(ROOT, OUT)}  (${(buf.length / 1024).toFixed(0)} KB, ${DUR}s 루프)`);
