import { useAppState } from '../lib/useStore'
import { useRoadmap } from '../lib/roadmap'
import { useT, durationLabel } from '../lib/i18n'

export default function ProgressPage() {
  const state = useAppState()
  const { t } = useT()
  const p = state.profile!
  const { roadmap } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)
  if (!roadmap) return <div className="page muted">{t.loading}</div>

  const totalDays = roadmap.days.length
  const doneDays = Object.values(state.dayStates).filter((d) => d.finished).length
  const videosDone = Object.values(state.videoProgress).filter((v) => v.completed).length
  const watchedMin = Math.round(Object.values(state.videoProgress).reduce((s, v) => s + v.watchedSeconds, 0) / 60)

  // 연속 학습일 (오늘 미학습이면 어제부터 카운트)
  let streak = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const on = state.attendance[d.toISOString().slice(0, 10)]
    if (on) streak++
    else if (i > 0) break
  }

  // 취약 스킬: 오답률 높은 skill_tag 상위 3
  const bySkill: Record<string, { total: number; wrong: number }> = {}
  for (const a of state.attempts) {
    const s = (bySkill[a.skillTag] ??= { total: 0, wrong: 0 })
    s.total++
    if (!a.correct) s.wrong++
  }
  const weak = Object.entries(bySkill)
    .filter(([, s]) => s.total >= 2 && s.wrong > 0)
    .sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total)
    .slice(0, 3)

  const attempts = state.attempts
  const correctPct = attempts.length
    ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null

  const durLabel = p.duration ? durationLabel(t, p.duration) : roadmap.label

  return (
    <div className="page">
      <h1>{t.progressTitle}</h1>
      <div className="stat-grid">
        <div className="card stat"><div className="score">{doneDays}<span className="unit">/{totalDays}{t.unitDays}</span></div><div className="muted">{t.doneDaysLabel}</div></div>
        <div className="card stat"><div className="score">{streak}<span className="unit">{t.unitDays}</span></div><div className="muted">{t.streakLabel}</div></div>
        <div className="card stat"><div className="score">{videosDone}<span className="unit">{t.unitCount}</span></div><div className="muted">{t.videosLabel}</div></div>
        <div className="card stat"><div className="score">{watchedMin}<span className="unit">{t.unitMin}</span></div><div className="muted">{t.watchedLabel}</div></div>
        <div className="card stat"><div className="score">{correctPct !== null ? `${correctPct}%` : '—'}</div><div className="muted">{t.accuracyLabel}</div></div>
      </div>

      <div className="card">
        <h3>{t.overallTitle}</h3>
        <div className="progressbar big"><div style={{ width: `${(doneDays / totalDays) * 100}%` }} /></div>
        <div className="muted small">{t.courseOf(durLabel, Math.round((doneDays / totalDays) * 100))}</div>
      </div>

      <div className="card">
        <h3>{t.weakTitle}</h3>
        {weak.length === 0
          ? <p className="muted">{t.weakEmpty}</p>
          : (
            <ul>
              {weak.map(([tag, s]) => (
                <li key={tag}>
                  <b>{tag}</b> — {t.weakRow(Math.round((s.wrong / s.total) * 100), s.wrong, s.total)}
                  <span className="muted small">{t.weakHint}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      <p className="muted small">{t.levelsNote}</p>
    </div>
  )
}
