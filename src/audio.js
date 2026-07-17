/* =========================================================================
   오디오 컨트롤러 — 밤 분위기 BGM 재생 + 음소거 토글.
   · 브라우저 자동재생 정책상 소리는 "첫 사용자 제스처"에서 시작한다.
   · 음소거 상태는 localStorage에 영속(재방문/새로고침 유지).
   · 실제 음원이 준비되면 content.meta.audio.bgm 경로만 교체하면 된다.
   테스트를 위해 window.__audio 로 상태를 노출한다.
   ========================================================================= */

const MUTE_KEY = "gukjunggwak_audio_muted_v1";

let el = null; // HTMLAudioElement (BGM)
let started = false; // 첫 제스처로 재생을 시작했는가
let muted = false;

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch (e) {
    return false;
  }
}
function persistMuted() {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch (e) {
    /* ignore */
  }
}

/** BGM 오디오 엘리먼트를 준비(아직 재생하지 않음). src 없으면 무음 동작. */
export function initAudio(src) {
  muted = loadMuted();
  if (src && typeof Audio !== "undefined") {
    el = new Audio(src);
    el.loop = true;
    el.preload = "none"; // 제스처 전 미디어 미리받기 금지(불필요 트래픽·networkidle 안정)
    el.volume = 0.6;
  }
  if (typeof window !== "undefined") {
    window.__audio = {
      isMuted: () => muted,
      isStarted: () => started,
      isPlaying: () => !!el && !el.paused,
      hasSource: () => !!el,
      currentTime: () => (el ? el.currentTime : -1),
    };
  }
}

/** 첫 사용자 제스처에서 호출. 음소거가 아니면 재생 시작(멱등). */
export function startAudio() {
  if (started || !el) {
    started = true;
    return;
  }
  started = true;
  if (!muted) el.play().catch(() => {});
}

/** 음소거 상태 설정. 시작된 상태면 재생/정지를 반영. */
export function setMuted(m) {
  muted = !!m;
  persistMuted();
  if (!el) return;
  if (muted) el.pause();
  else if (started) el.play().catch(() => {});
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

export function isMuted() {
  return muted;
}
