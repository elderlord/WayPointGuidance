/* E2E(오디오): 실제 Chromium에서 BGM 재생/음소거/영속을 검증.
   실행: npm run test:e2e:audio   (성공 시 exit 0)
   헤드리스에서도 사용자 클릭(신뢰 이벤트) 후 audio.play()가 진행된다. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wav": "audio/wav", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const results = [];
const check = (name, cond) => { results.push({ name, ok: !!cond }); console.log(`${cond ? "ok  " : "FAIL"} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const EXEC = process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ headless: true, executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const audio = () => page.evaluate(() => ({
  hasSource: window.__audio?.hasSource(),
  started: window.__audio?.isStarted(),
  playing: window.__audio?.isPlaying(),
  muted: window.__audio?.isMuted(),
}));
const currentTime = () => page.evaluate(() => window.__audio?.currentTime() ?? -1);

try {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-act="enter-intro"]');

  // 1) 부팅(인트로): 소스 준비됐고, 제스처 전엔 재생 안 함
  let a = await audio();
  check("BGM 소스 로드됨", a.hasSource === true);
  check("제스처 전 재생 안 함", a.started === false && a.playing === false);
  check("기본 음소거 아님", a.muted === false);

  // 2) 첫 제스처(인트로 시작) → 재생 시작, 프롤로그로
  await page.click('[data-act="enter-intro"]');
  await page.waitForSelector("#name");
  await sleep(600);
  a = await audio();
  check("제스처 후 재생 시작", a.started === true && a.playing === true);
  check("재생 위치 진행됨(currentTime>0)", (await currentTime()) > 0);
  check("상단 소리 버튼 '켜짐'", (await page.locator("#soundLabel").innerText()) === "소리 켜짐");

  // 프롤로그: 이름 입력 후 시작 → 스캔 화면
  await page.fill("#name", "소리테스터");
  await page.click('[data-act="start"]');
  await page.waitForSelector("#token");

  // 3) 소리 끄기 → 정지 + 라벨 변경
  await page.click('[data-act="toggle-sound"]');
  await sleep(150);
  a = await audio();
  check("음소거 시 정지", a.muted === true && a.playing === false);
  check("버튼 '꺼짐'으로", (await page.locator("#soundLabel").innerText()) === "소리 꺼짐");

  // 4) 새로고침 후 음소거 영속 + 제스처해도 소리 안 남
  await page.reload({ waitUntil: "load" });
  check("새로고침 후 음소거 유지", (await page.locator("#soundLabel").innerText()) === "소리 꺼짐");
  await page.click('[data-act="scan-start"]').catch(() => {}); // 스캔 화면 제스처
  await sleep(300);
  a = await audio();
  check("음소거 상태에선 제스처해도 재생 안 함", a.playing === false);

  // 5) 다시 켜기 → 재생 재개
  await page.click('[data-act="toggle-sound"]');
  await sleep(500);
  a = await audio();
  check("다시 켜면 재생 재개", a.muted === false && a.playing === true);

  check("페이지 JS 에러 없음", errors.length === 0);
  if (errors.length) console.log("PAGE ERRORS:", errors);
} catch (e) {
  console.log("EXCEPTION:", e.message);
  results.push({ name: "예외 없음", ok: false });
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
