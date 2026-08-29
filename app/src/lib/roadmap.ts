// 학생별 로드맵 구성: 과목별 레벨에 따라 두 템플릿을 합성한다.
//   수학·선행(t0) 트랙 → 수학 레벨 템플릿, 나머지(영어·과학·사회·통합) → 영어 레벨 템플릿
import { useEffect, useState } from 'react'
import { loadTemplate } from './store'
import { trackLabel, type Dict } from './i18n'
import type { Block, CurriculumStyle, Duration, Level, SyllabusDay } from './types'

export interface Roadmap {
  days: SyllabusDay[]
  label: string
}

const MATH_TRACKS = new Set(['math', 't0'])

export function composeDays(mathDays: SyllabusDay[], engDays: SyllabusDay[]): SyllabusDay[] {
  const n = Math.min(mathDays.length, engDays.length)
  const out: SyllabusDay[] = []
  for (let i = 0; i < n; i++) {
    const m = mathDays[i]
    const e = engDays[i]
    const blocks: Block[] = []
    // 영어 템플릿의 블록 순서를 기준으로, 수학 계열 트랙만 수학 템플릿 것으로 교체
    for (const b of e.blocks) {
      if (b.type === 'study' && b.track && MATH_TRACKS.has(b.track)) continue
      blocks.push(b)
    }
    const mathBlocks = m.blocks.filter((b) => b.type === 'study' && b.track && MATH_TRACKS.has(b.track))
    // 워밍업 다음 위치에 수학 계열 블록 삽입 (원래 순서 유지)
    const insertAt = blocks.findIndex((b) => b.type !== 'warmup')
    blocks.splice(insertAt < 0 ? blocks.length : insertAt, 0, ...mathBlocks)
    out.push({ week: e.week, day: e.day, blocks })
  }
  return out
}

export function useRoadmap(
  duration: Duration | null, levelMath: Level | null, levelEnglish: Level | null,
  style: CurriculumStyle | null = 'focus',
) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!duration || !levelMath || !levelEnglish) return
    let alive = true
    const st = style ?? 'focus'
    Promise.all([loadTemplate(duration, levelMath, st), loadTemplate(duration, levelEnglish, st)])
      .then(([mt, et]) => {
        if (!alive) return
        setRoadmap({ label: et.label, days: composeDays(mt.days, et.days) })
      })
      .catch((e) => alive && setError(String(e)))
    return () => { alive = false }
  }, [duration, levelMath, levelEnglish, style])

  return { roadmap, error }
}

/** 블록 완료에 문항 풀이가 필요한 타입 */
export function needsQuiz(b: Block) {
  return b.type === 'study' || b.type === 'warmup' || b.type === 'weekly_test'
    || b.type === 'monthly_test' || b.type === 'integration' || b.type === 'mock'
}

export function blockTitle(t: Dict, b: Block): string {
  switch (b.type) {
    case 'warmup': return t.warmupTitle
    case 'study': return `${trackLabel(t, b.track)}${t.studySuffix}`
    case 'integration': return t.integrationTitle
    case 'mock': return t.mockTitle
    case 'weekly_test': return t.weeklyTest
    case 'monthly_test': return t.monthlyTest
    case 'checkin': return t.checkinTitle
  }
}
