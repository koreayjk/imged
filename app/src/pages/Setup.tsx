import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import { useT, type Dict } from '../lib/i18n'
import type { Duration } from '../lib/types'

function options(t: Dict): { key: Duration; title: string; desc: string; daily: string }[] {
  return [
    { key: '6m', title: t.d6m, desc: t.d6mDesc, daily: t.d6mDaily },
    { key: '1y', title: t.d1y, desc: t.d1yDesc, daily: t.d1yDaily },
    { key: '2y', title: t.d2y, desc: t.d2yDesc, daily: t.d2yDaily },
    { key: '3y', title: t.d3y, desc: t.d3yDesc, daily: t.d3yDaily },
  ]
}

export default function Setup() {
  const { profile } = useAppState()
  const { t } = useT()
  const nav = useNavigate()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />

  function pick(d: Duration) {
    store.setProfile({ ...profile!, duration: d })
    nav('/placement')
  }

  return (
    <div className="page narrow">
      <h1>{t.setupTitle}</h1>
      <p className="muted">{t.setupDesc}</p>
      <div className="option-grid">
        {options(t).map((o) => (
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
