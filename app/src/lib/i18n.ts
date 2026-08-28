// UI 다국어 (한국어/영어 완전 지원). 콘텐츠 다국어(zh/th 해설)는 별도 파이프라인.
import { useSyncExternalStore } from 'react'

export type UiLang = 'ko' | 'en'
const UI_LANG_KEY = 'ged-ui-lang'

let uiLang: UiLang = (() => {
  try {
    const saved = localStorage.getItem(UI_LANG_KEY)
    if (saved === 'ko' || saved === 'en') return saved
  } catch { /* 무시 */ }
  return 'ko'
})()

const listeners = new Set<() => void>()

export function setUiLang(lang: UiLang) {
  uiLang = lang
  try { localStorage.setItem(UI_LANG_KEY, lang) } catch { /* 무시 */ }
  listeners.forEach((fn) => fn())
}

export function useUiLang(): UiLang {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => uiLang,
  )
}

const dict = {
  ko: {
    appName: 'GED 자율학습',
    navToday: '오늘의 과제', navProgress: '내 진도', navDashboard: '대시보드', logout: '로그아웃',
    langToggle: 'English',

    // 로그인
    demoNote: '데모 모드 — Supabase 연결 전 파일럿 미리보기',
    name: '이름', namePh: '이름을 입력하세요', nativeLang: '모국어', role: '역할',
    student: '학생', admin: '관리자', start: '시작하기',
    email: '이메일', password: '비밀번호 (6자 이상)',
    signIn: '로그인', signUp: '계정 만들기',
    toSignUp: '계정이 없나요? 가입하기', toSignIn: '이미 계정이 있나요? 로그인',
    checkEmail: '확인 이메일을 보냈습니다. 메일함을 확인해 주세요. (파일럿에서는 관리자가 이메일 확인을 꺼둘 수 있습니다)',
    authWorking: '처리 중…',

    // 기간 선택
    setupTitle: '학습 기간 선택',
    setupDesc: '기간은 학습 분량을 결정합니다 (속도가 아니라). 다음 단계에서 배치 테스트로 난이도(레벨)를 정합니다.',
    d6m: '6개월', d1y: '1년', d2y: '2년', d3y: '3년',
    d6mDesc: '합격선 통과 최소 코어 (영어 중급 이상 권장)', d6mDaily: '하루 100분 · 주 6일',
    d1yDesc: '표준 과정 — 기본값 권장', d1yDaily: '하루 65분 · 주 5일',
    d2yDesc: '선행(산수·중학과학) 포함, 영어 초급', d2yDaily: '하루 45분 · 주 5일',
    d3yDesc: '중학 과정부터 차근차근 + 고득점 심화', d3yDaily: '하루 35분 · 주 5일',

    // 배치 테스트
    placementTitle: '배치 테스트',
    placementIntro: (m: number, e: number) => `수학 ${m}문항 → 영어 ${e}문항을 풉니다. 결과에 따라 과목별 레벨(기초/중급/상급)이 정해집니다.`,
    cutBasic: '50% 미만 → 기초: 전 과정 처음부터',
    cutInter: '50–79% → 중급: 기초 유닛 건너뛰기',
    cutAdv: '80% 이상 → 상급: 입문 과정 건너뛰기 + 상위 콘텐츠',
    placementTip: '모르는 문제는 찍지 말고 가장 그럴듯한 답을 고르세요. 레벨은 관리자 확인 후 조정될 수 있습니다.',
    startTest: '테스트 시작',
    resultTitle: '배치 결과',
    scienceNote: '과학·사회 트랙은 영어 레벨을 따릅니다 (병목은 배경지식이 아니라 영어 독해력).',
    generateRoadmap: '로드맵 생성하고 시작하기',

    // 과목·레벨
    math: '수학', english: '영어', rla: '영어(RLA)', science: '과학', social: '사회', t0: '선행',
    basic: '기초', inter: '중급', adv: '상급',

    // 블록
    warmupTitle: '워밍업 — 복습 5문항', checkinTitle: '체크인 — 이해도 자가평가',
    studySuffix: ' 학습', integrationTitle: '실전 통합 복습', mockTitle: '모의고사',
    weeklyTest: '위클리 테스트', monthlyTest: '먼슬리 테스트',
    minutes: (n: number) => `${n}분`,

    // 오늘의 과제
    todayTitle: (w: number, d: number) => `오늘의 과제 — ${w}주차 Day ${d}`,
    doneOf: (a: number, b: number) => `${a} / ${b} 완료`,
    weekTitle: (w: number) => `${w}주차`,
    dayOfTotal: (a: number, b: number) => `전체 ${b}일 중 ${a}일차`,
    allDone: '🎓 모든 일정을 완료했습니다!',
    dayDone: '🎉 오늘 학습 완료! 내일 다시 만나요.',
    videosFirst: '영상을 모두 시청하면 문항을 풀 수 있어요',
    solve: '문항 풀기', solveMin: (n: number) => `문항 풀기 (${n}분)`, complete: '완료',
    checkinHard: '😵 어려웠어요', checkinOk: '🙂 보통이에요', checkinEasy: '😄 쉬웠어요',
    attribution: '영상 출처: Khan Academy (CC BY-NC-SA) — youtube.com 임베드',
    loading: '불러오는 중…', roadmapLoading: '로드맵 불러오는 중…',

    // 레슨
    backToday: '← 오늘의 과제', playerLoading: '플레이어 로딩 중…',
    videoNotFound: '영상을 찾을 수 없습니다.', toToday: '오늘의 과제로',
    watchDone: '✅ 시청 완료', watchPct: (p: number) => `시청 ${p}% (90% 이상이면 완료)`,
    nextVideo: '다음 영상 →', backToTasks: '과제로 돌아가기',
    summary: '요약', summaryPending: '모국어 요약이 준비 중입니다. (다국어 해설 파이프라인 Phase 2)',
    source: '출처', watchOnYt: 'YouTube에서 보기',

    // 퀴즈
    blockNotFound: '블록을 찾을 수 없습니다.', noQuestions: '이 과목의 문항이 아직 준비되지 않았습니다.',
    correct: '✅ 정답!', wrong: '❌ 오답',
    nextQ: '다음 문항 →', seeResults: '결과 보기',
    quizDone: (t: string) => `${t} 완료`,
    accuracy: (p: number) => `정답률 ${p}%`,
    reviewNote: ' — 틀린 문항은 복습 큐에 등록됩니다 (1·3·7·21일 간격)',
    completeBlock: '블록 완료',
    engExplain: 'English explanation', nativeExplain: '모국어 해설 보기',

    // 진도
    progressTitle: '내 진도',
    doneDaysLabel: '완료한 학습일', streakLabel: '연속 학습', videosLabel: '완료한 영상',
    watchedLabel: '누적 시청 시간', accuracyLabel: '전체 정답률',
    unitDays: '일', unitCount: '개', unitMin: '분',
    overallTitle: '전체 진행률',
    courseOf: (label: string, p: number) => `${label} 과정 · ${p}%`,
    weakTitle: '취약 스킬 Top 3',
    weakEmpty: '아직 데이터가 부족합니다. 문항을 더 풀어보세요.',
    weakRow: (p: number, w: number, t: number) => `오답률 ${p}% (${w}/${t})`,
    weakHint: ' → 보충 계획 추천 대상',
    levelsNote: '수학 레벨과 영어 레벨은 관리자가 조정할 수 있습니다.',

    // 관리자
    adminTitle: '관리자 대시보드',
    adminDemoNote: '데모 모드: 이 브라우저의 학생 데이터 기준. Supabase 연결 시 전체 학생 목록·집계로 확장됩니다.',
    enrolled: '등록 학생 (데모)', totalAttempts: '총 풀이 문항', avgAccuracy: '평균 정답률',
    attendance14: '최근 14일 출석', riskTitle: '⚠️ 이탈 위험 알림', noAlerts: '현재 알림 없음',
    risk3days: '3일 이상 미접속', riskAccuracy: '정답률 급락 (40% 미만)',
    studentsTitle: '학생 (데모)', thisBrowser: '이 브라우저의 학생',
    thName: '이름', thDuration: '기간', thMath: '수학', thEnglish: '영어', thDays: '완료일', thAccuracy: '정답률',
    studentsReal: '학생 목록', enrolledReal: '등록 학생', thLastActive: '최근 활동',
    loadFailed: '데이터를 불러오지 못했습니다', noStudents: '아직 등록된 학생이 없습니다.',
    notAdminNote: '이 계정은 관리자 권한이 없습니다. Supabase에서 profiles.role 을 admin 으로 변경하세요.',
  },

  en: {
    appName: 'GED Self-Study',
    navToday: "Today's Tasks", navProgress: 'My Progress', navDashboard: 'Dashboard', logout: 'Log out',
    langToggle: '한국어',

    demoNote: 'Demo mode — pilot preview before Supabase connection',
    name: 'Name', namePh: 'Enter your name', nativeLang: 'Native language', role: 'Role',
    student: 'Student', admin: 'Admin', start: 'Get started',
    email: 'Email', password: 'Password (6+ characters)',
    signIn: 'Sign in', signUp: 'Create account',
    toSignUp: "No account? Sign up", toSignIn: 'Already have an account? Sign in',
    checkEmail: 'Confirmation email sent — please check your inbox. (For the pilot, the admin may disable email confirmation)',
    authWorking: 'Working…',

    setupTitle: 'Choose your study duration',
    setupDesc: 'Duration determines how much you cover (not how fast). Next, a placement test sets your level.',
    d6m: '6 months', d1y: '1 year', d2y: '2 years', d3y: '3 years',
    d6mDesc: 'Minimum core to pass (intermediate English recommended)', d6mDaily: '100 min/day · 6 days/week',
    d1yDesc: 'Standard track — recommended default', d1yDaily: '65 min/day · 5 days/week',
    d2yDesc: 'Includes foundations (arithmetic, middle-school science)', d2yDaily: '45 min/day · 5 days/week',
    d3yDesc: 'Start from middle-school level + advanced extras', d3yDaily: '35 min/day · 5 days/week',

    placementTitle: 'Placement Test',
    placementIntro: (m: number, e: number) => `You'll answer ${m} math questions, then ${e} English questions. Your level (Basic/Intermediate/Advanced) is set per subject.`,
    cutBasic: 'Below 50% → Basic: start from the beginning',
    cutInter: '50–79% → Intermediate: skip foundational units',
    cutAdv: '80%+ → Advanced: skip intro courses + extra content',
    placementTip: "Don't guess randomly — pick the most plausible answer. An admin may adjust your level afterwards.",
    startTest: 'Start test',
    resultTitle: 'Placement Results',
    scienceNote: 'Science & Social Studies follow your English level (the bottleneck is reading, not background knowledge).',
    generateRoadmap: 'Generate my roadmap',

    math: 'Math', english: 'English', rla: 'English (RLA)', science: 'Science', social: 'Social Studies', t0: 'Foundations',
    basic: 'Basic', inter: 'Intermediate', adv: 'Advanced',

    warmupTitle: 'Warm-up — 5 review questions', checkinTitle: 'Check-in — self-assessment',
    studySuffix: ' study', integrationTitle: 'Integrated review', mockTitle: 'Mock exam',
    weeklyTest: 'Weekly test', monthlyTest: 'Monthly test',
    minutes: (n: number) => `${n} min`,

    todayTitle: (w: number, d: number) => `Today's Tasks — Week ${w}, Day ${d}`,
    doneOf: (a: number, b: number) => `${a} / ${b} done`,
    weekTitle: (w: number) => `Week ${w}`,
    dayOfTotal: (a: number, b: number) => `Day ${a} of ${b}`,
    allDone: '🎓 You completed the entire program!',
    dayDone: "🎉 Today's study is done! See you tomorrow.",
    videosFirst: 'Watch all videos to unlock the questions',
    solve: 'Solve questions', solveMin: (n: number) => `Solve questions (${n} min)`, complete: 'Done',
    checkinHard: '😵 It was hard', checkinOk: '🙂 It was okay', checkinEasy: '😄 It was easy',
    attribution: 'Videos: Khan Academy (CC BY-NC-SA) — embedded from youtube.com',
    loading: 'Loading…', roadmapLoading: 'Loading roadmap…',

    backToday: "← Today's Tasks", playerLoading: 'Loading player…',
    videoNotFound: 'Video not found.', toToday: "Go to Today's Tasks",
    watchDone: '✅ Watched', watchPct: (p: number) => `Watched ${p}% (90% counts as complete)`,
    nextVideo: 'Next video →', backToTasks: 'Back to tasks',
    summary: 'Summary', summaryPending: 'Native-language summary coming soon. (Multilingual pipeline, Phase 2)',
    source: 'Source', watchOnYt: 'Watch on YouTube',

    blockNotFound: 'Block not found.', noQuestions: 'No questions available for this subject yet.',
    correct: '✅ Correct!', wrong: '❌ Incorrect',
    nextQ: 'Next question →', seeResults: 'See results',
    quizDone: (t: string) => `${t} — complete`,
    accuracy: (p: number) => `Accuracy ${p}%`,
    reviewNote: ' — missed questions go to your review queue (1·3·7·21-day intervals)',
    completeBlock: 'Complete block',
    engExplain: 'English explanation', nativeExplain: 'Show native-language explanation',

    progressTitle: 'My Progress',
    doneDaysLabel: 'Study days completed', streakLabel: 'Day streak', videosLabel: 'Videos completed',
    watchedLabel: 'Total watch time', accuracyLabel: 'Overall accuracy',
    unitDays: ' days', unitCount: '', unitMin: ' min',
    overallTitle: 'Overall progress',
    courseOf: (label: string, p: number) => `${label} track · ${p}%`,
    weakTitle: 'Weakest skills (Top 3)',
    weakEmpty: 'Not enough data yet — solve more questions.',
    weakRow: (p: number, w: number, t: number) => `${p}% incorrect (${w}/${t})`,
    weakHint: ' → candidate for remediation plan',
    levelsNote: 'An admin can adjust your Math and English levels.',

    adminTitle: 'Admin Dashboard',
    adminDemoNote: "Demo mode: showing this browser's student data. With Supabase connected, this expands to all students.",
    enrolled: 'Enrolled students (demo)', totalAttempts: 'Questions attempted', avgAccuracy: 'Avg. accuracy',
    attendance14: 'Attendance (last 14 days)', riskTitle: '⚠️ At-risk alerts', noAlerts: 'No alerts',
    risk3days: 'No activity for 3+ days', riskAccuracy: 'Accuracy dropped below 40%',
    studentsTitle: 'Students (demo)', thisBrowser: 'Student on this browser',
    thName: 'Name', thDuration: 'Duration', thMath: 'Math', thEnglish: 'English', thDays: 'Days done', thAccuracy: 'Accuracy',
    studentsReal: 'Students', enrolledReal: 'Enrolled students', thLastActive: 'Last active',
    loadFailed: 'Failed to load data', noStudents: 'No students enrolled yet.',
    notAdminNote: "This account isn't an admin. Set profiles.role to 'admin' in Supabase.",
  },
} as const

export type Dict = typeof dict.ko

export function useT(): { t: Dict; lang: UiLang } {
  const lang = useUiLang()
  return { t: dict[lang] as Dict, lang }
}

/** 트랙 이름(name) → 표시 라벨. 실라버스 JSON의 한국어 label 대신 UI 언어를 따른다. */
export function trackLabel(t: Dict, track?: string): string {
  switch (track) {
    case 'math': return t.math
    case 'english': return t.english
    case 'science': return t.science
    case 'social': return t.social
    case 't0': return t.t0
    default: return track ?? ''
  }
}

export function durationLabel(t: Dict, d: string): string {
  return ({ '6m': t.d6m, '1y': t.d1y, '2y': t.d2y, '3y': t.d3y } as Record<string, string>)[d] ?? d
}

export function levelLabel(t: Dict, l: string): string {
  return ({ basic: t.basic, inter: t.inter, adv: t.adv } as Record<string, string>)[l] ?? l
}

export function subjectLabel(t: Dict, s: string): string {
  return ({ math: t.math, rla: t.rla, science: t.science, social: t.social } as Record<string, string>)[s] ?? s
}
