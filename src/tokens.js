/* =========================================================================
   토큰 매칭 — 현장 QR에 인쇄된 순수 식별 토큰(NSM-0X)을 지점(stage)에 매핑.
   토큰 목록은 콘텐츠 데이터(각 node.token, finale.token)에서 유도한다.
   (QR에 URL을 심지 않는다. 앱이 켜진 채 내장 스캐너로 이 토큰을 읽어 매칭)
   ========================================================================= */

/** 스캔 입력을 관대하게 정규화: 대문자, 공백 제거, "nsm03"→"NSM-03" 보정 */
export function normalizeToken(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^([A-Z]+)-?(\d+)$/); // 접두사와 숫자 사이 하이픈 선택적
  if (m) s = `${m[1]}-${m[2].padStart(2, "0")}`;
  return s;
}

/**
 * 콘텐츠로부터 토큰→stage 룩업 맵을 만든다.
 * @returns {Map<string, Stage>} 예: "NSM-01"→0, "NSM-05"→"finale"
 */
export function buildTokenMap(content) {
  const map = new Map();
  content.nodes.forEach((n, i) => {
    if (n.token) map.set(normalizeToken(n.token), i);
  });
  if (content.finale?.token) map.set(normalizeToken(content.finale.token), "finale");
  return map;
}

/**
 * 스캔 결과 토큰을 지점으로 해석.
 * @returns {{ok: boolean, stage?: Stage, token: string}}
 */
export function resolveToken(raw, tokenMap) {
  const token = normalizeToken(raw);
  if (tokenMap.has(token)) return { ok: true, stage: tokenMap.get(token), token };
  return { ok: false, token };
}
