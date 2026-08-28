import { Navigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { useT, durationLabel, levelLabel } from '../lib/i18n'

// 관리자 대시보드 최소판.
// 데모 모드에서는 이 브라우저의 학생 데이터만 보인다. Supabase 연결 시 전체 학생 집계로 교체.
export default function Admin() {
  const state = useAppState()
  const { t } = useT()
  const p = state.profile
  if (!p) return <Navigate to="/login" replace />
  if (p.role !== 'admin') return <Navigate to="/today" replace />

  const doneDays = Object.values(state.dayStates).filter((d) => d.finished).length
  const attempts = state.attempts
  const correctPct = attempts.length
    ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null

  const cells: { date: string; on: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, on: !!state.attendance[key] })
  }

  const riskFlags: string[] = []
  const last3 = cells.slice(-3)
  if (last3.every((c) => !c.on)) riskFlags.push(t.risk3days)
  if (correctPct !== null && correctPct < 40) riskFlags.push(t.riskAccuracy)

  return (
    <div className="page">
      <h1>{t.adminTitle}</h1>
      <p className="muted">{t.adminDemoNote}</p>

      <div className="stat-grid">
        <div className="card stat"><div className="score">1</div><div className="muted">{t.enrolled}</div></div>
        <div className="card stat"><div className="score">{doneDays}</div><div className="muted">{t.doneDaysLabel}</div></div>
        <div className="card stat"><div className="score">{attempts.length}</div><div className="muted">{t.totalAttempts}</div></div>
        <div className="card stat"><div className="score">{correctPct !== null ? `${correctPct}%` : '—'}</div><div className="muted">{t.avgAccuracy}</div></div>
      </div>

      <div className="card">
        <h3>{t.attendance14}</h3>
        <div className="heatmap">
          {cells.map((c) => (
            <div key={c.date} className={`hm-cell ${c.on ? 'on' : ''}`} title={c.date} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3>{t.riskTitle}</h3>
        {riskFlags.length === 0
          ? <p className="muted">{t.noAlerts}</p>
          : <ul>{riskFlags.map((f) => <li key={f}>🚨 {f}</li>)}</ul>}
      </div>

      <div className="card">
        <h3>{t.studentsTitle}</h3>
        <table className="table">
          <thead><tr><th>{t.thName}</th><th>{t.thDuration}</th><th>{t.thMath}</th><th>{t.thEnglish}</th><th>{t.thDays}</th><th>{t.thAccuracy}</th></tr></thead>
          <tbody>
            <tr>
              <td>{t.thisBrowser}</td>
              <td>{state.profile?.duration ? durationLabel(t, state.profile.duration) : '—'}</td>
              <td>{state.profile?.levelMath ? levelLabel(t, state.profile.levelMath) : '—'}</td>
              <td>{state.profile?.levelEnglish ? levelLabel(t, state.profile.levelEnglish) : '—'}</td>
              <td>{doneDays}{t.unitDays}</td>
              <td>{correctPct !== null ? `${correctPct}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
