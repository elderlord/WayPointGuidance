/* =========================================================================
   진행 상태 저장 — localStorage (QR로 다시 열거나 새로고침해도 진행도 유지).
   storage를 주입 가능하게 하여 Node 환경에서도 테스트 가능.

   state 스키마:
     { v: number, name: string, solved: number, stage: Stage }
   Stage = "prologue" | <nodeIndex:number 0-based> | "finale" | "done"
   solved = 규명 완료 수. nodes 0..N-1 규명 시 N, finale 규명 시 N+1.
   ========================================================================= */

export const STORAGE_KEY = "gukjunggwak_dokkaebi_v1";
export const STATE_VERSION = 1;

export function freshState() {
  return { v: STATE_VERSION, name: "", solved: 0, stage: "intro" };
}

function getStorage(storage) {
  return storage || (typeof localStorage !== "undefined" ? localStorage : null);
}

/**
 * 저장된 상태를 읽는다. 없거나 손상/구버전이면 fresh 상태를 반환.
 * @returns {object} 항상 유효한 state
 */
export function loadState(storage) {
  const s = getStorage(storage);
  if (!s) return freshState();
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    // 버전 불일치 → 마이그레이션 훅 자리. 지금은 안전하게 초기화.
    if (!parsed || parsed.v !== STATE_VERSION) return freshState();
    // 최소 형태 보정
    return {
      v: STATE_VERSION,
      name: typeof parsed.name === "string" ? parsed.name : "",
      solved: Number.isInteger(parsed.solved) ? parsed.solved : 0,
      stage: parsed.stage ?? "prologue",
    };
  } catch (e) {
    return freshState();
  }
}

export function saveState(state, storage) {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* 저장 실패는 무시(사파리 프라이빗 모드 등) */
  }
}

export function resetState(storage) {
  const s = getStorage(storage);
  try {
    s?.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
  return freshState();
}
