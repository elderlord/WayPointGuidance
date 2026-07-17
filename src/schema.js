/* =========================================================================
   콘텐츠 스키마 검증 — 저작도구(또는 손편집) 출력이 계약을 지키는지 확인.
   앱 부팅 시 1회 호출하여 잘못된 콘텐츠로 렌더가 깨지는 것을 조기에 차단.
   순수 함수 — DOM/브라우저 의존 없음(Node에서 그대로 테스트 가능).
   ========================================================================= */

/** 미션 선택지 배열 검증: 비어있지 않고 정확히 하나의 정답을 가져야 함. */
function validateOptions(options, where, errors) {
  if (!Array.isArray(options) || options.length === 0) {
    errors.push(`${where}: options는 비어있지 않은 배열이어야 합니다`);
    return;
  }
  let correct = 0;
  options.forEach((o, i) => {
    if (typeof o.t !== "string" || o.t.trim() === "")
      errors.push(`${where}.options[${i}].t 는 비어있지 않은 문자열이어야 합니다`);
    if (typeof o.correct !== "boolean")
      errors.push(`${where}.options[${i}].correct 는 boolean이어야 합니다`);
    if (o.correct === true) correct++;
  });
  if (correct !== 1)
    errors.push(`${where}: 정답(correct:true)은 정확히 1개여야 합니다 (현재 ${correct}개)`);
}

/** 필수 문자열 필드 확인 */
function requireStr(obj, key, where, errors) {
  if (typeof obj?.[key] !== "string" || obj[key].trim() === "")
    errors.push(`${where}.${key} 는 비어있지 않은 문자열이어야 합니다`);
}

/**
 * 콘텐츠 객체를 검증한다.
 * @param {object} content
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateContent(content) {
  const errors = [];

  if (!content || typeof content !== "object") {
    return { ok: false, errors: ["content 는 객체여야 합니다"] };
  }

  // meta
  requireStr(content.meta, "rewardCode", "meta", errors);
  requireStr(content.meta, "placeholderName", "meta", errors);
  const pct = content.meta?.sciencePct;
  if (!Array.isArray(pct) || pct.length !== 6)
    errors.push("meta.sciencePct 는 길이 6의 배열이어야 합니다 (완료 0~5단계)");

  // prologue
  ["taunt", "nameLabel", "cta"].forEach((k) =>
    requireStr(content.prologue, k, "prologue", errors)
  );

  // nodes
  if (!Array.isArray(content.nodes) || content.nodes.length === 0) {
    errors.push("nodes 는 비어있지 않은 배열이어야 합니다");
  } else {
    const seenTokens = new Set();
    content.nodes.forEach((n, i) => {
      const where = `nodes[${i}]`;
      ["token", "title", "taunt", "tale", "question", "reveal", "react", "nextClue"].forEach(
        (k) => requireStr(n, k, where, errors)
      );
      validateOptions(n.options, where, errors);
      if (typeof n.token === "string") {
        if (seenTokens.has(n.token))
          errors.push(`${where}.token '${n.token}' 이 중복됩니다`);
        seenTokens.add(n.token);
      }
    });
  }

  // finale
  ["token", "title", "climax", "question", "reveal", "concession"].forEach((k) =>
    requireStr(content.finale, k, "finale", errors)
  );
  validateOptions(content.finale?.options, "finale", errors);

  // done
  ["resultText", "badgeTitle", "codeLabel"].forEach((k) =>
    requireStr(content.done, k, "done", errors)
  );

  // wrong
  if (!Array.isArray(content.wrong) || content.wrong.length === 0)
    errors.push("wrong 은 비어있지 않은 배열이어야 합니다");

  return { ok: errors.length === 0, errors };
}
