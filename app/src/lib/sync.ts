// Supabase 동기화 레이어.
// - 로그인 시: profiles + student_state 를 불러와 로컬 스토어를 서버 상태로 교체
// - 이후: 스토어 변경을 디바운스(2초)로 student_state 에 업서트, 프로필 필드는 profiles 에 반영
import { supabase } from './supabase'
import { store } from './store'
import type { Profile } from './types'

let syncedUserId: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribe: (() => void) | null = null
let applyingRemote = false

export function currentUserId() {
  return syncedUserId
}

export async function signUp(email: string, password: string, name: string, nativeLang: string) {
  const { data, error } = await supabase!.auth.signUp({
    email, password,
    options: { data: { name, native_lang: nativeLang } },
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  stopSync()
  await supabase!.auth.signOut()
  store.logout()
}

/** 세션 확보 후 호출: 서버 상태로 로컬 스토어를 초기화하고 푸시 동기화 시작 */
export async function startSync(userId: string) {
  if (syncedUserId === userId) return
  stopSync()
  syncedUserId = userId

  const [{ data: prof }, { data: st }] = await Promise.all([
    supabase!.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase!.from('student_state').select('state').eq('user_id', userId).maybeSingle(),
  ])

  const profile: Profile = {
    name: prof?.name ?? '학생',
    role: (prof?.role as Profile['role']) ?? 'student',
    nativeLang: (prof?.native_lang as Profile['nativeLang']) ?? 'ko',
    duration: (prof?.target_duration as Profile['duration']) ?? null,
    style: (prof?.curriculum_style as Profile['style']) ?? 'focus',
    levelMath: (prof?.placement_math as Profile['levelMath']) ?? null,
    levelEnglish: (prof?.placement_english as Profile['levelEnglish']) ?? null,
    startedAt: prof?.enrolled_at ?? null,
  }

  applyingRemote = true
  store.hydrate({ ...(st?.state as object ?? {}), profile })
  applyingRemote = false

  unsubscribe = store.subscribe(() => {
    if (applyingRemote) return
    schedulePush()
  })
}

export function stopSync() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  unsubscribe?.()
  unsubscribe = null
  syncedUserId = null
}

function schedulePush() {
  if (!syncedUserId) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(pushNow, 2000)
}

async function pushNow() {
  const uid = syncedUserId
  if (!uid) return
  const s = store.get()
  if (!s.profile) return
  const { videoProgress, dayStates, currentDayIndex, attempts, attendance } = s
  try {
    await Promise.all([
      supabase!.from('student_state').upsert({
        user_id: uid,
        state: { videoProgress, dayStates, currentDayIndex, attempts, attendance },
        updated_at: new Date().toISOString(),
      }),
      supabase!.from('profiles').update({
        name: s.profile.name,
        native_lang: s.profile.nativeLang,
        target_duration: s.profile.duration,
        curriculum_style: s.profile.style ?? 'focus',
        placement_math: s.profile.levelMath,
        placement_english: s.profile.levelEnglish,
      }).eq('id', uid),
    ])
  } catch (e) {
    console.warn('sync push failed', e)
  }
}

/** 관리자용: 전체 학생 + 상태 요약 */
export interface StudentSummary {
  id: string
  name: string
  duration: string | null
  levelMath: string | null
  levelEnglish: string | null
  doneDays: number
  attempts: number
  correctPct: number | null
  lastActive: string | null
  attendance: Record<string, boolean>
}

export async function fetchStudents(): Promise<StudentSummary[]> {
  const [{ data: profs, error: e1 }, { data: states, error: e2 }] = await Promise.all([
    supabase!.from('profiles').select('*').eq('role', 'student'),
    supabase!.from('student_state').select('user_id, state, updated_at'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const stById = new Map((states ?? []).map((r) => [r.user_id, r]))
  return (profs ?? []).map((p) => {
    const row = stById.get(p.id)
    const st = (row?.state ?? {}) as {
      dayStates?: Record<string, { finished?: boolean }>
      attempts?: { correct: boolean }[]
      attendance?: Record<string, boolean>
    }
    const attempts = st.attempts ?? []
    const doneDays = Object.values(st.dayStates ?? {}).filter((d) => d.finished).length
    return {
      id: p.id, name: p.name,
      duration: p.target_duration, style: p.curriculum_style ?? 'focus',
      levelMath: p.placement_math, levelEnglish: p.placement_english,
      doneDays,
      attempts: attempts.length,
      correctPct: attempts.length
        ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null,
      lastActive: row?.updated_at ?? null,
      attendance: st.attendance ?? {},
    }
  })
}
