import { Navigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { DURATION_LABEL, LEVEL_LABEL } from '../lib/types'

// 관리자 대시보드 최소판.
// 데모 모드에서는 이 브라우저의 학생 데이터만 보인다. Supabase 연결 시 전체 학생 집계로 교체.
export default function Admin() {
  const state = useAppState()
  const p = state.profile
  if (!p) return <Navigate to="/login" replace />
  if (p.role !== 'admin') return <Navigate to="/today" replace />

  const doneDays = Object.values(state.dayStates).filter((d) => d.finished).length
  const attempts = state.attempts
  const correctPct = attempts.length
    ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null

  // 최근 14일 출석 히트맵
  const cells: { date: string; on: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, on: !!state.attendance[key] })
  }

  const riskFlags: string[] = []
  const last3 = cells.slice(-3)
  if (last3.every((c) => !c.on)) riskFlags.push('3일 이상 미접속')
  if (correctPct !== null && correctPct < 40) riskFlags.push('정답률 급락 (40% 미만)')

  return (
    <div className="page">
      <h1>관리자 대시보드</h1>
      <p className="muted">데모 모드: 이 브라우저의 학생 데이터 기준. Supabase 연결 시 전체 학생 목록·집계로 확장됩니다.</p>

      <div className="stat-grid">
        <div className="card stat"><div className="score">1</div><div className="muted">등록 학생 (데모)</div></div>
        <div className="card stat"><div className="score">{doneDays}</div><div className="muted">완료 학습일</div></div>
        <div className="card stat"><div className="score">{attempts.length}</div><div className="muted">총 풀이 문항</div></div>
        <div className="card stat"><div className="score">{correctPct !== null ? `${correctPct}%` : '—'}</div><div className="muted">평균 정답률</div></div>
      </div>

      <div className="card">
        <h3>최근 14일 출석</h3>
        <div className="heatmap">
          {cells.map((c) => (
            <div key={c.date} className={`hm-cell ${c.on ? 'on' : ''}`} title={c.date} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3>⚠️ 이탈 위험 알림</h3>
        {riskFlags.length === 0
          ? <p className="muted">현재 알림 없음</p>
          : <ul>{riskFlags.map((f) => <li key={f}>🚨 {f}</li>)}</ul>}
      </div>

      <div className="card">
        <h3>학생 (데모)</h3>
        <table className="table">
          <thead><tr><th>이름</th><th>기간</th><th>수학</th><th>영어</th><th>완료일</th><th>정답률</th></tr></thead>
          <tbody>
            <tr>
              <td>이 브라우저의 학생</td>
              <td>{state.profile?.duration ? DURATION_LABEL[state.profile.duration] : '—'}</td>
              <td>{state.profile?.levelMath ? LEVEL_LABEL[state.profile.levelMath] : '—'}</td>
              <td>{state.profile?.levelEnglish ? LEVEL_LABEL[state.profile.levelEnglish] : '—'}</td>
              <td>{doneDays}일</td>
              <td>{correctPct !== null ? `${correctPct}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
