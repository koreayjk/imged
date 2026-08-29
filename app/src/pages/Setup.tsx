import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store, loadTemplate } from '../lib/store'
import { useT, type Dict } from '../lib/i18n'
import type { CurriculumStyle, Duration } from '../lib/types'

function durationOptions(t: Dict): { key: Duration; title: string; desc: string; daily: string }[] {
  return [
    { key: '6m', title: t.d6m, desc: t.d6mDesc, daily: t.d6mDaily },
    { key: '1y', title: t.d1y, desc: t.d1yDesc, daily: t.d1yDaily },
    { key: '2y', title: t.d2y, desc: t.d2yDesc, daily: t.d2yDaily },
    { key: '3y', title: t.d3y, desc: t.d3yDesc, daily: t.d3yDaily },
  ]
}

interface StyleInfo {
  key: CurriculumStyle
  title: string
  tag: string
  how: string
  pros: string[]
  con: string
  recommended?: boolean
}

function styleOptions(t: Dict): StyleInfo[] {
  return [
    {
      key: 'focus', title: t.styleFocus, tag: t.styleFocusTag, how: t.styleFocusHow,
      pros: [t.styleFocusPro1, t.styleFocusPro2, t.styleFocusPro3], con: t.styleFocusCon,
      recommended: true,
    },
    {
      key: 'parallel', title: t.styleParallel, tag: t.styleParallelTag, how: t.styleParallelHow,
      pros: [t.styleParallelPro1, t.styleParallelPro2, t.styleParallelPro3], con: t.styleParallelCon,
    },
  ]
}

/** 첫 주에 실제로 어떤 과목이 나오는지 — 설명 대신 실제 로드맵에서 읽어온다. */
function useFirstWeek(duration: Duration | null, style: CurriculumStyle) {
  const [subjects, setSubjects] = useState<string[] | null>(null)
  useEffect(() => {
    if (!duration) return
    let alive = true
    loadTemplate(duration, 'basic', style)
      .then((tpl) => {
        if (!alive) return
        const names: string[] = []
        for (const d of tpl.days.filter((x) => x.week === 1)) {
          for (const b of d.blocks) {
            if (b.type === 'study' && b.label && !names.includes(b.label)) names.push(b.label)
          }
        }
        setSubjects(names)
      })
      .catch(() => alive && setSubjects(null))
    return () => { alive = false }
  }, [duration, style])
  return subjects
}

function StyleCard({ t, info, duration, onPick }: {
  t: Dict; info: StyleInfo; duration: Duration | null; onPick: (s: CurriculumStyle) => void
}) {
  const first = useFirstWeek(duration, info.key)
  return (
    <article className={`card style-card ${info.key}`}>
      <header className="style-head">
        <h2>
          {info.title}
          {info.recommended && <span className="badge style-rec">{t.styleRecommend}</span>}
        </h2>
        <p className="style-tag">{info.tag}</p>
      </header>

      <div className="style-sec">
        <h3>{t.styleHowLabel}</h3>
        <p>{info.how}</p>
      </div>

      <div className="style-sec">
        <h3>{t.styleFirstWeek}</h3>
        <div className="style-subjects">
          {(first ?? []).map((s) => <span key={s} className="badge">{s}</span>)}
          {first && first.length < 4 && <span className="muted small">{t.styleLater(4 - first.length)}</span>}
        </div>
      </div>

      <div className="style-sec">
        <h3>{t.styleProLabel}</h3>
        <ul className="style-pros">
          {info.pros.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>

      <div className="style-sec style-con">
        <h3>{t.styleConLabel}</h3>
        <p className="muted">{info.con}</p>
      </div>

      <button className="primary style-pick" onClick={() => onPick(info.key)}>{t.stylePick}</button>
    </article>
  )
}

export default function Setup() {
  const { profile } = useAppState()
  const { t } = useT()
  const nav = useNavigate()
  const [duration, setDuration] = useState<Duration | null>(null)

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />

  function pickStyle(style: CurriculumStyle) {
    store.setProfile({ ...profile!, duration, style })
    nav('/placement')
  }

  if (!duration) {
    return (
      <div className="page narrow">
        <p className="step-label">{t.setupStep}</p>
        <h1>{t.setupTitle}</h1>
        <p className="muted">{t.setupDesc}</p>
        <div className="option-grid">
          {durationOptions(t).map((o) => (
            <button key={o.key} className="card option" onClick={() => setDuration(o.key)}>
              <div className="option-title">{o.title}</div>
              <div className="muted">{o.desc}</div>
              <div className="badge">{o.daily}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page wide">
      <p className="step-label">{t.styleStep}</p>
      <h1>{t.styleTitle}</h1>
      <p className="muted">{t.styleDesc}</p>
      <div className="style-grid">
        {styleOptions(t).map((info) => (
          <StyleCard key={info.key} t={t} info={info} duration={duration} onPick={pickStyle} />
        ))}
      </div>
      <button className="ghost" onClick={() => setDuration(null)}>← {t.setupTitle}</button>
    </div>
  )
}
