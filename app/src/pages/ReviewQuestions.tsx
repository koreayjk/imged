import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { useT, subjectLabel } from '../lib/i18n'
import { supabase, supabaseEnabled } from '../lib/supabase'

interface PendingQuestion {
  id: string
  subject: string
  skill_tag: string
  ged_target: string | null
  dok: number | null
  difficulty: number
  stem_i18n: Record<string, string>
  choices: { id: string; text_i18n: Record<string, string> }[]
  answer: { choice: string }
  explanation_i18n: Record<string, string>
  distractor_rationale: string | null
}

export default function ReviewQuestions() {
  const { profile } = useAppState()
  const { t } = useT()
  const [items, setItems] = useState<PendingQuestion[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadWarn, setLoadWarn] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(0)
  const [genSubject, setGenSubject] = useState<'math' | 'rla' | 'science' | 'social'>('math')
  const [genCount, setGenCount] = useState(24)
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState<string | null>(null)

  async function loadPending() {
    try {
      // 네트워크가 응답하지 않아도 화면이 열리도록 타임아웃을 건다
      const query = supabase!.from('questions')
        .select('id,subject,skill_tag,ged_target,dok,difficulty,stem_i18n,choices,answer,explanation_i18n,distractor_rationale')
        .eq('status', 'draft')
        .order('created_at', { ascending: true })
        .limit(300)
        .abortSignal(AbortSignal.timeout(15000))
      const { data, error: e } = await query
      setLoadWarn(e ? e.message : null)
      setItems((data ?? []) as PendingQuestion[])
    } catch (err) {
      // 네트워크 실패 등 — 화면은 열고 경고만 표시
      setLoadWarn(String((err as Error)?.message ?? err))
      setItems([])
    }
    setIdx(0)
  }

  useEffect(() => {
    if (!supabaseEnabled) return
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    setGenerating(true)
    setGenMsg(null)
    try {
      const { data, error: e } = await supabase!.functions.invoke('generate-questions', {
        body: { subject: genSubject, count: genCount },
      })
      if (e) throw e
      if (data?.error) throw new Error(data.error)
      setGenMsg(t.genDone(data.generated, data.rejected))
      await loadPending()
    } catch (err) {
      console.error(err)
      setGenMsg(`${t.genFailed} ${String(err).slice(0, 120)}`)
    } finally {
      setGenerating(false)
    }
  }

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/today" replace />
  if (!supabaseEnabled) return <div className="page"><h1>{t.reviewTitle}</h1><p className="muted">{t.essayNeedsSupabase}</p></div>
  if (error) return <div className="page"><h1>{t.reviewTitle}</h1><p>{t.loadFailed}: {error}</p></div>
  if (!items) return <div className="page muted">{t.loading}</div>

  const q = items[idx]

  async function decide(decision: 'published' | 'rejected') {
    if (!q || busy) return
    setBusy(true)
    const { error: e } = await supabase!.rpc('review_question', {
      q_id: q.id, decision, note: note.trim() || null,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    setReviewed((n) => n + 1)
    setNote('')
    setIdx((i) => i + 1)
  }

  if (!q) {
    return (
      <div className="page narrow">
        <h1>{t.reviewTitle}</h1>
        <div className="card center">
          <div className="score">{reviewed > 0 ? t.reviewDone : t.reviewEmpty}</div>
          {reviewed > 0 && <p className="muted">{reviewed}</p>}
          {loadWarn && <p className="muted small">{t.loadFailed}: {loadWarn}</p>}
        </div>
      <div className="card gen-panel">
        <h3>{t.genTitle}</h3>
        <p className="muted small">{t.genNote}</p>
        <div className="gen-row">
          <select value={genSubject} onChange={(e) => setGenSubject(e.target.value as typeof genSubject)}>
            <option value="math">{t.math}</option>
            <option value="rla">{t.rla}</option>
            <option value="science">{t.science}</option>
            <option value="social">{t.social}</option>
          </select>
          <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))}>
            {[12, 24, 36, 48, 60].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="primary" disabled={generating} onClick={generate}>
            {generating ? t.genRunning : t.genRun}
          </button>
          <button className="ghost" disabled={generating} onClick={() => loadPending()}>{t.genRefresh}</button>
        </div>
        {genMsg && <p className="muted small">{genMsg}</p>}
      </div>

      </div>
    )
  }

  return (
    <div className="page narrow">
      <div className="quiz-head">
        <h1>{t.reviewTitle}</h1>
        <span className="muted">{t.reviewOf(idx + 1, items.length)}</span>
      </div>
      <p className="muted small">{t.reviewIntro}</p>
      <div className="progressbar"><div style={{ width: `${(idx / items.length) * 100}%` }} /></div>

      <div className="card gen-panel">
        <h3>{t.genTitle}</h3>
        <p className="muted small">{t.genNote}</p>
        <div className="gen-row">
          <select value={genSubject} onChange={(e) => setGenSubject(e.target.value as typeof genSubject)}>
            <option value="math">{t.math}</option>
            <option value="rla">{t.rla}</option>
            <option value="science">{t.science}</option>
            <option value="social">{t.social}</option>
          </select>
          <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))}>
            {[12, 24, 36, 48, 60].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="primary" disabled={generating} onClick={generate}>
            {generating ? t.genRunning : t.genRun}
          </button>
          <button className="ghost" disabled={generating} onClick={() => loadPending()}>{t.genRefresh}</button>
        </div>
        {genMsg && <p className="muted small">{genMsg}</p>}
      </div>

      <div className="card">
        <div className="review-meta">
          <span className="badge">{subjectLabel(t, q.subject)}</span>
          <span className="badge">{q.skill_tag}</span>
          {q.ged_target && <span className="badge">{t.reviewTarget} {q.ged_target}</span>}
          {q.dok && <span className="badge">{t.reviewDok} {q.dok}</span>}
          <span className="badge">★{q.difficulty}</span>
        </div>
        <p className="stem">{q.stem_i18n.en}</p>
        <p className="muted small">{q.stem_i18n.ko}</p>
        <div className="choices">
          {q.choices.map((c) => (
            <div key={c.id} className={`choice ${c.id === q.answer.choice ? 'correct' : ''}`}>
              <b>{c.id.toUpperCase()}.</b> {c.text_i18n.en}
              {c.id === q.answer.choice && <span className="badge on"> {t.reviewAnswer}</span>}
            </div>
          ))}
        </div>
        <div className="explain ok">
          <div className="explain-head">{t.reviewExplain}</div>
          <p className="small">{q.explanation_i18n.en}</p>
          <p className="small muted">{q.explanation_i18n.ko}</p>
          {q.distractor_rationale && <p className="small muted">↳ {q.distractor_rationale}</p>}
        </div>
      </div>

      <div className="card">
        <label>
          {t.reviewMemo}
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="review-actions">
          <button className="primary" disabled={busy} onClick={() => decide('published')}>{t.reviewApprove}</button>
          <button className="ghost" disabled={busy} onClick={() => decide('rejected')}>{t.reviewReject}</button>
          <button className="ghost" disabled={busy} onClick={() => { setNote(''); setIdx((i) => i + 1) }}>{t.reviewSkip}</button>
        </div>
      </div>
    </div>
  )
}
