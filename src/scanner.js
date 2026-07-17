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

  function tick() {
    if (!running) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        const token = code.data;
        stop();
        onResult?.(token);
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  return { start, stop, isRunning: () => running };
}
