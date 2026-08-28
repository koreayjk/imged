import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store, placementQuestions, scoreToLevel } from '../lib/store'
import { useT, levelLabel } from '../lib/i18n'
import type { Question } from '../lib/types'

type Phase = 'intro' | 'math' | 'english' | 'result'

function txt(i18n: Record<string, string>, lang: string) {
  return i18n[lang] ?? i18n.en ?? Object.values(i18n)[0] ?? ''
}

export default function Placement() {
  const { profile } = useAppState()
  const { t } = useT()
  const nav = useNavigate()
  const [phase, setPhase] = useState<Phase>('intro')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, boolean[]>>({ math: [], english: [] })

  const mathQs = useMemo(() => placementQuestions('math'), [])
  const engQs = useMemo(() => placementQuestions('rla'), [])

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  if (!profile.duration) return <Navigate to="/setup" replace />
  if (profile.levelMath && profile.levelEnglish) return <Navigate to="/today" replace />

  const lang = profile.nativeLang
  const qs: Question[] = phase === 'math' ? mathQs : engQs
  const q = qs[idx]

  function answer(choiceId: string) {
    const correct = choiceId === q.answer.choice
    const key = phase === 'math' ? 'math' : 'english'
    const next = { ...answers, [key]: [...answers[key], correct] }
    setAnswers(next)
    if (idx + 1 < qs.length) {
      setIdx(idx + 1)
    } else if (phase === 'math') {
      setPhase('english'); setIdx(0)
    } else {
      setPhase('result')
    }
  }

  function pct(arr: boolean[]) {
    return arr.length ? Math.round((arr.filter(Boolean).length / arr.length) * 100) : 0
  }

  if (phase === 'intro') {
    return (
      <div className="page narrow">
        <h1>{t.placementTitle}</h1>
        <p>{t.placementIntro(mathQs.length, engQs.length)}</p>
        <ul className="muted">
          <li>{t.cutBasic}</li>
          <li>{t.cutInter}</li>
          <li>{t.cutAdv}</li>
        </ul>
        <p className="muted">{t.placementTip}</p>
        <button className="primary" onClick={() => setPhase('math')}>{t.startTest}</button>
      </div>
    )
  }

  if (phase === 'result') {
    const mp = pct(answers.math)
    const ep = pct(answers.english)
    const lm = scoreToLevel(mp)
    const le = scoreToLevel(ep)
    return (
      <div className="page narrow">
        <h1>{t.resultTitle}</h1>
        <div className="result-grid">
          <div className="card">
            <div className="muted">{t.math}</div>
            <div className="score">{mp}%</div>
            <div className="badge big">{levelLabel(t, lm)}</div>
          </div>
          <div className="card">
            <div className="muted">{t.english}</div>
            <div className="score">{ep}%</div>
            <div className="badge big">{levelLabel(t, le)}</div>
          </div>
        </div>
        <p className="muted">{t.scienceNote}</p>
        <button
          className="primary"
          onClick={() => {
            store.setProfile({
              ...profile, levelMath: lm, levelEnglish: le,
              startedAt: new Date().toISOString(),
            })
            nav('/today')
          }}
        >
          {t.generateRoadmap}
        </button>
      </div>
    )
  }

  return (
    <div className="page narrow">
      <div className="quiz-head">
        <span className="badge">{phase === 'math' ? t.math : t.english}</span>
        <span className="muted">{idx + 1} / {qs.length}</span>
      </div>
      <div className="progressbar"><div style={{ width: `${(idx / qs.length) * 100}%` }} /></div>
      <div className="card">
        <p className="stem">{txt(q.stem_i18n, 'en')}</p>
        {lang !== 'en' && q.stem_i18n[lang] && <p className="muted small">{q.stem_i18n[lang]}</p>}
        <div className="choices">
          {q.choices.map((c) => (
            <button key={c.id} className="choice" onClick={() => answer(c.id)}>
              <b>{c.id.toUpperCase()}.</b> {txt(c.text_i18n, 'en')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
