/* =========================================================================
   진행 정책 — "어느 지점에 들어갈 수 있는가"를 결정.
   선형(linear)이 기본이며, 하이브리드(hybrid)는 setPolicy('hybrid') 한 줄로 전환.
   순수 함수 — 상태를 변형하지 않고 판정/다음단계만 계산.

   Stage: "prologue" | <nodeIndex 0-based number> | "finale" | "done"
   ========================================================================= */

/** node 인덱스인지(0-based 정수) */
const isNodeStage = (stage) => Number.isInteger(stage);

export const POLICIES = {
  /* 선형 강제: 앞 지점을 모두 규명해야 다음 지점이 열림 */
  linear: {
    name: "linear",
    canAccess(stage, state, nodeCount) {
      if (stage === "prologue") return true;
      if (!state.name) return false; // 프롤로그(이름) 전에는 어떤 지점도 불가
      if (stage === "finale") return state.solved >= nodeCount;
      if (stage === "done") return state.solved >= nodeCount + 1;
      if (isNodeStage(stage)) return stage >= 0 && stage < nodeCount && state.solved >= stage;
      return false;
    },
  },

  /* 하이브리드: 노드는 순서 무관 자유 접근, 클라이맥스만 전부 규명 후 잠금 해제 */
  hybrid: {
    name: "hybrid",
    canAccess(stage, state, nodeCount) {
      if (stage === "prologue") return true;
      if (!state.name) return false;
      if (stage === "finale") return state.solved >= nodeCount;
      if (stage === "done") return state.solved >= nodeCount + 1;
      if (isNodeStage(stage)) return stage >= 0 && stage < nodeCount;
      return false;
    },
  },
};

let active = POLICIES.linear;

export function setPolicy(nameOrPolicy) {
  active =
    typeof nameOrPolicy === "string" ? POLICIES[nameOrPolicy] || active : nameOrPolicy;
  return active;
}
export function getPolicy() {
  return active;
}

/** 현재 정책으로 접근 가능 여부 */
export function canAccess(stage, state, nodeCount) {
  return active.canAccess(stage, state, nodeCount);
}

/**
 * 막힌 스캔/링크를 되돌려 보낼 "지금 갈 수 있는 지점".
 * 정책과 무관하게 진행도 기준으로 계산(선형/하이브리드 공통으로 안전).
 */
export function resolveEntry(state, nodeCount) {
  if (!state.name) return "prologue";
  if (state.solved < nodeCount) return state.solved; // 다음 미규명 노드 인덱스
  if (state.solved === nodeCount) return "finale";
  return "done";
}

/**
 * 현재 지점을 규명한 뒤의 다음 지점.
 * @param {Stage} stage 방금 규명한 지점
 */
export function nextStage(stage, nodeCount) {
  if (isNodeStage(stage)) return stage + 1 < nodeCount ? stage + 1 : "finale";
  if (stage === "finale") return "done";
  return resolveEntry({ name: "x", solved: 0 }, nodeCount);
}
