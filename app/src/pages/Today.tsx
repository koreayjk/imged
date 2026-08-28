import { Link } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import { useRoadmap, blockTitle, needsQuiz } from '../lib/roadmap'
import type { Block } from '../lib/types'

function BlockRow({ b, dayIndex, blockIndex, active, done, totalBlocks }: {
  b: Block; dayIndex: number; blockIndex: number; active: boolean; done: boolean; totalBlocks: number
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
        <span className="block-title">{blockTitle(b)}</span>
        {b.minutes ? <span className="badge">{b.minutes}분</span> : null}
      </div>
      {b.note && <div className="muted small">{b.note}</div>}

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
                <span className="muted small"> {Math.round(v.duration_sec / 60)}분</span>
              </li>
            )
          })}
        </ul>
      )}

      {active && !done && (
        b.type === 'checkin' ? (
          <div className="checkin-row">
            {['😵 어려웠어요', '🙂 보통이에요', '😄 쉬웠어요'].map((label, i) => (
              <button key={i} className="ghost" onClick={() => store.completeBlock(dayIndex, blockIndex, totalBlocks)}>
                {label}
              </button>
            ))}
          </div>
        ) : needsQuiz(b) ? (
          <div className="block-actions">
            {b.type === 'study' && !allVideosDone && (
              <span className="muted small">영상을 모두 시청하면 문항을 풀 수 있어요</span>
            )}
            <Link
              className={`btn primary ${b.type === 'study' && !allVideosDone ? 'disabled' : ''}`}
              to={`/quiz/${dayIndex}/${blockIndex}`}
              onClick={(e) => { if (b.type === 'study' && !allVideosDone) e.preventDefault() }}
            >
              {b.type === 'study' ? `문항 풀기 (${b.practice_minutes ?? 10}분)` : '문항 풀기'}
            </Link>
          </div>
        ) : (
          <button className="primary" onClick={() => store.completeBlock(dayIndex, blockIndex, totalBlocks)}>완료</button>
        )
      )}
    </div>
  )
}

export default function Today() {
  const state = useAppState()
  const p = state.profile!
  const { roadmap, error } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)

  if (error) return <div className="page">오류: {error}</div>
  if (!roadmap) return <div className="page muted">로드맵 불러오는 중…</div>

  const dayIndex = Math.min(state.currentDayIndex, roadmap.days.length - 1)
  const day = roadmap.days[dayIndex]
  const ds = state.dayStates[dayIndex] ?? { doneBlocks: [], finished: false }
  const activeIndex = day.blocks.findIndex((_, i) => !ds.doneBlocks.includes(i))
  const doneCount = ds.doneBlocks.length
  const allDone = state.currentDayIndex >= roadmap.days.length

  // 사이드바: 이번 주 현황
  const weekDays = roadmap.days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.week === day.week)

  return (
    <div className="today-layout">
      <aside className="sidebar card">
        <h3>{day.week}주차</h3>
        <ul className="week-list">
          {weekDays.map(({ d, i }) => (
            <li key={i} className={i === dayIndex ? 'current' : ''}>
              {state.dayStates[i]?.finished ? '✅' : i === dayIndex ? '▶️' : '·'} Day {d.day}
            </li>
          ))}
        </ul>
        <div className="muted small">전체 {roadmap.days.length}일 중 {dayIndex + 1}일차</div>
      </aside>

      <section className="page">
        <div className="today-head">
          <h1>오늘의 과제 — {day.week}주차 Day {day.day}</h1>
          <div className="muted">{doneCount} / {day.blocks.length} 완료</div>
        </div>
        <div className="progressbar"><div style={{ width: `${(doneCount / day.blocks.length) * 100}%` }} /></div>

        {allDone && <div className="card celebrate">🎓 모든 일정을 완료했습니다!</div>}
        {ds.finished && !allDone && (
          <div className="card celebrate">🎉 오늘 학습 완료! 내일 다시 만나요.</div>
        )}

        {day.blocks.map((b, i) => (
          <BlockRow
            key={i} b={b} dayIndex={dayIndex} blockIndex={i}
            active={i === activeIndex && !ds.finished}
            done={ds.doneBlocks.includes(i)}
            totalBlocks={day.blocks.length}
          />
        ))}

        <p className="muted small attribution">영상 출처: Khan Academy (CC BY-NC-SA) — youtube.com 임베드</p>
      </section>
    </div>
  )
}
