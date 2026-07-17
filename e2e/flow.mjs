/* E2E: 정적 서버 + Chromium으로 전체 흐름과 선형 가드를 검증.
   실행: node test/e2e.mjs   (성공 시 exit 0) */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CONTENT } from "../src/content.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.writeHead(404); res.end("nf"); return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const correctIdx = (opts) => opts.findIndex((o) => o.correct);
const results = [];
function check(name, cond) {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? "ok  " : "FAIL"} - ${name}`);
}

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const EXEC =
  process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ headless: true, executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(base + "/", { waitUntil: "networkidle" });

  // 1) 프롤로그
  check("프롤로그 렌더", await page.locator("h1.title").innerText().then((t) => t.includes("도깨비가 과학관")));
  await page.fill("#name", "테스트조사관");
  await page.click('[data-act="start"]');

  // 2) 스캔 상태 + 선형 가드: NSM-03을 먼저 넣으면 막혀야 함
  await page.waitForSelector("#token");
  check("스캔 화면 진입", await page.locator("h1.title").innerText().then((t) => t.includes("QR")));
  await page.fill("#token", "NSM-03");
  await page.click('[data-act="token-submit"]');
  await page.waitForFunction(() => document.querySelector("#scanMsg")?.textContent?.length > 0);
  check("선형 가드: 순서 건너뛰기 차단", await page.locator("#scanMsg").innerText().then((t) => t.includes("성급")));
  check("가드 후 여전히 스캔 화면", (await page.locator("#token").count()) === 1);

  // 3) 노드 0~3 순차 진행
  for (let i = 0; i < CONTENT.nodes.length; i++) {
    // 이미 푼 이전 지점을 다시 스캔하면 이동하지 않고 피드백만(문항 튐 방지)
    if (i >= 1) {
      await page.fill("#token", `NSM-0${i}`);
      await page.click('[data-act="token-submit"]');
      await page.waitForFunction(() => document.querySelector("#scanMsg")?.textContent?.length > 0);
      check(`이미 푼 지점 재스캔 차단 (노드 ${i})`, (await page.locator("#scanMsg").innerText()).includes("이미"));
      check(`재스캔 후 스캔 화면 유지 (노드 ${i})`, (await page.locator("#token").count()) === 1);
    }
    await page.fill("#token", `NSM-0${i + 1}`);
    await page.click('[data-act="token-submit"]');
    await page.waitForSelector("#opts .opt");
    check(`노드 ${i} 렌더`, await page.locator("h1.title").innerText().then((t) => t.includes(CONTENT.nodes[i].title)));
    // 오답 먼저(정답이 아닌 인덱스) → 되묻기 표시
    const ci = correctIdx(CONTENT.nodes[i].options);
    const wrongI = ci === 0 ? 1 : 0;
    await page.locator("#opts .opt").nth(wrongI).click();
    check(`노드 ${i} 오답 되묻기`, (await page.locator("#wrongmsg").count()) === 1);
    // 정답 → 규명 공개
    await page.locator("#opts .opt").nth(ci).click();
    await page.waitForSelector("#reveal.show");
    check(`노드 ${i} 정답→규명`, await page.locator("#reveal").getAttribute("class").then((c) => c.includes("show")));
    // 진행도 저장 확인(중간 새로고침 후 resume은 노드 3에서만 별도 확인)
    await page.click('[data-act="to-scan"]');
    await page.waitForSelector("#token");
  }

  // 4) 새로고침 후 진행도 유지(4노드 규명 상태 → 스캔 화면으로 복귀)
  await page.reload({ waitUntil: "load" });
  check("새로고침 후 진행도 유지(스캔 복귀)", (await page.locator("#token").count()) === 1);

  // 5) 클라이맥스 → 담력왕
  await page.fill("#token", "NSM-05");
  await page.click('[data-act="token-submit"]');
  await page.waitForSelector("#opts .opt");
  check("finale 렌더", await page.locator("h1.title").innerText().then((t) => t.includes("도깨비를 마주")));
  await page.locator("#opts .opt").nth(correctIdx(CONTENT.finale.options)).click();
  await page.waitForSelector("#reveal.show");
  await page.click('[data-act="finish"]');
  await page.waitForSelector(".code .cv");
  check("담력왕 배지", (await page.locator(".badge .bt").innerText()).includes("담력왕"));
  check("교환코드 표시", (await page.locator(".code .cv").innerText()).includes(CONTENT.meta.rewardCode));
  check("이름 반영", (await page.locator(".badge .bn").innerText()).includes("테스트조사관"));

  // 6) 리셋
  await page.click('[data-act="reset"]');
  await page.waitForSelector("#name");
  check("리셋→프롤로그", (await page.locator("#name").count()) === 1);

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
