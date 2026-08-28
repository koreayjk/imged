import { useState } from 'react'
import { store } from '../lib/store'
import { useT, setUiLang } from '../lib/i18n'
import { supabaseEnabled } from '../lib/supabase'
import { signIn, signUp, startSync } from '../lib/sync'
import type { Lang } from '../lib/types'

export default function Login() {
  const { t, lang } = useT()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nativeLang, setNativeLang] = useState<Lang>('ko')
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submitSupabase(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (!name.trim()) { setMsg(t.namePh); return }
        const { session } = await signUp(email.trim(), password, name.trim(), nativeLang)
        if (!session) { setMsg(t.checkEmail); return }
        await startSync(session.user.id)
      } else {
        const { session } = await signIn(email.trim(), password)
        if (session) await startSync(session.user.id)
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function submitDemo(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    store.setProfile({
      name: name.trim(), role, nativeLang,
      duration: null, levelMath: null, levelEnglish: null, startedAt: null,
    })
  }

  const langSelect = (
    <label>
      {t.nativeLang}
      <select
        value={nativeLang}
        onChange={(e) => {
          const v = e.target.value as Lang
          setNativeLang(v)
          if (v === 'ko' || v === 'en') setUiLang(v)
        }}
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="th">ไทย</option>
      </select>
    </label>
  )

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={supabaseEnabled ? submitSupabase : submitDemo}>
        <div className="login-lang">
          <button type="button" className="ghost small" onClick={() => setUiLang(lang === 'ko' ? 'en' : 'ko')}>
            {t.langToggle}
          </button>
        </div>
        <h1>{t.appName}</h1>

        {supabaseEnabled ? (
          <>
            {mode === 'signup' && (
              <label>
                {t.name}
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} />
              </label>
            )}
            <label>
              {t.email}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label>
              {t.password}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </label>
            {mode === 'signup' && langSelect}
            {msg && <p className="muted small">{msg}</p>}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? t.authWorking : mode === 'signup' ? t.signUp : t.signIn}
            </button>
            <button type="button" className="ghost small" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMsg(null) }}>
              {mode === 'signup' ? t.toSignIn : t.toSignUp}
            </button>
          </>
        ) : (
          <>
            <p className="muted">{t.demoNote}</p>
            <label>
              {t.name}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} autoFocus />
            </label>
            {langSelect}
            <label>
              {t.role}
              <select value={role} onChange={(e) => setRole(e.target.value as 'student' | 'admin')}>
                <option value="student">{t.student}</option>
                <option value="admin">{t.admin}</option>
              </select>
            </label>
            <button type="submit" className="primary">{t.start}</button>
          </>
        )}
      </form>
    </div>
  )
}
