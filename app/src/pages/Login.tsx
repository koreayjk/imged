import { useState } from 'react'
import { store } from '../lib/store'
import { useT, setUiLang } from '../lib/i18n'
import type { Lang } from '../lib/types'

// 데모 모드 로그인. Supabase 연결 시 이메일+비밀번호(Auth)로 교체한다.
export default function Login() {
  const { t, lang } = useT()
  const [name, setName] = useState('')
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [nativeLang, setNativeLang] = useState<Lang>('ko')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    store.setProfile({
      name: name.trim(), role, nativeLang,
      duration: null, levelMath: null, levelEnglish: null, startedAt: null,
    })
  }

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-lang">
          <button type="button" className="ghost small" onClick={() => setUiLang(lang === 'ko' ? 'en' : 'ko')}>
            {t.langToggle}
          </button>
        </div>
        <h1>{t.appName}</h1>
        <p className="muted">{t.demoNote}</p>
        <label>
          {t.name}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} autoFocus />
        </label>
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
        <label>
          {t.role}
          <select value={role} onChange={(e) => setRole(e.target.value as 'student' | 'admin')}>
            <option value="student">{t.student}</option>
            <option value="admin">{t.admin}</option>
          </select>
        </label>
        <button type="submit" className="primary">{t.start}</button>
      </form>
    </div>
  )
}
