export type Duration = '6m' | '1y' | '2y' | '3y'
export type Level = 'basic' | 'inter' | 'adv'
export type Subject = 'math' | 'rla' | 'science' | 'social'
export type Lang = 'en' | 'ko' | 'zh' | 'th'

export interface Video {
  title: string
  slug: string
  youtube_id: string | null
  youtube_url: string | null
  duration_sec: number
  course: string
  course_title: string
  unit: string
  lesson: string
  subject: Subject
}

export interface Block {
  type: 'warmup' | 'study' | 'integration' | 'mock' | 'weekly_test' | 'monthly_test' | 'checkin'
  minutes?: number
  note?: string
  track?: string
  label?: string
  subject?: Subject
  videos?: Video[]
  practice_minutes?: number
}

export interface SyllabusDay {
  week: number
  day: number
  blocks: Block[]
}

export interface SyllabusTemplate {
  duration: Duration
  label: string
  level: Level
  level_label: string
  days: SyllabusDay[]
}

export interface Question {
  subject: Subject | 'rla'
  skill_tag: string
  difficulty: number
  format: string
  purpose: 'placement' | 'practice'
  stem_i18n: Record<string, string>
  choices: { id: string; text_i18n: Record<string, string> }[]
  answer: { choice: string }
  explanation_i18n: Record<string, string>
}

export interface Profile {
  name: string
  role: 'student' | 'admin'
  nativeLang: Lang
  duration: Duration | null
  levelMath: Level | null
  levelEnglish: Level | null
  startedAt: string | null
}

export interface VideoProgress {
  watchedSeconds: number
  completed: boolean
  completedAt?: string
}

export interface AttemptRecord {
  skillTag: string
  correct: boolean
  seconds: number
  at: string
  source: string
}

export interface DayState {
  /** 완료한 블록 인덱스들 */
  doneBlocks: number[]
  finished: boolean
  finishedAt?: string
}

export const DURATION_LABEL: Record<Duration, string> = {
  '6m': '6개월', '1y': '1년', '2y': '2년', '3y': '3년',
}
export const LEVEL_LABEL: Record<Level, string> = {
  basic: '기초', inter: '중급', adv: '상급',
}
export const SUBJECT_LABEL: Record<string, string> = {
  math: '수학', rla: '영어(RLA)', science: '과학', social: '사회',
}
