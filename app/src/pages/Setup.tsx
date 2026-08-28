import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import type { Duration } from '../lib/types'

const OPTIONS: { key: Duration; title: string; desc: string; daily: string }[] = [
  { key: '6m', title: '6개월', desc: '합격선 통과 최소 코어 (영어 중급 이상 권장)', daily: '하루 100분 · 주 6일' },
  { key: '1y', title: '1년', desc: '표준 과정 — 기본값 권장', daily: '하루 65분 · 주 5일' },
  { key: '2y', title: '2년', desc: '선행(산수·중학과학) 포함, 영어 초급', daily: '하루 45분 · 주 5일' },
  { key: '3y', title: '3년', desc: '중학 과정부터 차근차근 + 고득점 심화', daily: '하루 35분 · 주 5일' },
]

export default function Setup() {
  const { profile } = useAppState()
  const nav = useNavigate()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />

  function pick(d: Duration) {
    store.setProfile({ ...profile!, duration: d })
    nav('/placement')
  }

  return (
    <div className="page narrow">
      <h1>학습 기간 선택</h1>
      <p className="muted">기간은 학습 <b>분량</b>을 결정합니다 (속도가 아니라). 다음 단계에서 배치 테스트로 난이도(레벨)를 정합니다.</p>
      <div className="option-grid">
        {OPTIONS.map((o) => (
          <button key={o.key} className="card option" onClick={() => pick(o.key)}>
            <div className="option-title">{o.title}</div>
            <div className="muted">{o.desc}</div>
            <div className="badge">{o.daily}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
