// watch.ts 로직을 그대로 옮겨 검증 (브라우저 API인 btoa/atob는 Node 내장 사용)
const BUCKET_SEC = 5
const enc = b => Buffer.from(b).toString('base64')
const dec = (b64, n) => { const o = new Uint8Array(n); if(!b64) return o
  const s = Buffer.from(b64,'base64'); for(let i=0;i<Math.min(s.length,n);i++) o[i]=s[i]; return o }
const bucketCount = d => Math.max(1, Math.ceil(d/BUCKET_SEC))
const byteLength = d => Math.ceil(bucketCount(d)/8)
const mark = (b,i)=>{ if(i<0) return; const by=i>>3; if(by>=b.length) return; b[by]|=1<<(i&7) }
const markRange=(b,f,t)=>{ const d=t-f
  if(!(d>0)||d>30){ mark(b,Math.floor(t/BUCKET_SEC)); return }
  for(let s=Math.floor(f/BUCKET_SEC);s<=Math.floor(t/BUCKET_SEC);s++) mark(b,s) }
const seen=(b,d)=>{ let n=0; for(const x of b){let v=x; while(v){n+=v&1; v>>=1}} return Math.min(d,n*BUCKET_SEC) }
const seed=(b,w)=>{ const u=Math.ceil(w/BUCKET_SEC); for(let i=0;i<u;i++) mark(b,i) }

let pass=0, fail=0
const t=(name,cond,extra='')=>{ if(cond){pass++; console.log('  ✓',name)} else {fail++; console.log('  ✗',name,extra)} }

// 시청 시뮬레이터: from~to를 0.5초 간격으로 샘플링해 재생 (배속 speed 지원)
function watch(bits, from, to, speed=1){
  let last=from
  for(let pos=from; pos<=to; pos+=0.5*speed){ markRange(bits,last,pos); last=pos }
  markRange(bits,last,to); return to
}

const D=300 // 5분 영상

console.log('\n[1] 사용자가 겪은 버그: 나눠 보기')
{
  let bits=dec(undefined,byteLength(D))
  watch(bits,0,204)                       // 1회차: 0~204초 (68%)
  const s1=seen(bits,D)
  const saved=enc(bits)
  bits=dec(saved,byteLength(D))           // 앱을 껐다 켬
  watch(bits,204,300)                     // 2회차: 나머지
  const s2=seen(bits,D)
  t(`1회차 68% (${Math.round(s1/D*100)}%)`, Math.round(s1/D*100)===68)
  t(`2회차 뒤 100% (${Math.round(s2/D*100)}%) — 예전엔 68%에서 멈췄음`, s2>=D*0.9, `s2=${s2}`)
}

console.log('\n[2] 세 번에 나눠 보기')
{
  let bits=dec(undefined,byteLength(D)), b64
  for(const [a,z] of [[0,100],[100,200],[200,300]]){
    bits=dec(b64,byteLength(D)); watch(bits,a,z); b64=enc(bits)
  }
  t('전 구간 누적 → 완료', seen(dec(b64,byteLength(D)),D)>=D*0.9)
}

console.log('\n[3] 배속 재생 (2배속으로 전체 시청)')
{
  const bits=dec(undefined,byteLength(D)); watch(bits,0,300,2)
  t('2배속도 100% 인정', seen(bits,D)>=D*0.9, `seen=${seen(bits,D)}`)
}

console.log('\n[4] 스킵 방지')
{
  const bits=dec(undefined,byteLength(D))
  markRange(bits,0,5); markRange(bits,5,295)   // 끝으로 점프
  t('끝으로 점프해도 완료 안 됨', seen(bits,D) < D*0.9, `seen=${seen(bits,D)}`)
}
{
  const bits=dec(undefined,byteLength(D))
  for(let i=0;i<5;i++) watch(bits,0,60)        // 앞부분만 5번 반복
  t('앞부분 반복 재생은 누적되지 않음', seen(bits,D) < D*0.9, `seen=${seen(bits,D)}`)
}

console.log('\n[5] 기존 사용자 이행 (구 데이터에 seen 없음)')
{
  const bits=dec(undefined,byteLength(D)); seed(bits,204)   // 예전 기록 204초
  t('기존 진도 보존 (깎이지 않음)', seen(bits,D)>=204, `${seen(bits,D)}`)
  watch(bits,204,300)
  t('이어보기로 완료 도달', seen(bits,D)>=D*0.9)
}

console.log('\n[6] 메타데이터 길이가 틀린 경우')
{
  const meta=320, real=280                      // 실제가 더 짧음
  const bits=dec(undefined,byteLength(real)); watch(bits,0,real)
  t('실제 길이 기준이면 완료', seen(bits,real)>=real*0.9)
  const wrong=seen(bits,real)/meta
  t('메타 길이로 재면 미완료 → 실제 길이를 써야 함', wrong<0.9, `${Math.round(wrong*100)}%`)
}

console.log('\n[7] 저장 크기')
{
  const sizes=[300,600,1800].map(d=>enc(dec(undefined,byteLength(d))).length)
  t(`5분 ${sizes[0]}자 / 10분 ${sizes[1]}자 / 30분 ${sizes[2]}자`, sizes[2]<80)
}

console.log(`\n통과 ${pass} / 실패 ${fail}`)
process.exit(fail?1:0)
