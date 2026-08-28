import { useAppState } from '../lib/useStore'
import { useRoadmap } from '../lib/roadmap'
import { SUBJECT_LABEL } from '../lib/types'

export default function ProgressPage() {
  const state = useAppState()
  const p = state.profile!
  const { roadmap } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)
  if (!roadmap) return <div className="page muted">불러오는 중…</div>

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

  // 과목별 정답률
  const attempts = state.attempts
  const correctPct = attempts.length
    ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null

  return (
    <div className="page">
      <h1>내 진도</h1>
      <div className="stat-grid">
        <div className="card stat"><div className="score">{doneDays}<span className="unit">/{totalDays}일</span></div><div className="muted">완료한 학습일</div></div>
        <div className="card stat"><div className="score">{streak}<span className="unit">일</span></div><div className="muted">연속 학습</div></div>
        <div className="card stat"><div className="score">{videosDone}<span className="unit">개</span></div><div className="muted">완료한 영상</div></div>
        <div className="card stat"><div className="score">{watchedMin}<span className="unit">분</span></div><div className="muted">누적 시청 시간</div></div>
        <div className="card stat"><div className="score">{correctPct !== null ? `${correctPct}%` : '—'}</div><div className="muted">전체 정답률</div></div>
      </div>

      <div className="card">
        <h3>전체 진행률</h3>
        <div className="progressbar big"><div style={{ width: `${(doneDays / totalDays) * 100}%` }} /></div>
        <div className="muted small">{roadmap.label} 과정 · {Math.round((doneDays / totalDays) * 100)}%</div>
      </div>

      <div className="card">
        <h3>취약 스킬 Top 3</h3>
        {weak.length === 0
          ? <p className="muted">아직 데이터가 부족합니다. 문항을 더 풀어보세요.</p>
          : (
            <ul>
              {weak.map(([tag, s]) => (
                <li key={tag}>
                  <b>{tag}</b> — 오답률 {Math.round((s.wrong / s.total) * 100)}% ({s.wrong}/{s.total})
                  <span className="muted small"> → 보충 계획 추천 대상</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      <p className="muted small">{SUBJECT_LABEL.math} 레벨과 {SUBJECT_LABEL.rla} 레벨은 관리자가 조정할 수 있습니다.</p>
    </div>
  )
}
