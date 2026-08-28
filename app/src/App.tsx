import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useAppState } from './lib/useStore'
import { store } from './lib/store'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Placement from './pages/Placement'
import Today from './pages/Today'
import Lesson from './pages/Lesson'
import Quiz from './pages/Quiz'
import ProgressPage from './pages/Progress'
import Admin from './pages/Admin'
import { DURATION_LABEL, LEVEL_LABEL } from './lib/types'

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useAppState()
  const loc = useLocation()
  if (!profile) return <Navigate to="/login" replace />
  const nav = profile.role === 'admin'
    ? [['/admin', '대시보드'] as const]
    : [['/today', '오늘의 과제'] as const, ['/progress', '내 진도'] as const]
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">GED 자율학습</div>
        <nav>
          {nav.map(([to, label]) => (
            <Link key={to} to={to} className={loc.pathname.startsWith(to) ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="userbox">
          <span>
            {profile.name}
            {profile.duration && ` · ${DURATION_LABEL[profile.duration]}`}
            {profile.levelMath && ` · 수학 ${LEVEL_LABEL[profile.levelMath]}`}
            {profile.levelEnglish && ` / 영어 ${LEVEL_LABEL[profile.levelEnglish]}`}
          </span>
          <button className="ghost" onClick={() => store.logout()}>로그아웃</button>
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={profile ? <Navigate to={profile.role === 'admin' ? '/admin' : '/today'} replace /> : <Login />} />
        <Route path="/setup" element={<Shell><Setup /></Shell>} />
        <Route path="/placement" element={<Shell><Placement /></Shell>} />
        <Route path="/today" element={<Shell><StudentGate><Today /></StudentGate></Shell>} />
        <Route path="/lesson/:dayIndex/:blockIndex/:videoIndex" element={<Shell><StudentGate><Lesson /></StudentGate></Shell>} />
        <Route path="/quiz/:dayIndex/:blockIndex" element={<Shell><StudentGate><Quiz /></StudentGate></Shell>} />
        <Route path="/progress" element={<Shell><StudentGate><ProgressPage /></StudentGate></Shell>} />
        <Route path="/admin" element={<Shell><Admin /></Shell>} />
        <Route path="*" element={<Navigate to={profile ? (profile.role === 'admin' ? '/admin' : '/today') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
