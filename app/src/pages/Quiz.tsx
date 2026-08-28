import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store, practiceQuestions } from '../lib/store'
import { useRoadmap, blockTitle } from '../lib/roadmap'
import { useT } from '../lib/i18n'
import type { Question } from '../lib/types'

function txt(i18n: Record<string, string>, lang: string) {
  return i18n[lang] ?? i18n.en ?? Object.values(i18n)[0] ?? ''
}

export default function Quiz() {
  const { dayIndex = '0', blockIndex = '0' } = useParams()
  const nav = useNavigate()
  const state = useAppState()
  const { t } = useT()
  const p = state.profile!
  const { roadmap } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)

  const di = Number(dayIndex); const bi = Number(blockIndex)
  const block = roadmap?.days[di]?.blocks[bi]

  const questions: Question[] = useMemo(() => {
    if (!block) return []
    const n = block.type === 'warmup' ? 5 : block.type === 'study' ? 5 : 10
    const subject = block.type === 'study'
      ? (block.track === 'english' ? 'rla' : block.track === 't0' || block.track === 'math' ? 'math' : block.track!)
      : block.subject ?? 'math'
    return practiceQuestions(subject === 'science' || subject === 'social' ? 'rla' : subject, n)
    // 데모: 과학·사회 자체 문항이 아직 없어 영어(지문분석) 문항으로 대체. 문제은행 확장 시 제거.
  }, [block])

  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [results, setResults] = useState<boolean[]>([])
  const [showEnglish, setShowEnglish] = useState(false)
  const [startTime] = useState(Date.now())

  if (!roadmap) return <div className="page muted">{t.loading}</div>
  if (!block) return <div className="page">{t.blockNotFound} <Link to="/today">{t.toToday}</Link></div>
  if (questions.length === 0) return <div className="page">{t.noQuestions}</div>

  const lang = p.nativeLang
  const q = questions[idx]
  const finished = results.length === questions.length

  function pick(id: string) {
    if (chosen) return
    setChosen(id)
    const correct = id === q.answer.choice
    setResults([...results, correct])
    store.recordAttempt({
      skillTag: q.skill_tag, correct,
      seconds: Math.round((Date.now() - startTime) / 1000),
      at: new Date().toISOString(), source: `d${di}-b${bi}`,
    })
  }

  function next() {
    setChosen(null)
    if (idx + 1 < questions.length) setIdx(idx + 1)
  }

  function finish() {
    const total = roadmap!.days[di].blocks.length
    store.completeBlock(di, bi, total)
    nav('/today')
  }

  if (finished && chosen === null) {
    const correct = results.filter(Boolean).length
    return (
      <div className="page narrow">
        <h1>{t.quizDone(blockTitle(t, block))}</h1>
        <div className="card center">
          <div className="score">{correct} / {questions.length}</div>
          <p className="muted">{t.accuracy(Math.round((correct / questions.length) * 100))}
            {correct < questions.length && t.reviewNote}
          </p>
          <button className="primary" onClick={finish}>{t.completeBlock}</button>
        </div>
      </div>
    )
  }

  const isCorrect = chosen !== null && chosen === q.answer.choice

  return (
    <div className="page narrow">
      <div className="quiz-head">
        <span className="badge">{blockTitle(t, block)}</span>
        <span className="muted">{idx + 1} / {questions.length}</span>
      </div>
      <div className="progressbar"><div style={{ width: `${(results.length / questions.length) * 100}%` }} /></div>

      <div className="card">
        <p className="stem">{txt(q.stem_i18n, 'en')}</p>
        {lang !== 'en' && q.stem_i18n[lang] && <p className="muted small">{q.stem_i18n[lang]}</p>}
        <div className="choices">
          {q.choices.map((c) => {
            let cls = 'choice'
            if (chosen) {
              if (c.id === q.answer.choice) cls += ' correct'
              else if (c.id === chosen) cls += ' wrong'
            }
            return (
              <button key={c.id} className={cls} onClick={() => pick(c.id)} disabled={!!chosen}>
                <b>{c.id.toUpperCase()}.</b> {txt(c.text_i18n, 'en')}
              </button>
            )
          })}
        </div>

        {chosen && (
          <div className={`explain ${isCorrect ? 'ok' : 'no'}`}>
            <div className="explain-head">{isCorrect ? t.correct : t.wrong}</div>
            <p>{txt(q.explanation_i18n, showEnglish ? 'en' : lang)}</p>
            {lang !== 'en' && q.explanation_i18n.en && (
              <button className="ghost small" onClick={() => setShowEnglish(!showEnglish)}>
                {showEnglish ? t.nativeExplain : t.engExplain}
              </button>
            )}
            <div className="right">
              {idx + 1 < questions.length
                ? <button className="primary" onClick={next}>{t.nextQ}</button>
                : <button className="primary" onClick={() => setChosen(null)}>{t.seeResults}</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
