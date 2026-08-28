// 데모 모드 데이터 레이어 — localStorage 기반.
// Supabase 키(VITE_SUPABASE_URL 등)가 설정되면 lib/supabase.ts 로 교체 연결한다 (Phase 2).
import type {
  AttemptRecord, DayState, Duration, Level, Profile, Question, SyllabusTemplate, VideoProgress,
} from './types'
import sampleQuestions from '../data/sample_questions.json'
import bankMath from '../data/question_bank_math.json'
import bankRla from '../data/question_bank_rla.json'

const KEY = 'ged-app-v1'

export interface AppState {
  profile: Profile | null
  videoProgress: Record<string, VideoProgress>
  dayStates: Record<number, DayState>   // dayIndex → state
  currentDayIndex: number
  attempts: AttemptRecord[]
  attendance: Record<string, boolean>   // 'YYYY-MM-DD' → 학습함
}

const empty: AppState = {
  profile: null, videoProgress: {}, dayStates: {}, currentDayIndex: 0,
  attempts: [], attendance: {},
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty }
  } catch {
    return { ...empty }
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 무시 */ }
  listeners.forEach((fn) => fn())
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  setProfile(p: Profile) { state = { ...state, profile: p }; save() },

  /** 서버 상태로 로컬 전체 교체 (Supabase 로그인 시) */
  hydrate(partial: Partial<AppState>) {
    state = { ...empty, ...partial }
    save()
  },
  logout() { state = { ...empty }; localStorage.removeItem(KEY); save() },
  reset() { this.logout() },

  markAttendanceToday() {
    const today = new Date().toISOString().slice(0, 10)
    if (!state.attendance[today]) {
      state = { ...state, attendance: { ...state.attendance, [today]: true } }
      save()
    }
  },

  updateVideoProgress(videoRef: string, watchedSeconds: number, durationSec: number) {
    const prev = state.videoProgress[videoRef] ?? { watchedSeconds: 0, completed: false }
    const watched = Math.max(prev.watchedSeconds, watchedSeconds)
    const completed = prev.completed || watched >= durationSec * 0.9
    state = {
      ...state,
      videoProgress: {
        ...state.videoProgress,
        [videoRef]: {
          watchedSeconds: watched, completed,
          completedAt: completed && !prev.completed ? new Date().toISOString() : prev.completedAt,
        },
      },
    }
    save()
  },

  completeBlock(dayIndex: number, blockIndex: number, totalRequired: number) {
    const ds = state.dayStates[dayIndex] ?? { doneBlocks: [], finished: false }
    if (ds.doneBlocks.includes(blockIndex)) return
    const doneBlocks = [...ds.doneBlocks, blockIndex]
    const finished = doneBlocks.length >= totalRequired
    const next: DayState = {
      doneBlocks, finished,
      finishedAt: finished ? new Date().toISOString() : ds.finishedAt,
    }
    state = {
      ...state,
      dayStates: { ...state.dayStates, [dayIndex]: next },
      currentDayIndex: finished ? Math.max(state.currentDayIndex, dayIndex + 1) : state.currentDayIndex,
    }
    this.markAttendanceToday()
    save()
  },

  advanceDay() {
    state = { ...state, currentDayIndex: state.currentDayIndex + 1 }
    save()
  },

  recordAttempt(a: AttemptRecord) {
    state = { ...state, attempts: [...state.attempts, a] }
    save()
  },
}

// ───────────────────────── 실라버스 로딩 (12개 JSON, 코드 스플리팅)
const templates = import.meta.glob<SyllabusTemplate>('../data/syllabus/*.json', { import: 'default' })

export async function loadTemplate(duration: Duration, level: Level): Promise<SyllabusTemplate> {
  const key = `../data/syllabus/${duration}_${level}.json`
  const loader = templates[key]
  if (!loader) throw new Error(`실라버스 템플릿 없음: ${duration}_${level}`)
  return loader()
}

// ───────────────────────── 문항
export function getQuestions(): Question[] {
  return [
    ...(sampleQuestions as { questions: Question[] }).questions,
    ...(bankMath as { questions: Question[] }).questions,
    ...(bankRla as { questions: Question[] }).questions,
  ]
}

export function placementQuestions(subject: 'math' | 'rla'): Question[] {
  return getQuestions().filter((q) => q.purpose === 'placement' && q.subject === subject)
}

export function practiceQuestions(subject: string, n: number): Question[] {
  const pool = getQuestions().filter((q) => q.purpose === 'practice' && q.subject === subject)
  const fallback = getQuestions().filter((q) => q.subject === subject)
  const src = pool.length > 0 ? pool : fallback
  return [...src].sort(() => Math.random() - 0.5).slice(0, n)
}

export function scoreToLevel(pct: number): Level {
  if (pct >= 80) return 'adv'
  if (pct >= 50) return 'inter'
  return 'basic'
}
