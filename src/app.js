/* =========================================================================
   앱 컨트롤러 — 부팅, 렌더 디스패치, 이벤트 위임, 스캐너/진행정책 통합.
   상태 머신: "prologue" → "scan" ⇄ <node i> → "scan" → "finale" → "done"
   ========================================================================= */
import { CONTENT } from "./content.js";
import { validateContent } from "./schema.js";
import { loadState, saveState, resetState } from "./state.js";
import { canAccess, resolveEntry, nextStage, setPolicy } from "./progression.js";
import { buildTokenMap, resolveToken } from "./tokens.js";
import { createScanner, scannerSupported } from "./scanner.js";
import { initAudio, startAudio, toggleMuted, isMuted } from "./audio.js";
import {
  renderIntro,
  renderPrologue,
  renderScanner,
  renderNode,
  renderFinale,
  renderDone,
  esc,
} from "./views.js";

const content = CONTENT;
const NODE_COUNT = content.nodes.length;
const tokenMap = buildTokenMap(content);

// 진행 정책: 선형 강제(기본). 하이브리드 전환은 setPolicy('hybrid') 한 줄.
setPolicy("linear");

let state = loadState();
let scanner = null;
const app = document.getElementById("app");

/* ---------- 렌더 ---------- */
function render() {
  stopScanner();
  const s = state.stage;
  if (s === "intro") app.innerHTML = renderIntro(content);
  else if (s === "prologue") app.innerHTML = renderPrologue(content, state);
  else if (s === "scan") app.innerHTML = renderScanner(content, state);
  else if (s === "finale") app.innerHTML = renderFinale(content, state);
  else if (s === "done") app.innerHTML = renderDone(content, state);
  else if (Number.isInteger(s)) app.innerHTML = renderNode(content, state, s);
  else app.innerHTML = renderPrologue(content, state);

  updateSoundUI();
  // 새 화면은 항상 맨 위에서 시작 — 결과 텍스트가 상단에 노출되도록
  window.scrollTo(0, 0);
  if (app.scrollTop) app.scrollTop = 0;
  if (s === "scan") setupScanner();
  if (s === "intro") setupIntro();
}

/* 포스터 이미지가 없으면 텍스트 스플래시로 폴백 표시 */
function setupIntro() {
  const wrap = document.getElementById("intro");
  const img = document.getElementById("introPoster");
  if (!wrap || !img) return;
  const fallback = () => wrap.classList.add("no-poster");
  if (img.complete && img.naturalWidth === 0) fallback();
  img.addEventListener("error", fallback, { once: true });
}

/* 소리 토글 버튼의 표시 상태를 현재 오디오 상태로 보정 */
function updateSoundUI() {
  const btn = document.getElementById("soundBtn");
  const label = document.getElementById("soundLabel");
  const m = isMuted();
  if (btn) {
    btn.classList.toggle("muted", m);
    btn.setAttribute("aria-pressed", m ? "true" : "false");
  }
  if (label) label.textContent = m ? "소리 꺼짐" : "소리 켜짐";
}

/* ---------- 스캐너 ---------- */
let cameraEverStarted = false; // 한 번 켰으면 이후 스캔 화면에서 자동 재개

function setupScanner() {
  const btn = document.getElementById("scanBtn");
  if (!scannerSupported() && btn) {
    btn.disabled = true;
    btn.textContent = "이 기기는 카메라 스캔 미지원 — 아래 직접 입력";
  }
  const video = document.getElementById("scanVideo");
  if (video) {
    scanner = createScanner(
      video,
      (token) => handleToken(token, true), // 카메라 스캔
      (msg) => setScanMsg(msg)
    );
    // 이전에 카메라를 켠 적 있으면(권한 이미 허용됨) 자동으로 다시 켜 스캔 재개
    if (cameraEverStarted && scannerSupported()) {
      scanner.start();
      const st = document.getElementById("scanStatus");
      if (st) st.textContent = "QR을 사각 안에 맞추세요…";
    }
  }
}
function stopScanner() {
  if (scanner) {
    scanner.stop();
    scanner = null;
  }
}
function setScanMsg(msg, kind) {
  const el = document.getElementById("scanMsg");
  if (el) {
    el.textContent = msg;
    el.className = "scan-msg" + (kind ? " " + kind : "");
  }
}

/* ---------- 토큰 처리 (선형 가드: 지금 순서의 표식만 진행) ----------
   현재 기대 지점(resolveEntry)과 일치하는 토큰에서만 이동한다.
   그 외(모르는 코드 · 이미 푼 지점 · 앞선 지점)는 이동하지 않고 피드백만 주며
   카메라는 계속 켜둔다 → 화면에 다른 QR이 잡혀도 문항이 튀지 않는다. */
function handleToken(raw, viaScan) {
  const { ok, stage } = resolveToken(raw, tokenMap);
  const expected = resolveEntry(state, NODE_COUNT); // 지금 찾아야 할 지점

  if (!ok) {
    setScanMsg("…그건 내 표식이 아니다. 다른 표식을 비추어라.", "err");
    return;
  }
  if (stage === expected) {
    // 카메라 스캔은 확인 링으로 인지 시간을 준 뒤 전환. 수동 입력은 즉시.
    if (viaScan) confirmAndAdvance(stage);
    else goToStage(stage);
    return;
  }
  // 알려진 토큰이지만 지금 순서가 아님 — 이동하지 않음
  const behind =
    (typeof stage === "number" && typeof expected === "number" && stage < expected) ||
    (typeof stage === "number" && expected === "finale");
  if (behind) {
    setScanMsg("이미 밝혀낸 조화다. 다음 표식을 찾아라.", "err");
  } else {
    setScanMsg("크큭, 성급하구나. 순서대로 오너라. 아직 이 표식의 차례가 아니다.", "err");
  }
}

const CONFIRM_MS = 1200; // 인식 확인 링 지속(인지 시간)

function goToStage(stage) {
  stopScanner();
  state.stage = stage;
  saveState(state);
  render();
}

/* 인식 직후 즉시 전환하지 않고, 프레임 외곽을 시계방향으로 채우는 링으로
   "인식됨"을 인지시킨 뒤 전환한다. */
function confirmAndAdvance(stage) {
  const view = document.getElementById("scanView");
  const fill = document.getElementById("scanRingFill");
  const status = document.getElementById("scanStatus");
  if (!view || !fill) {
    goToStage(stage);
    return;
  }
  scanner?.pause(); // 디코딩만 멈추고 프리뷰는 유지
  view.classList.add("confirming");
  if (status) status.textContent = "표식을 확인했다…";
  // 링 채우기 애니메이션 (dashoffset 100→0)
  fill.style.transition = "none";
  fill.style.strokeDashoffset = "100";
  void fill.getBoundingClientRect(); // reflow
  fill.style.transition = `stroke-dashoffset ${CONFIRM_MS}ms linear`;
  fill.style.strokeDashoffset = "0";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    goToStage(stage);
  };
  fill.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, CONFIRM_MS + 300); // 폴백
}

/* ---------- 미션 응답 ---------- */
function currentSet() {
  return state.stage === "finale" ? content.finale : content.nodes[state.stage];
}
function handleAnswer(idx) {
  const set = currentSet();
  const btns = [...document.querySelectorAll("#opts .opt")];
  const chosen = set.options[idx];
  if (chosen.correct) {
    btns.forEach((b, bi) => {
      b.disabled = true;
      if (bi === idx) b.classList.add("right");
    });
    if (state.stage === "finale") state.solved = NODE_COUNT + 1;
    else state.solved = Math.max(state.solved, state.stage + 1);
    saveState(state);
    const rv = document.getElementById("reveal");
    rv.classList.add("show");
    const span = document.querySelector(".bar>span");
    if (span) span.style.width = content.meta.sciencePct[Math.min(state.solved, 5)] + "%";
    rv.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    const b = btns[idx];
    b.classList.add("wrong");
    b.disabled = true;
    let msg = document.getElementById("wrongmsg");
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "wrongmsg";
      msg.className = "react";
      msg.style.marginTop = "12px";
      document.getElementById("opts").after(msg);
    }
    const w = content.wrong[Math.floor(Math.random() * content.wrong.length)];
    msg.innerHTML = `<p>${esc(w)}</p>`;
  }
}

/* ---------- 이벤트 위임 ---------- */
app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  startAudio(); // 첫 사용자 제스처에서 BGM 시작(멱등, 자동재생 정책 대응)
  const act = el.dataset.act;
  if (act === "toggle-sound") {
    toggleMuted();
    updateSoundUI();
    return;
  }
  if (act === "enter-intro") {
    state.stage = "prologue";
    saveState(state);
    render();
    return;
  }
  if (act === "start") {
    const v = (document.getElementById("name").value || "").trim();
    state.name = v || content.meta.placeholderName;
    state.stage = "scan";
    saveState(state);
    render();
  } else if (act === "scan-start") {
    cameraEverStarted = true;
    scanner?.start();
    setScanMsg("");
    const st = document.getElementById("scanStatus");
    if (st) st.textContent = "QR을 사각 안에 맞추세요…";
  } else if (act === "token-submit") {
    handleToken(document.getElementById("token").value, false);
  } else if (act === "answer") {
    handleAnswer(Number(el.dataset.i));
  } else if (act === "to-scan") {
    state.stage = "scan";
    saveState(state);
    render();
  } else if (act === "finish") {
    state.stage = "done";
    saveState(state);
    render();
  } else if (act === "reset") {
    state = resetState();
    render();
  }
});
// Enter 키로 토큰 제출
app.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "token") {
    e.preventDefault();
    handleToken(e.target.value, false);
  }
});

/* ---------- 부팅 ---------- */
const check = validateContent(content);
if (!check.ok) {
  app.innerHTML = `<div style="padding:20px;color:#e8c6d3;font-size:13px">
    <b>콘텐츠 오류</b><br>${check.errors.map(esc).join("<br>")}</div>`;
  console.error("Invalid content:", check.errors);
} else {
  initAudio(content.meta.audio?.bgm);
  // 저장된 stage가 정책상 접근 불가하면 갈 수 있는 지점으로 되돌림
  if (
    state.stage !== "intro" &&
    state.stage !== "prologue" &&
    state.stage !== "scan" &&
    !canAccess(state.stage, state, NODE_COUNT)
  ) {
    state.stage = state.name ? "scan" : "prologue";
  }
  render();
}
