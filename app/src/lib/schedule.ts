// 학습 달력 — 로드맵의 "N일차"를 실제 날짜로 변환하고, 앞으로 배울 내용을 요약한다.
import type { SyllabusDay } from './types'

/** 주당 학습일 수만큼만 달력에 배치한다 (5일=월~금, 6일=월~토, 7일=매일). */
export function isStudyDay(d: Date, perWeek: number): boolean {
  const w = d.getDay() // 0=일 … 6=토
  if (perWeek >= 7) return true
  if (perWeek === 6) return w !== 0
  return w >= 1 && w <= 5
}

/** 템플릿에서 주당 학습일 수를 역산 (한 주 안의 최대 day 번호). */
export function daysPerWeek(days: SyllabusDay[]): number {
  return days.reduce((m, d) => Math.max(m, d.day), 0) || 5
}

const MS_DAY = 86_400_000

function parseISO(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 시작일부터 세어 index번째(0-base) 학습일의 달력 날짜. */
export function dateForDayIndex(startISO: string, index: number, perWeek: number): Date {
  const d = parseISO(startISO)
  let count = 0
  // 안전장치: 최대 10년
  for (let guard = 0; guard < 3700; guard++) {
    if (isStudyDay(d, perWeek)) {
      if (count === index) return d
      count++
    }
    d.setDate(d.getDate() + 1)
  }
  return d
}

/** 오늘이 몇 번째 학습일에 해당하는지 (일정보다 앞서거나 뒤처져도 달력 기준으로 계산). */
export function elapsedStudyDays(startISO: string, today = new Date()): number {
  const start = parseISO(startISO)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / MS_DAY)
}

export interface CalendarCell {
  dayIndex: number
  day: number
  date: Date
  isToday: boolean
  done: boolean
  current: boolean
}

/** 특정 주(week)의 학습일을 달력 셀로. */
export function weekCells(
  days: SyllabusDay[], week: number, startISO: string, perWeek: number,
  currentDayIndex: number, finished: (i: number) => boolean,
): CalendarCell[] {
  const todayISO = toISO(new Date())
  return days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.week === week)
    .map(({ d, i }) => {
      const date = dateForDayIndex(startISO, i, perWeek)
      return {
        dayIndex: i, day: d.day, date,
        isToday: toISO(date) === todayISO,
        done: finished(i),
        current: i === currentDayIndex,
      }
    })
}

// ───────────────────────── 앞으로 배울 내용 미리보기

export interface PreviewUnit {
  unit: string
  course: string
  videos: string[]
}
export interface PreviewTrack {
  track: string
  label: string
  units: PreviewUnit[]
  videoCount: number
  minutes: number
}

/** weekFrom~weekTo 구간에서 배우는 내용을 트랙 → 유닛 → 영상으로 묶는다. */
export function previewRange(days: SyllabusDay[], weekFrom: number, weekTo: number): PreviewTrack[] {
  const byTrack = new Map<string, PreviewTrack>()

  for (const d of days) {
    if (d.week < weekFrom || d.week > weekTo) continue
    for (const b of d.blocks) {
      if (b.type !== 'study' || !b.videos?.length) continue
      const key = b.track ?? 'study'
      let tr = byTrack.get(key)
      if (!tr) {
        tr = { track: key, label: b.label ?? key, units: [], videoCount: 0, minutes: 0 }
        byTrack.set(key, tr)
      }
      tr.minutes += b.minutes ?? 0
      for (const v of b.videos) {
        let u = tr.units.find((x) => x.unit === v.unit)
        if (!u) { u = { unit: v.unit, course: v.course_title ?? v.course, videos: [] }; tr.units.push(u) }
        if (!u.videos.includes(v.title)) { u.videos.push(v.title); tr.videoCount++ }
      }
    }
  }
  return [...byTrack.values()]
}
