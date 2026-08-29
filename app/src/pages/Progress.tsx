import { useAppState } from '../lib/useStore'
import { useRoadmap } from '../lib/roadmap'
import { useT, durationLabel } from '../lib/i18n'
import { computeStats } from '../lib/stats'

export default function ProgressPage() {
  const state = useAppState()
  const { t } = useT()
  const p = state.profile!
  const { roadmap } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)
  if (!roadmap) return <div className="page muted">{t.loading}</div>

  const {
    totalDays, doneDays, donePct, streak, videosDone, watchedMin, correctPct, weak,
  } = computeStats(state, roadmap.days.length)

  const durLabel = p.duration ? durationLabel(t, p.duration) : roadmap.label

  return (
    <div className="page wide">
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
        <div className="progressbar big"><div style={{ width: `${donePct}%` }} /></div>
        <div className="muted small">{t.courseOf(durLabel, donePct)}</div>
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
