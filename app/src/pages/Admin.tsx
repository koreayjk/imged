import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { useT, durationLabel, levelLabel, type Dict } from '../lib/i18n'
import { supabaseEnabled } from '../lib/supabase'
import { fetchStudents, type StudentSummary } from '../lib/sync'

function Heatmap({ attendance }: { attendance: Record<string, boolean> }) {
  const cells: { date: string; on: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, on: !!attendance[key] })
  }
  return (
    <div className="heatmap">
      {cells.map((c) => <div key={c.date} className={`hm-cell ${c.on ? 'on' : ''}`} title={c.date} />)}
    </div>
  )
}

function riskOf(t: Dict, s: StudentSummary): string[] {
  const flags: string[] = []
  const now = new Date()
  const recent3 = [0, 1, 2].some((i) => {
    const d = new Date(now); d.setDate(d.getDate() - i)
    return s.attendance[d.toISOString().slice(0, 10)]
  })
  if (!recent3) flags.push(t.risk3days)
  if (s.correctPct !== null && s.correctPct < 40) flags.push(t.riskAccuracy)
  return flags
}

function SupabaseAdmin() {
  const { t } = useT()
  const [students, setStudents] = useState<StudentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStudents().then(setStudents).catch((e) => setError(String(e?.message ?? e)))
  }, [])

  if (error) return <div className="page"><h1>{t.adminTitle}</h1><p>{t.loadFailed}: {error}</p><p className="muted small">{t.notAdminNote}</p></div>
  if (!students) return <div className="page muted">{t.loading}</div>

  const totalAttempts = students.reduce((s, x) => s + x.attempts, 0)
  const withAcc = students.filter((s) => s.correctPct !== null)
  const avgAcc = withAcc.length
    ? Math.round(withAcc.reduce((s, x) => s + (x.correctPct ?? 0), 0) / withAcc.length) : null
  const atRisk = students.map((s) => ({ s, flags: riskOf(t, s) })).filter((x) => x.flags.length > 0)

  // 전체 출석 합산 히트맵
  const merged: Record<string, boolean> = {}
  for (const s of students) for (const [k, v] of Object.entries(s.attendance)) if (v) merged[k] = true

  return (
    <div className="page">
      <h1>{t.adminTitle}</h1>
      <div className="stat-grid">
        <div className="card stat"><div className="score">{students.length}</div><div className="muted">{t.enrolledReal}</div></div>
        <div className="card stat"><div className="score">{students.reduce((s, x) => s + x.doneDays, 0)}</div><div className="muted">{t.doneDaysLabel}</div></div>
        <div className="card stat"><div className="score">{totalAttempts}</div><div className="muted">{t.totalAttempts}</div></div>
        <div className="card stat"><div className="score">{avgAcc !== null ? `${avgAcc}%` : '—'}</div><div className="muted">{t.avgAccuracy}</div></div>
      </div>

      <div className="card">
        <h3>{t.attendance14}</h3>
        <Heatmap attendance={merged} />
      </div>

      <div className="card">
        <h3>{t.riskTitle}</h3>
        {atRisk.length === 0
          ? <p className="muted">{t.noAlerts}</p>
          : <ul>{atRisk.map(({ s, flags }) => <li key={s.id}>🚨 <b>{s.name}</b> — {flags.join(' · ')}</li>)}</ul>}
      </div>

      <div className="card">
        <h3>{t.studentsReal}</h3>
        {students.length === 0 ? <p className="muted">{t.noStudents}</p> : (
          <table className="table">
            <thead><tr><th>{t.thName}</th><th>{t.thDuration}</th><th>{t.thMath}</th><th>{t.thEnglish}</th><th>{t.thDays}</th><th>{t.thAccuracy}</th><th>{t.thLastActive}</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.duration ? durationLabel(t, s.duration) : '—'}</td>
                  <td>{s.levelMath ? levelLabel(t, s.levelMath) : '—'}</td>
                  <td>{s.levelEnglish ? levelLabel(t, s.levelEnglish) : '—'}</td>
                  <td>{s.doneDays}{t.unitDays}</td>
                  <td>{s.correctPct !== null ? `${s.correctPct}%` : '—'}</td>
                  <td className="muted small">{s.lastActive ? s.lastActive.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function DemoAdmin() {
  const state = useAppState()
  const { t } = useT()
  const doneDays = Object.values(state.dayStates).filter((d) => d.finished).length
  const attempts = state.attempts
  const correctPct = attempts.length
    ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null

  const riskFlags: string[] = []
  const recent3 = [0, 1, 2].some((i) => {
    const d = new Date(); d.setDate(d.getDate() - i)
    return state.attendance[d.toISOString().slice(0, 10)]
  })
  if (!recent3) riskFlags.push(t.risk3days)
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
        <Heatmap attendance={state.attendance} />
      </div>
      <div className="card">
        <h3>{t.riskTitle}</h3>
        {riskFlags.length === 0
          ? <p className="muted">{t.noAlerts}</p>
          : <ul>{riskFlags.map((f) => <li key={f}>🚨 {f}</li>)}</ul>}
      </div>
    </div>
  )
}

export default function Admin() {
  const state = useAppState()
  const p = state.profile
  if (!p) return <Navigate to="/login" replace />
  if (p.role !== 'admin') return <Navigate to="/today" replace />
  return supabaseEnabled ? <SupabaseAdmin /> : <DemoAdmin />
}
