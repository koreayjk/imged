import { useState } from 'react'
import { useAppState } from '../lib/useStore'
import { useT, type Dict } from '../lib/i18n'
import {
  daysPerWeek, dateForDayIndex, weekCells, previewRange, toISO,
} from '../lib/schedule'
import type { SyllabusDay } from '../lib/types'

/** 학습 달력 — 시작일 기준으로 이번 주 날짜와 수료 예정일을 보여준다. */
function CalendarCard({ t, days, week, startISO, perWeek, currentDayIndex }: {
  t: Dict; days: SyllabusDay[]; week: number; startISO: string
  perWeek: number; currentDayIndex: number
}) {
  const { dayStates } = useAppState()
  const cells = weekCells(days, week, startISO, perWeek, currentDayIndex,
    (i) => !!dayStates[i]?.finished)
  const endDate = dateForDayIndex(startISO, days.length - 1, perWeek)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const fmtFull = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`
  const doneWeek = cells.filter((c) => c.done).length

  return (
    <div className="card rail-card">
      <h3 className="rail-h">{t.calTitle}</h3>
      <div className="cal-week">{t.weekTitle(week)}</div>

      <div className="cal-grid">
        {cells.map((c) => {
          const state = c.done ? 'done' : c.current ? 'current' : 'locked'
          return (
            <div key={c.dayIndex} className={`cal-cell ${state} ${c.isToday ? 'today' : ''}`}>
              <span className="cal-dow">{t.calWeekdays[(c.date.getDay() + 6) % 7]}</span>
              <span className="cal-date">{fmt(c.date)}</span>
              <span className="cal-mark">{c.done ? '✓' : c.current ? '▶' : '🔒'}</span>
            </div>
          )
        })}
      </div>

      <div className="progressbar thin">
        <div style={{ width: `${cells.length ? (doneWeek / cells.length) * 100 : 0}%` }} />
      </div>

      <dl className="cal-meta">
        <div><dt>{t.calStart}</dt><dd>{fmtFull(dateForDayIndex(startISO, 0, perWeek))}</dd></div>
        <div><dt>{t.calEnd}</dt><dd>{fmtFull(endDate)}</dd></div>
        <div><dt>{t.calDayOf}</dt><dd>{t.dayOfTotal(currentDayIndex + 1, days.length)}</dd></div>
      </dl>
    </div>
  )
}

/** 앞으로 배울 내용 — 제목·단원은 보이되 잠금 상태라 클릭해도 강의로 가지 않는다. */
function PreviewCard({ t, days, week, totalWeeks }: {
  t: Dict; days: SyllabusDay[]; week: number; totalWeeks: number
}) {
  const [tab, setTab] = useState<'this' | 'next' | 'month'>('this')
  const [openUnit, setOpenUnit] = useState<string | null>(null)

  const ranges = {
    this: [week, week] as const,
    next: [week + 1, week + 1] as const,
    month: [week + 2, Math.min(week + 5, totalWeeks)] as const,
  }
  const [from, to] = ranges[tab]
  const tracks = previewRange(days, from, to)

  return (
    <div className="card rail-card">
      <h3 className="rail-h">{t.planTitle}</h3>

      <div className="plan-tabs" role="tablist">
        {([['this', t.planThisWeek], ['next', t.planNextWeek], ['month', t.planNextMonth]] as const)
          .map(([k, label]) => (
            <button
              key={k} role="tab" aria-selected={tab === k}
              className={tab === k ? 'active' : ''}
              onClick={() => { setTab(k); setOpenUnit(null) }}
            >{label}</button>
          ))}
      </div>
      <div className="plan-range muted small">
        {from === to ? t.weekTitle(from) : t.planWeeksRange(from, to)}
      </div>

      {tracks.length === 0
        ? <p className="muted small">{t.planEmpty}</p>
        : (
          <div className="plan-tracks">
            {tracks.map((tr) => (
              <section key={tr.track} className="plan-track">
                <header className="plan-track-head">
                  <span className="plan-track-name">{tr.label}</span>
                  <span className="muted small">{t.planVideos(tr.videoCount)}</span>
                </header>
                <ul className="plan-units">
                  {tr.units.slice(0, 6).map((u) => {
                    const id = `${tr.track}:${u.unit}`
                    const open = openUnit === id
                    return (
                      <li key={id} className={open ? 'open' : ''}>
                        <button
                          className="plan-unit" aria-expanded={open}
                          onClick={() => setOpenUnit(open ? null : id)}
                        >
                          <span className="plan-lock" aria-hidden="true">🔒</span>
                          <span className="plan-unit-name">{u.unit}</span>
                          <span className="plan-unit-n">{u.videos.length}</span>
                        </button>
                        {open && (
                          <ul className="plan-videos">
                            {/* 잠금 상태 — 제목만 보이고 링크가 아니다 */}
                            {u.videos.map((v) => <li key={v} className="muted">{v}</li>)}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                  {tr.units.length > 6 && (
                    <li className="muted small plan-more">{t.planMore(tr.units.length - 6)}</li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      <p className="muted small plan-note">{t.planLockNote}</p>
    </div>
  )
}

export default function PlanRail({ days, week, currentDayIndex, startedAt }: {
  days: SyllabusDay[]; week: number; currentDayIndex: number; startedAt: string | null
}) {
  const { t } = useT()
  const perWeek = daysPerWeek(days)
  const startISO = startedAt ?? toISO(new Date())
  const totalWeeks = days.reduce((m, d) => Math.max(m, d.week), 0)

  return (
    <>
      <CalendarCard
        t={t} days={days} week={week} startISO={startISO}
        perWeek={perWeek} currentDayIndex={currentDayIndex}
      />
      <PreviewCard t={t} days={days} week={week} totalWeeks={totalWeeks} />
    </>
  )
}
