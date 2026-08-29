import { Link } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import { useRoadmap, blockTitle, needsQuiz } from '../lib/roadmap'
import { useT, type Dict } from '../lib/i18n'
import { computeStats } from '../lib/stats'
import PlanRail from './PlanRail'
import type { Block } from '../lib/types'

function BlockRow({ t, b, dayIndex, blockIndex, active, done, totalBlocks }: {
  t: Dict; b: Block; dayIndex: number; blockIndex: number; active: boolean; done: boolean; totalBlocks: number
}) {
  const { videoProgress } = useAppState()
  const icon = done ? '✅' : active ? '▶️' : '🔒'
  const cls = `block ${done ? 'done' : active ? 'active' : 'locked'}`

  const videos = b.videos ?? []
  const allVideosDone = videos.every((v) => v.youtube_id && videoProgress[v.youtube_id]?.completed)

  return (
    <div className={cls}>
      <div className="block-head">
        <span className="block-icon">{icon}</span>
        <span className="block-title">{blockTitle(t, b)}</span>
        {b.minutes ? <span className="badge">{t.minutes(b.minutes)}</span> : null}
      </div>

      {b.type === 'study' && videos.length > 0 && (
        <ul className="video-list">
          {videos.map((v, vi) => {
            const vp = v.youtube_id ? videoProgress[v.youtube_id] : undefined
            return (
              <li key={v.slug + vi}>
                {active || done ? (
                  <Link to={`/lesson/${dayIndex}/${blockIndex}/${vi}`}>
                    {vp?.completed ? '✓ ' : '▸ '}{v.title}
                  </Link>
                ) : (
                  <span className="muted">▸ {v.title}</span>
                )}
                <span className="muted small"> {t.minutes(Math.round(v.duration_sec / 60))}</span>
              </li>
            )
          })}
        </ul>
      )}

      {active && !done && (
        b.type === 'checkin' ? (
          <div className="checkin-row">
            {[t.checkinHard, t.checkinOk, t.checkinEasy].map((label, i) => (
              <button key={i} className="ghost" onClick={() => store.completeBlock(dayIndex, blockIndex, totalBlocks)}>
                {label}
              </button>
            ))}
          </div>
        ) : needsQuiz(b) ? (
          <div className="block-actions">
            {b.type === 'study' && !allVideosDone && (
              <span className="muted small">{t.videosFirst}</span>
            )}
            <Link
              className={`btn primary ${b.type === 'study' && !allVideosDone ? 'disabled' : ''}`}
              to={`/quiz/${dayIndex}/${blockIndex}`}
              onClick={(e) => { if (b.type === 'study' && !allVideosDone) e.preventDefault() }}
            >
              {b.type === 'study' ? t.solveMin(b.practice_minutes ?? 10) : t.solve}
            </Link>
          </div>
        ) : (
          <button className="primary" onClick={() => store.completeBlock(dayIndex, blockIndex, totalBlocks)}>{t.complete}</button>
        )
      )}
    </div>
  )
}

export default function Today() {
  const state = useAppState()
  const { t } = useT()
  const p = state.profile!
  const { roadmap, error } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)

  if (error) return <div className="page">{error}</div>
  if (!roadmap) return <div className="page muted">{t.roadmapLoading}</div>

  const dayIndex = Math.min(state.currentDayIndex, roadmap.days.length - 1)
  const day = roadmap.days[dayIndex]
  const ds = state.dayStates[dayIndex] ?? { doneBlocks: [], finished: false }
  const activeIndex = day.blocks.findIndex((_, i) => !ds.doneBlocks.includes(i))
  const doneCount = ds.doneBlocks.length
  const allDone = state.currentDayIndex >= roadmap.days.length

  const stats = computeStats(state, roadmap.days.length)
  const nextBlock = activeIndex >= 0 && !ds.finished ? day.blocks[activeIndex] : null
  const remaining = day.blocks.length - doneCount

  return (
    <div className="today-layout">
      <aside className="rail rail-left">
        <PlanRail
          days={roadmap.days} week={day.week}
          currentDayIndex={dayIndex} startedAt={p.startedAt}
        />
      </aside>

      <section className="page today-main">
        <div className="today-head">
          <h1>{t.todayTitle(day.week, day.day)}</h1>
          <div className="muted">{t.doneOf(doneCount, day.blocks.length)}</div>
        </div>
        <div className="progressbar"><div style={{ width: `${(doneCount / day.blocks.length) * 100}%` }} /></div>

        {allDone && <div className="card celebrate">{t.allDone}</div>}
        {ds.finished && !allDone && (
          <div className="card celebrate">{t.dayDone}</div>
        )}

        {day.blocks.map((b, i) => (
          <BlockRow
            key={i} t={t} b={b} dayIndex={dayIndex} blockIndex={i}
            active={i === activeIndex && !ds.finished}
            done={ds.doneBlocks.includes(i)}
            totalBlocks={day.blocks.length}
          />
        ))}

        <p className="muted small attribution">{t.attribution}</p>
      </section>

      <aside className="rail rail-right">
        <div className="card rail-card">
          <h3 className="rail-h">{t.railToday}</h3>
          <div className="rail-stats">
            <div><b>{remaining}</b><span>{t.railRemaining}</span></div>
            <div><b>{stats.streak}</b><span>{t.streakLabel}</span></div>
            <div><b>{stats.videosDone}</b><span>{t.videosLabel}</span></div>
            <div><b>{stats.correctPct !== null ? `${stats.correctPct}%` : '—'}</b><span>{t.accuracyLabel}</span></div>
          </div>
        </div>

        <div className="card rail-card">
          <h3 className="rail-h">{t.railNextUp}</h3>
          {nextBlock
            ? (
              <div className="rail-next">
                <div className="rail-next-title">{blockTitle(t, nextBlock)}</div>
                {nextBlock.minutes ? <span className="badge">{t.minutes(nextBlock.minutes)}</span> : null}
              </div>
            )
            : <p className="muted small">{t.railNothingNext}</p>}
        </div>

        <div className="card rail-card">
          <h3 className="rail-h">{t.weakTitle}</h3>
          {stats.weak.length === 0
            ? <p className="muted small">{t.weakEmpty}</p>
            : (
              <ul className="rail-weak">
                {stats.weak.map(([tag, sk]) => (
                  <li key={tag}>
                    <span className="rail-weak-tag">{tag}</span>
                    <span className="rail-weak-pct">{Math.round((sk.wrong / sk.total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            )}
          <Link className="rail-link" to="/progress">{t.railJumpProgress} →</Link>
        </div>
      </aside>
    </div>
  )
}
