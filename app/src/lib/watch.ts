// 영상 시청 구간 추적 — "몇 초 동안 틀어놨나"가 아니라 "어느 구간을 봤나"를 기록한다.
//
// 틱 카운트 방식은 세 가지 문제가 있었다:
//   1) 여러 번 나눠 보면 두 번째 시청분이 반영되지 않음 (카운터가 0에서 다시 시작)
//   2) 배속 재생·백그라운드 탭에서 실제 재생 위치와 어긋남
//   3) 앞부분만 반복 재생해도 시간이 쌓임
// 재생 위치를 5초 버킷 비트맵으로 남기면 세 문제가 모두 사라지고,
// 중단했다 이어 봐도 이전에 본 구간이 그대로 유지된다.

export const BUCKET_SEC = 5

/** 비트맵 → base64 (localStorage·서버 동기화용). 10분 영상이 약 20자. */
export function encodeSeen(bits: Uint8Array): string {
  let s = ''
  for (const b of bits) s += String.fromCharCode(b)
  return btoa(s)
}

export function decodeSeen(b64: string | undefined, byteLen: number): Uint8Array {
  const out = new Uint8Array(byteLen)
  if (!b64) return out
  try {
    const s = atob(b64)
    for (let i = 0; i < Math.min(s.length, byteLen); i++) out[i] = s.charCodeAt(i)
  } catch { /* 손상된 값은 빈 비트맵으로 */ }
  return out
}

export function bucketCount(durationSec: number): number {
  return Math.max(1, Math.ceil(durationSec / BUCKET_SEC))
}

export function byteLength(durationSec: number): number {
  return Math.ceil(bucketCount(durationSec) / 8)
}

export function markBucket(bits: Uint8Array, index: number): void {
  if (index < 0) return
  const byte = index >> 3
  if (byte >= bits.length) return
  bits[byte] |= 1 << (index & 7)
}

/** from~to 구간을 채운다. 큰 점프(구간 이동)는 현재 위치만 표시해 스킵을 막는다. */
export function markRange(bits: Uint8Array, fromSec: number, toSec: number): void {
  const delta = toSec - fromSec
  if (!(delta > 0) || delta > 30) {
    markBucket(bits, Math.floor(toSec / BUCKET_SEC))
    return
  }
  for (let s = Math.floor(fromSec / BUCKET_SEC); s <= Math.floor(toSec / BUCKET_SEC); s++) {
    markBucket(bits, s)
  }
}

/** 실제로 본 구간의 길이(초). */
export function seenSeconds(bits: Uint8Array, durationSec: number): number {
  let n = 0
  for (const b of bits) {
    let v = b
    while (v) { n += v & 1; v >>= 1 }
  }
  return Math.min(durationSec, n * BUCKET_SEC)
}

/**
 * 구간 기록이 없는 기존 사용자를 위한 이행 처리.
 * 예전에는 누적 초만 저장했으므로, 앞에서부터 그만큼 본 것으로 간주해 비트맵을 채운다.
 * 이렇게 해야 이미 쌓아둔 진도를 잃지 않으면서 이어보기가 정상 동작한다.
 */
export function seedFromLegacy(bits: Uint8Array, watchedSeconds: number): void {
  // 버킷 경계에서 내림하면 이미 쌓아둔 진도가 몇 초 깎인다. 형식이 바뀌었다는
  // 이유로 학생 진도를 줄이지 않도록 올림 처리한다.
  const upto = Math.ceil(watchedSeconds / BUCKET_SEC)
  for (let i = 0; i < upto; i++) markBucket(bits, i)
}
