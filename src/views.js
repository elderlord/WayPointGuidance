/* =========================================================================
   뷰 렌더 — 콘텐츠/상태를 받아 HTML 문자열을 만든다(순수).
   이벤트 바인딩은 app.js가 이벤트 위임으로 처리(인라인 onclick 없음).
   ========================================================================= */

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl2br = (s) => esc(s).replace(/\n/g, "<br>");

function bar(content, solved) {
  const pct = content.meta.sciencePct[Math.min(solved, 5)];
  return `<div class="bar-wrap"><div class="bar-key"><span>미신</span><span class="sci">과학 ${
    pct === 100 ? "✓" : ""
  }</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>`;
}
function topbar(content) {
  // 소리 토글은 모든 화면에 노출. 실제 상태(켜짐/꺼짐)는 렌더 직후 app.updateSoundUI가 보정.
  return `<div class="top"><p class="brand">${esc(content.meta.title)}</p>
    <button class="sound" id="soundBtn" data-act="toggle-sound" aria-pressed="false"><span class="dot"></span><span id="soundLabel">소리 켜짐</span></button></div>`;
}
const restart = `<div class="spacer"></div><button class="restart" data-act="reset">처음부터 다시 시작</button>`;

/** 인트로(첫 페이지) — 포스터 이미지 + 시작 버튼. 이미지 없으면 텍스트 스플래시로 폴백. */
export function renderIntro(content) {
  const it = content.intro || {};
  return `
    <div class="intro" id="intro">
      <div class="intro-media">
        <img class="intro-poster" id="introPoster" src="${esc(it.poster || "assets/poster.jpg")}"
             alt="${esc(content.meta.title)} 포스터" />
        <div class="intro-fallback">
          <p class="intro-fb-brand">국립중앙과학관</p>
          <h1 class="intro-fb-title">${nl2br(content.prologue?.title || content.meta.title)}</h1>
          <p class="intro-fb-tag">${nl2br(it.fallbackTagline || "")}</p>
          <p class="intro-fb-meta">${esc(it.fallbackMeta || "")}</p>
        </div>
      </div>
      <button class="cta intro-cta" data-act="enter-intro">${esc(it.cta || "시작하기")}</button>
    </div>`;
}

export function renderPrologue(content, state) {
  const p = content.prologue;
  return `
    ${topbar(content)}
    <p class="eyebrow">${esc(p.eyebrow)}</p>
    <h1 class="title">${nl2br(p.title)}</h1>
    <div class="voice"><p>${nl2br(p.taunt)}</p></div>
    <p class="aside">${nl2br(p.aside)}</p>
    <div class="field">
      <p class="flabel">${esc(p.nameLabel)}</p>
      <input id="name" class="finput" type="text" placeholder="${esc(content.meta.placeholderName)}" value="${esc(state.name)}" />
    </div>
    <button class="cta" data-act="start">${esc(p.cta)}</button>
    <p class="hint">${esc(p.hint)}</p>`;
}

/** 지점 사이 스캔 대기 화면 — 내장 카메라 + 수동 토큰 입력 폴백 */
export function renderScanner(content, state) {
  return `
    ${topbar(content)}
    ${bar(content, state.solved)}
    <p class="eyebrow">다음 제보 지점</p>
    <h1 class="title">현장의 QR을 비추어라</h1>
    <div class="voice"><p>발이 멈춘 그 자리, 표식이 있을 게다. 그것을 이 눈에 비추어 보아라… 다음 조화가 열릴 테니.</p></div>
    <div class="scan">
      <div class="scan-view" id="scanView" data-state="idle">
        <video id="scanVideo" playsinline muted></video>
        <div class="scan-frame"></div>
        <svg class="scan-ring" id="scanRing" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect class="scan-ring-track" x="18" y="18" width="64" height="64" rx="7" ry="7"></rect>
          <rect class="scan-ring-fill" id="scanRingFill" x="18" y="18" width="64" height="64" rx="7" ry="7" pathLength="100"></rect>
        </svg>
        <p class="scan-status" id="scanStatus">카메라를 켜 QR을 비추세요</p>
      </div>
      <button class="cta ghost" data-act="scan-start" id="scanBtn">카메라 켜기</button>
      <p class="scan-or">— 또는 표식의 번호를 직접 입력 —</p>
      <div class="scan-manual">
        <input id="token" class="finput" type="text" inputmode="text" autocapitalize="characters"
               placeholder="예: NSM-03" value="" />
        <button class="cta" data-act="token-submit">확인</button>
      </div>
      <p class="scan-msg" id="scanMsg"></p>
    </div>
    ${restart}`;
}

export function renderNode(content, state, i) {
  const n = content.nodes[i];
  return `
    ${topbar(content)}
    ${bar(content, state.solved)}
    <p class="eyebrow">${esc(n.eyebrow)}</p>
    <h1 class="title">${esc(n.title)}</h1>
    <div class="voice"><p>${nl2br(n.taunt)}</p></div>
    <p class="tale-label">목 격 담</p>
    <p class="tale">${nl2br(n.tale)}</p>
    ${n.onsite ? `<div class="onsite"><b>현장</b> · ${esc(n.onsite)}</div>` : ""}
    <div class="mission">
      <p class="m-q">${esc(n.question)}</p>
      <div id="opts">
        ${n.options
          .map((o, idx) => `<button class="opt" data-act="answer" data-i="${idx}">${esc(o.t)}</button>`)
          .join("")}
      </div>
    </div>
    <div id="reveal" class="reveal-box">
      <p class="r-label">과 학 의 규 명</p>
      <div class="reveal">${esc(n.reveal)}</div>
      <div class="react"><p>${esc(n.react)}</p></div>
      <p class="next-clue"><b>다음 단서 →</b> ${esc(n.nextClue)}</p>
      <button class="cta" data-act="to-scan">다음 지점으로 · QR 스캔</button>
    </div>
    ${restart}`;
}

export function renderFinale(content, state) {
  const f = content.finale;
  return `
    ${topbar(content)}
    ${bar(content, state.solved)}
    <p class="eyebrow">${esc(f.eyebrow)}</p>
    <h1 class="title">${esc(f.title)}</h1>
    <div class="voice"><p>${nl2br(f.climax)}</p></div>
    ${f.onsite ? `<div class="onsite"><b>현장</b> · ${esc(f.onsite)}</div>` : ""}
    <div class="mission">
      <p class="m-q">${esc(f.question)}</p>
      <div id="opts">
        ${f.options
          .map((o, idx) => `<button class="opt" data-act="answer" data-i="${idx}">${esc(o.t)}</button>`)
          .join("")}
      </div>
    </div>
    <div id="reveal" class="reveal-box">
      <p class="r-label">최 후 의 규 명</p>
      <div class="reveal">${esc(f.reveal)}</div>
      <div class="react"><p>${esc(f.concession)}</p></div>
      <button class="cta" data-act="finish">담력왕 인증받기</button>
    </div>
    ${restart}`;
}

export function renderDone(content, state) {
  const d = content.done;
  return `
    ${topbar(content)}
    ${bar(content, state.solved)}
    <div class="result">
      <p class="rl">${esc(d.resultLabel)}</p>
      <p class="rt">${d.resultText.split("{name}").map(esc).join(`<b>${esc(state.name)}</b>`)}</p>
    </div>
    <div class="badge">
      <div class="crown">👑</div>
      <p class="bt">${esc(d.badgeTitle)}</p>
      <p class="bn">${esc(state.name)}</p>
    </div>
    <div class="code">
      <p class="cl">${esc(d.codeLabel)}</p>
      <p class="cv">${esc(content.meta.rewardCode)}</p>
    </div>
    <p class="gift">${esc(d.giftNote)}</p>
    ${d.giftLimit ? `<p class="gift-limit">${esc(d.giftLimit)}</p>` : ""}
    ${restart}`;
}
