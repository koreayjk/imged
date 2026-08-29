import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useAppState } from './lib/useStore'
import { store } from './lib/store'
import { supabase, supabaseEnabled } from './lib/supabase'
import { signOut, startSync, stopSync } from './lib/sync'
import { useT, setUiLang, durationLabel, levelLabel } from './lib/i18n'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Placement from './pages/Placement'
import Today from './pages/Today'
import Lesson from './pages/Lesson'
import Quiz from './pages/Quiz'
import Essay from './pages/Essay'
import ProgressPage from './pages/Progress'
import Admin from './pages/Admin'
import ReviewQuestions from './pages/ReviewQuestions'

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useAppState()
  const { t, lang } = useT()
  const loc = useLocation()
  if (!profile) return <Navigate to="/login" replace />
  const nav = profile.role === 'admin'
    ? [['/admin', t.navDashboard] as const, ['/review', t.navReview] as const]
    : [['/today', t.navToday] as const, ['/essay', t.navEssay] as const, ['/progress', t.navProgress] as const]
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">{t.appName}</div>
        <nav>
          {nav.map(([to, label]) => (
            <Link key={to} to={to} className={loc.pathname.startsWith(to) ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="userbox">
          <span>
            {profile.name}
            {profile.duration && ` · ${durationLabel(t, profile.duration)}`}
            {profile.levelMath && ` · ${t.math} ${levelLabel(t, profile.levelMath)}`}
            {profile.levelEnglish && ` / ${t.english} ${levelLabel(t, profile.levelEnglish)}`}
          </span>
          <button className="ghost small" onClick={() => setUiLang(lang === 'ko' ? 'en' : 'ko')}>{t.langToggle}</button>
          <button className="ghost" onClick={() => (supabaseEnabled ? signOut() : store.logout())}>{t.logout}</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

function StudentGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAppState()
  if (!profile) return <Navigate to="/login" replace />
  if (!profile.duration) return <Navigate to="/setup" replace />
  if (!profile.levelMath || !profile.levelEnglish) return <Navigate to="/placement" replace />
  return <>{children}</>
}

export default function App() {
  const { profile } = useAppState()

  // Supabase 세션 복원 + 인증 상태 추적
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) startSync(data.session.user.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) startSync(session.user.id)
      if (event === 'SIGNED_OUT') { stopSync(); store.logout() }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={profile ? <Navigate to={profile.role === 'admin' ? '/admin' : '/today'} replace /> : <Login />} />
        <Route path="/setup" element={<Shell><Setup /></Shell>} />
        <Route path="/placement" element={<Shell><Placement /></Shell>} />
        <Route path="/today" element={<Shell><StudentGate><Today /></StudentGate></Shell>} />
        <Route path="/lesson/:dayIndex/:blockIndex/:videoIndex" element={<Shell><StudentGate><Lesson /></StudentGate></Shell>} />
        <Route path="/quiz/:dayIndex/:blockIndex" element={<Shell><StudentGate><Quiz /></StudentGate></Shell>} />
        <Route path="/essay" element={<Shell><StudentGate><Essay /></StudentGate></Shell>} />
        <Route path="/progress" element={<Shell><StudentGate><ProgressPage /></StudentGate></Shell>} />
        <Route path="/admin" element={<Shell><Admin /></Shell>} />
        <Route path="/review" element={<Shell><ReviewQuestions /></Shell>} />
        <Route path="*" element={<Navigate to={profile ? (profile.role === 'admin' ? '/admin' : '/today') : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
