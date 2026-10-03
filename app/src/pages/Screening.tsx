import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import { useT } from '../lib/i18n'
import { loadYouTubeApi } from '../lib/youtube'
import { TEST, allItems, score, type Item, type Result } from '../lib/screening'

/** 강의 이해 문항에 딸린 실제 칸 아카데미 영상 */
function LessonVideo({ videoId }: { videoId: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let dead = false
    let player: { destroy?: () => void } | null = null
    loadYouTubeApi().then((YT) => {
      if (dead || !host.current) return
      player = new YT.Player(host.current, {
        videoId, playerVars: { rel: 0, modestbranding: 1 },
      })
    })
    return () => { dead = true; player?.destroy?.() }
  }, [videoId])
  return <div className="scr-video"><div ref={host} /></div>
}

function Report({ result, onContinue }: { result: Result; onContinue: () => void }) {
  const { t } = useT()
  const label: Record<string, string> = {
    reading: t.scrReading, lesson: t.scrLesson, vocabulary: t.scrVocab,
  }
  return (
    <div className="page narrow">
      <p className="step-label">{t.scrStep}</p>
      <h1>{t.scrResultTitle}</h1>

      <div className={`card scr-verdict ${result.allow ? 'pass' : 'hold'}`}>
        <div className="scr-band">{result.band.cefr}</div>
        <div className="scr-pct">{result.pct}%</div>
        <p>{result.allow ? t.scrPass(result.band.cefr) : t.scrHold}</p>
      </div>

      <div className="card">
        <h3>{t.scrBreakdown}</h3>
        <ul className="scr-sections">
          {result.sections.map((s) => (
            <li key={s.id}>
              <span>{label[s.id] ?? s.id}</span>
              <span className="scr-bar"><i style={{ width: `${s.pct}%` }} /></span>
              <b>{s.correct}/{s.total}</b>
            </li>
          ))}
        </ul>
        {result.blockedByLesson && <p className="muted small">{t.scrLessonGate}</p>}
      </div>

      {result.allow
        ? (
          <>
            {result.band.force_duration === '1y' && (
              <div className="card scr-note"><p>{t.scrForce1y}</p></div>
            )}
            <button className="primary" onClick={onContinue}>{t.scrContinue}</button>
          </>
        )
        : (
          <div className="card scr-note">
            <h3>{t.scrNextTitle}</h3>
            <p className="muted">{t.scrNextDesc}</p>
            <ul className="scr-links">
              <li>
                <a href="https://learningenglish.voanews.com/" target="_blank" rel="noreferrer">VOA Learning English</a>
                <span className="muted small">{t.scrVoa}</span>
              </li>
              <li>
                <a href="https://www.bbc.co.uk/learningenglish" target="_blank" rel="noreferrer">BBC Learning English</a>
                <span className="muted small">{t.scrBbc}</span>
              </li>
              <li>
                <a href="https://www.efset.org/" target="_blank" rel="noreferrer">EF SET</a>
                <span className="muted small">{t.scrEfset}</span>
              </li>
            </ul>
            <p className="muted small">{t.scrRetry}</p>
          </div>
        )}
    </div>
  )
}

export default function Screening() {
  const { profile } = useAppState()
  const { t } = useT()
  const nav = useNavigate()
  const items = useMemo(allItems, [])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Result | null>(null)

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />

  const item: Item = items[idx]
  const section = TEST.sections.find((s) => s.items.some((i) => i.id === item.id))!
  const passage = item.passage_id ? TEST.passages[item.passage_id] : null

  function choose(choiceId: string) {
    const next = { ...answers, [item.id]: choiceId }
    setAnswers(next)
    if (idx + 1 < items.length) { setIdx(idx + 1); return }
    const r = score(next)
    setResult(r)
    store.setProfile({
      ...profile!, cefrBand: r.band.id, cefrPct: r.pct,
      // 진입이 막힌 학생에게 과정을 배정하면 안 된다 (강의 관문에 걸린 경우 포함)
      duration: r.allow ? (r.band.force_duration ?? profile!.duration) : null,
    })
  }

  if (result) {
    return <Report result={result} onContinue={() => nav('/setup')} />
  }

  return (
    <div className="page narrow">
      <p className="step-label">{t.scrStep}</p>
      <h1>{t.scrTitle}</h1>
      <p className="muted">{t.scrIntro}</p>

      <div className="progressbar thin">
        <div style={{ width: `${(idx / items.length) * 100}%` }} />
      </div>
      <div className="muted small scr-count">
        {t.scrCount(idx + 1, items.length)} · {
          section.id === 'reading' ? t.scrReading
            : section.id === 'lesson' ? t.scrLesson : t.scrVocab
        }
      </div>

      {passage && (
        <div className="card scr-passage">
          <h3>{passage.title}</h3>
          {passage.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
        </div>
      )}
      {item.video_id && <LessonVideo videoId={item.video_id} />}

      <div className="card">
        <p className="scr-stem">
          {section.id === 'vocabulary' ? <b>{item.stem}</b> : item.stem}
        </p>
        <div className="choices">
          {item.choices.map((c) => (
            <button key={c.id} className="choice" onClick={() => choose(c.id)}>
              {c.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
