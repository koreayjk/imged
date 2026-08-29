// 학습 통계 — /today 우측 레일과 /progress가 같은 값을 쓰도록 한 곳에서 계산.
import type { AppState } from './store'

export interface StudyStats {
  doneDays: number
  totalDays: number
  donePct: number
  streak: number
  videosDone: number
  watchedMin: number
  correctPct: number | null
  attempts: number
  weak: [string, { total: number; wrong: number }][]
}

export function computeStats(state: AppState, totalDays: number): StudyStats {
  const doneDays = Object.values(state.dayStates).filter((d) => d.finished).length
  const videosDone = Object.values(state.videoProgress).filter((v) => v.completed).length
  const watchedMin = Math.round(
    Object.values(state.videoProgress).reduce((s, v) => s + v.watchedSeconds, 0) / 60,
  )

  // 연속 학습일 (오늘 미학습이면 어제부터 카운트)
  let streak = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (state.attendance[d.toISOString().slice(0, 10)]) streak++
    else if (i > 0) break
  }

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

  const correctPct = state.attempts.length
    ? Math.round((state.attempts.filter((a) => a.correct).length / state.attempts.length) * 100)
    : null

  return {
    doneDays,
    totalDays,
    donePct: totalDays ? Math.round((doneDays / totalDays) * 100) : 0,
    streak,
    videosDone,
    watchedMin,
    correctPct,
    attempts: state.attempts.length,
    weak,
  }
}
