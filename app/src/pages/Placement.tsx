import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store, placementQuestions, scoreToLevel } from '../lib/store'
import { LEVEL_LABEL } from '../lib/types'
import type { Question } from '../lib/types'

type Phase = 'intro' | 'math' | 'english' | 'result'

function txt(i18n: Record<string, string>, lang: string) {
  return i18n[lang] ?? i18n.en ?? Object.values(i18n)[0] ?? ''
}

export default function Placement() {
  const { profile } = useAppState()
  const nav = useNavigate()
  const [phase, setPhase] = useState<Phase>('intro')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, boolean[]>>({ math: [], english: [] })

  const mathQs = useMemo(() => placementQuestions('math'), [])
  const engQs = useMemo(() => placementQuestions('rla'), [])

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  if (!profile.duration) return <Navigate to="/setup" replace />
  if (profile.levelMath && profile.levelEnglish) return <Navigate to="/today" replace />

  const lang = profile.nativeLang
  const qs: Question[] = phase === 'math' ? mathQs : engQs
  const q = qs[idx]

  function answer(choiceId: string) {
    const correct = choiceId === q.answer.choice
    const key = phase === 'math' ? 'math' : 'english'
    const next = { ...answers, [key]: [...answers[key], correct] }
    setAnswers(next)
    if (idx + 1 < qs.length) {
      setIdx(idx + 1)
    } else if (phase === 'math') {
      setPhase('english'); setIdx(0)
    } else {
      setPhase('result')
    }
  }

  function pct(arr: boolean[]) {
    return arr.length ? Math.round((arr.filter(Boolean).length / arr.length) * 100) : 0
  }

  if (phase === 'intro') {
    return (
      <div className="page narrow">
        <h1>배치 테스트</h1>
        <p>수학 {mathQs.length}문항 → 영어 {engQs.length}문항을 풉니다. 결과에 따라 과목별 레벨(기초/중급/상급)이 정해집니다.</p>
        <ul className="muted">
          <li>50% 미만 → 기초: 전 과정 처음부터</li>
          <li>50–79% → 중급: 기초 유닛 건너뛰기</li>
          <li>80% 이상 → 상급: 입문 과정 건너뛰기 + 상위 콘텐츠</li>
        </ul>
        <p className="muted">모르는 문제는 찍지 말고 가장 그럴듯한 답을 고르세요. 레벨은 관리자 확인 후 조정될 수 있습니다.</p>
        <button className="primary" onClick={() => setPhase('math')}>테스트 시작</button>
      </div>
    )
  }

  if (phase === 'result') {
    const mp = pct(answers.math)
    const ep = pct(answers.english)
    const lm = scoreToLevel(mp)
    const le = scoreToLevel(ep)
    return (
      <div className="page narrow">
        <h1>배치 결과</h1>
        <div className="result-grid">
          <div className="card">
            <div className="muted">수학</div>
            <div className="score">{mp}%</div>
            <div className="badge big">{LEVEL_LABEL[lm]}</div>
          </div>
          <div className="card">
            <div className="muted">영어</div>
            <div className="score">{ep}%</div>
            <div className="badge big">{LEVEL_LABEL[le]}</div>
          </div>
        </div>
        <p className="muted">과학·사회 트랙은 영어 레벨을 따릅니다 (병목은 배경지식이 아니라 영어 독해력).</p>
        <button
          className="primary"
          onClick={() => {
            store.setProfile({
              ...profile, levelMath: lm, levelEnglish: le,
              startedAt: new Date().toISOString(),
            })
            nav('/today')
          }}
        >
          로드맵 생성하고 시작하기
        </button>
      </div>
    )
  }

  return (
    <div className="page narrow">
      <div className="quiz-head">
        <span className="badge">{phase === 'math' ? '수학' : '영어'}</span>
        <span className="muted">{idx + 1} / {qs.length}</span>
      </div>
      <div className="progressbar"><div style={{ width: `${(idx / qs.length) * 100}%` }} /></div>
      <div className="card">
        <p className="stem">{txt(q.stem_i18n, 'en')}</p>
        {lang !== 'en' && q.stem_i18n[lang] && <p className="muted small">{q.stem_i18n[lang]}</p>}
        <div className="choices">
          {q.choices.map((c) => (
            <button key={c.id} className="choice" onClick={() => answer(c.id)}>
              <b>{c.id.toUpperCase()}.</b> {txt(c.text_i18n, 'en')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
