import { test } from "node:test";
import assert from "node:assert/strict";

import { CONTENT } from "../src/content.js";
import { validateContent } from "../src/schema.js";
import { freshState, loadState, saveState, resetState } from "../src/state.js";
import {
  setPolicy,
  canAccess,
  resolveEntry,
  nextStage,
} from "../src/progression.js";
import { normalizeToken, buildTokenMap, resolveToken } from "../src/tokens.js";

const N = CONTENT.nodes.length; // 4

/* ---- schema ---- */
test("실제 콘텐츠는 스키마를 통과한다", () => {
  const r = validateContent(CONTENT);
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("정답이 0개면 스키마 실패", () => {
  const bad = structuredClone(CONTENT);
  bad.nodes[0].options.forEach((o) => (o.correct = false));
  assert.equal(validateContent(bad).ok, false);
});

test("토큰 중복이면 스키마 실패", () => {
  const bad = structuredClone(CONTENT);
  bad.nodes[1].token = bad.nodes[0].token;
  assert.equal(validateContent(bad).ok, false);
});

/* ---- tokens ---- */
test("토큰 정규화: 대소문자/하이픈/자릿수 보정", () => {
  assert.equal(normalizeToken("nsm3"), "NSM-03");
  assert.equal(normalizeToken(" NSM-01 "), "NSM-01");
  assert.equal(normalizeToken("nsm-05"), "NSM-05");
});

test("토큰 매칭: NSM-01→0, NSM-03→finale, 미지→ok:false", () => {
  const map = buildTokenMap(CONTENT);
  assert.deepEqual(resolveToken("NSM-01", map), { ok: true, stage: 0, token: "NSM-01" });
  assert.deepEqual(resolveToken("nsm3", map), { ok: true, stage: "finale", token: "NSM-03" });
  assert.equal(resolveToken("XXX-99", map).ok, false);
});

/* ---- progression: linear ---- */
test("선형: 이름 전에는 어떤 노드도 접근 불가", () => {
  setPolicy("linear");
  const s = freshState();
  assert.equal(canAccess(0, s, N), false);
  assert.equal(canAccess("prologue", s, N), true);
});

test("선형: 앞 지점을 풀어야 다음이 열린다", () => {
  setPolicy("linear");
  const s = { name: "탐정", solved: 0, stage: "scan", v: 1 };
  assert.equal(canAccess(0, s, N), true); // 첫 노드는 접근 가능
  assert.equal(canAccess(1, s, N), false); // 아직 0을 못 풂
  s.solved = 1;
  assert.equal(canAccess(1, s, N), true);
  assert.equal(canAccess(2, s, N), false);
});

test("선형: finale는 모든 노드 규명 후에만", () => {
  setPolicy("linear");
  const s = { name: "탐정", solved: N - 1, stage: "scan", v: 1 };
  assert.equal(canAccess("finale", s, N), false);
  s.solved = N;
  assert.equal(canAccess("finale", s, N), true);
});

test("하이브리드: 노드는 순서 무관, finale만 잠금", () => {
  setPolicy("hybrid");
  const s = { name: "탐정", solved: 0, stage: "scan", v: 1 };
  assert.equal(canAccess(N - 1, s, N), true); // 마지막 노드로 건너뛰어도 접근 가능
  assert.equal(canAccess("finale", s, N), false);
  setPolicy("linear"); // 원복
});

test("resolveEntry: 진행도에 맞는 다음 지점", () => {
  assert.equal(resolveEntry(freshState(), N), "prologue");
  assert.equal(resolveEntry({ name: "a", solved: 0 }, N), 0);
  assert.equal(resolveEntry({ name: "a", solved: N }, N), "finale");
  assert.equal(resolveEntry({ name: "a", solved: N + 1 }, N), "done");
});

test("nextStage: 노드→다음노드→finale→done", () => {
  assert.equal(nextStage(0, N), 1);
  assert.equal(nextStage(N - 1, N), "finale");
  assert.equal(nextStage("finale", N), "done");
});

/* ---- state (메모리 storage 주입) ---- */
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
}

test("state 저장/로드 왕복", () => {
  const st = memStorage();
  const s = { v: 1, name: "홍길동", solved: 2, stage: "scan" };
  saveState(s, st);
  assert.deepEqual(loadState(st), s);
});

test("state: 손상된 값은 fresh로", () => {
  const st = memStorage();
  st.setItem("gukjunggwak_dokkaebi_v1", "{not json");
  assert.deepEqual(loadState(st), freshState());
});

test("state: 구버전(v 불일치)은 fresh로", () => {
  const st = memStorage();
  st.setItem("gukjunggwak_dokkaebi_v1", JSON.stringify({ v: 0, name: "x", solved: 3 }));
  assert.deepEqual(loadState(st), freshState());
});

test("resetState는 저장을 지운다", () => {
  const st = memStorage();
  saveState({ v: 1, name: "x", solved: 1, stage: 1 }, st);
  const r = resetState(st);
  assert.deepEqual(r, freshState());
  assert.equal(loadState(st).name, "");
});
