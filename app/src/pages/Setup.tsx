import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import { useT, type Dict } from '../lib/i18n'
import type { Duration } from '../lib/types'

interface Option {
  key: Duration
  title: string
  desc: string
  daily: string
  scope: string
}

function options(t: Dict): Option[] {
  return [
    { key: '6m', title: t.d6m, desc: t.d6mDesc, daily: t.d6mDaily, scope: t.d6mScope },
    { key: '1y', title: t.d1y, desc: t.d1yDesc, daily: t.d1yDaily, scope: t.d1yScope },
  ]
}

export default function Setup() {
  const { profile } = useAppState()
  const { t } = useT()
  const nav = useNavigate()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />

  function pick(d: Duration) {
    // 입학 기준이 CEFR B1 이상이라 진행 방식은 4과목 병행 하나뿐 — 고를 것이 없다
    store.setProfile({ ...profile!, duration: d, style: 'parallel' })
    nav('/placement')
  }

  return (
    <div className="page narrow">
      <p className="step-label">{t.setupStep}</p>
      <h1>{t.setupTitle}</h1>
      <p className="muted">{t.setupDesc}</p>

      <div className="card entry-note">
        <h3>{t.entryTitle}</h3>
        <p className="muted">{t.entryDesc}</p>
      </div>

      <div className="option-grid">
        {options(t).map((o) => (
          <button key={o.key} className="card option" onClick={() => pick(o.key)}>
            <div className="option-title">{o.title}</div>
            <div className="muted">{o.desc}</div>
            <div className="option-scope muted small">{o.scope}</div>
            <div className="badge">{o.daily}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
