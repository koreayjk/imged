// 영어 선별 테스트 — 이 프로그램을 따라갈 수 있는지 가늠한다.
// 일반 CEFR 시험이 아니라 우리 콘텐츠(GED형 지문 + 실제 칸 아카데미 강의)로 직접 검증한다.
import raw from '../data/screening_test.json'
import type { Duration, Level } from './types'

export interface Choice { id: string; text: string }
export interface Item {
  id: string
  stem: string
  choices: Choice[]
  answer: string
  passage_id?: string
  video_id?: string
}
export interface Section {
  id: 'reading' | 'lesson' | 'vocabulary'
  weight: number
  gate_min_pct?: number
  items: Item[]
}
export interface Band {
  id: string
  max_pct: number
  cefr: string
  allow: boolean
  force_duration?: Duration
  level_hint?: Level
}
export interface Passage { title: string; text: string }

export const TEST = raw as unknown as {
  version: number
  time_limit_min: number
  sections: Section[]
  passages: Record<string, Passage>
  bands: Band[]
}

export const allItems = (): Item[] => TEST.sections.flatMap((s) => s.items)

export interface SectionScore { id: string; correct: number; total: number; pct: number }
export interface Result {
  pct: number
  band: Band
  sections: SectionScore[]
  /** 강의 이해 구간을 통과하지 못해 총점과 무관하게 막힌 경우 */
  blockedByLesson: boolean
  allow: boolean
}

export function score(answers: Record<string, string>): Result {
  let got = 0
  let max = 0
  const sections: SectionScore[] = []
  let blockedByLesson = false

  for (const s of TEST.sections) {
    const correct = s.items.filter((i) => answers[i.id] === i.answer).length
    const pct = s.items.length ? Math.round((correct / s.items.length) * 100) : 0
    sections.push({ id: s.id, correct, total: s.items.length, pct })
    got += correct * s.weight
    max += s.items.length * s.weight
    // 강의를 못 따라가면 영상 기반 프로그램 자체가 성립하지 않는다 — 총점과 별개의 관문
    if (s.gate_min_pct != null && pct < s.gate_min_pct) blockedByLesson = true
  }

  const pct = max ? Math.round((got / max) * 100) : 0
  const band = TEST.bands.find((b) => pct <= b.max_pct) ?? TEST.bands[TEST.bands.length - 1]
  return { pct, band, sections, blockedByLesson, allow: band.allow && !blockedByLesson }
}
