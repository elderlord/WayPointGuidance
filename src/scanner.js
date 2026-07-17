/* =========================================================================
   인앱 QR 스캐너 — 앱이 켜진 채 카메라로 현장 토큰을 읽는다.
   디코딩은 vendor/jsqr.js(전역 window.jsQR)를 사용. 없으면 스캔 비활성(수동 입력만).
   카메라 권한 거부/미지원 시에도 앱은 수동 토큰 입력으로 항상 진행 가능.
   ========================================================================= */

export function scannerSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.jsQR);
}

/**
 * 스캐너 컨트롤러를 만든다.
 * @param {HTMLVideoElement} video
 * @param {(token:string)=>void} onResult 유효 프레임에서 토큰 디코드 시 1회 호출
 * @param {(msg:string)=>void} onError 사용자 안내 메시지
 */
export function createScanner(video, onResult, onError) {
  let stream = null;
  let raf = 0;
  let running = false;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  async function start() {
    if (running) return;
    if (!scannerSupported()) {
      onError?.("이 기기에선 카메라 스캔을 쓸 수 없어요. 아래에 번호를 직접 입력하세요.");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      running = true;
      tick();
    } catch (e) {
      onError?.("카메라를 열 수 없어요(권한 거부 등). 아래에 번호를 직접 입력하세요.");
    }
  }

  // 계속 스캔하되, 같은 코드가 프레임에 머무를 때 콜백이 폭주하지 않도록 쿨다운.
  // 인식 성공 시에도 자동 정지하지 않는다 — 진행 여부는 app이 결정(맞으면 stop 호출).
  let lastToken = null;
  let lastEmit = 0;
  const COOLDOWN_MS = 1500;

  function tick() {
    if (!running) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        // 새 코드거나 쿨다운이 지났을 때만 1회 통지
        if (code.data !== lastToken || now - lastEmit > COOLDOWN_MS) {
          lastToken = code.data;
          lastEmit = now;
          onResult?.(code.data); // app이 맞으면 stop()을 호출해 정지시킨다
        }
      }
    }
    if (running) raf = requestAnimationFrame(tick); // onResult가 stop 했으면 재예약 안 함
  }

  // 디코딩만 멈추고 카메라 프리뷰는 유지(확인 링 애니메이션 동안 화면이 검게 되지 않도록)
  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function stop() {
    pause();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  return { start, pause, stop, isRunning: () => running };
}
