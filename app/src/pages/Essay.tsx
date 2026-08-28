import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../lib/useStore'
import { useT } from '../lib/i18n'
import { supabase, supabaseEnabled } from '../lib/supabase'
import promptsData from '../data/essay_prompts.json'

interface EssayPrompt {
  slug: string
  title_i18n: Record<string, string>
  passage: string
  prompt_i18n: Record<string, string>
  time_limit_min: number
}

interface TraitResult { score: number; comment_en: string; comment_native: string }
interface Grade {
  trait1_arguments: TraitResult
  trait2_development: TraitResult
  trait3_conventions: TraitResult
  total_score: number
  overall_en: string
  overall_native: string
  strengths_native: string[]
  improvements_native: string[]
  grammar_notes: { quote: string; issue_native: string; suggestion: string }[]
  next_steps_native: string
}

function txt(i18n: Record<string, string>, lang: string) {
  return i18n[lang] ?? i18n.en ?? Object.values(i18n)[0] ?? ''
}

function TraitBar({ label, trait }: { label: string; trait: TraitResult }) {
  return (
    <div className="trait">
      <div className="trait-head">
        <span>{label}</span>
        <b>{trait.score} / 2</b>
      </div>
      <div className="progressbar"><div style={{ width: `${(trait.score / 2) * 100}%` }} /></div>
      <p className="muted small">{trait.comment_native}</p>
    </div>
  )
}

export default function Essay() {
  const { profile } = useAppState()
  const { t } = useT()
  const lang = profile?.nativeLang ?? 'ko'
  const prompts = (promptsData as { prompts: EssayPrompt[] }).prompts

  const [selected, setSelected] = useState<EssayPrompt | null>(null)
  const [body, setBody] = useState('')
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)

  const wordCount = useMemo(() => body.trim() ? body.trim().split(/\s+/).length : 0, [body])

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || grade) return
    const id = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft, grade])

  function start(p: EssayPrompt) {
    setSelected(p)
    setBody('')
    setGrade(null)
    setError(null)
    setSecondsLeft(p.time_limit_min * 60)
  }

  async function submit() {
    if (!selected || wordCount < 20) return
    setGrading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase!.functions.invoke('grade-essay', {
        body: {
          promptId: null, // 데모 데이터의 slug와 DB uuid 매핑은 Phase 2 (DB 프롬프트 로딩 시)
          promptTitle: txt(selected.title_i18n, 'en'),
          passage: selected.passage,
          promptText: txt(selected.prompt_i18n, 'en'),
          essay: body,
          nativeLang: lang,
        },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setGrade(data.grade as Grade)
    } catch (e) {
      console.error(e)
      setError(t.essayGradeFailed)
    } finally {
      setGrading(false)
    }
  }

  // ── 결과 화면
  if (grade && selected) {
    return (
      <div className="page narrow">
        <h1>{t.essayResultTitle} — {txt(selected.title_i18n, lang)}</h1>
        <div className="card center">
          <div className="score">{t.essayTotal(grade.total_score)}</div>
          <p className="muted">{grade.overall_native}</p>
        </div>
        <div className="card">
          <TraitBar label={t.trait1} trait={grade.trait1_arguments} />
          <TraitBar label={t.trait2} trait={grade.trait2_development} />
          <TraitBar label={t.trait3} trait={grade.trait3_conventions} />
        </div>
        <div className="card">
          <h3>💪 {t.essayStrengths}</h3>
          <ul>{grade.strengths_native.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <h3>🔧 {t.essayImprovements}</h3>
          <ul>{grade.improvements_native.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        {grade.grammar_notes.length > 0 && (
          <div className="card">
            <h3>✏️ {t.essayGrammarNotes}</h3>
            {grade.grammar_notes.map((g, i) => (
              <div key={i} className="grammar-note">
                <div className="quote">“{g.quote}”</div>
                <div className="muted small">{g.issue_native}</div>
                <div className="fix">→ {g.suggestion}</div>
              </div>
            ))}
          </div>
        )}
        <div className="card">
          <h3>🎯 {t.essayNextSteps}</h3>
          <p>{grade.next_steps_native}</p>
        </div>
        <button className="primary" onClick={() => { setSelected(null); setGrade(null) }}>{t.essayTryAgain}</button>
      </div>
    )
  }

  // ── 작성 화면
  if (selected) {
    const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0
    const secs = secondsLeft !== null ? secondsLeft % 60 : 0
    return (
      <div className="page">
        <div className="quiz-head">
          <h1>{txt(selected.title_i18n, lang)}</h1>
          <span className={`badge big ${secondsLeft !== null && secondsLeft < 300 ? 'urgent' : ''}`}>
            ⏱ {mins}:{String(secs).padStart(2, '0')}
          </span>
        </div>
        {secondsLeft === 0 && <p className="muted">{t.essayTimeUp}</p>}
        <div className="essay-layout">
          <div className="card essay-passage">
            <h3>{t.essayPassage}</h3>
            <p className="passage-text">{selected.passage}</p>
            <h3>{t.essayTask}</h3>
            <p>{txt(selected.prompt_i18n, lang)}</p>
          </div>
          <div className="card essay-editor">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t.essayPlaceholder}
              disabled={grading}
              spellCheck={false}
            />
            <div className="essay-footer">
              <span className="muted small">{t.essayWords(wordCount)}{wordCount < 20 && ` · ${t.essayMinWords}`}</span>
              {supabaseEnabled ? (
                <button className="primary" onClick={submit} disabled={grading || wordCount < 20}>
                  {grading ? t.essayGrading : t.essaySubmit}
                </button>
              ) : (
                <span className="muted small">{t.essayNeedsSupabase}</span>
              )}
            </div>
            {error && <p className="muted small error-text">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ── 주제 선택 화면
  return (
    <div className="page narrow">
      <h1>{t.essayTitle}</h1>
      <p className="muted">{t.essayIntro}</p>
      <h3>{t.essayPick}</h3>
      <div className="option-grid">
        {prompts.map((p) => (
          <button key={p.slug} className="card option" onClick={() => start(p)}>
            <div className="option-title">{txt(p.title_i18n, lang)}</div>
            <div className="muted small">{p.passage.slice(0, 110)}…</div>
            <div className="badge">⏱ {p.time_limit_min}min</div>
          </button>
        ))}
      </div>
    </div>
  )
}
