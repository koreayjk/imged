import { useState } from 'react'
import { store } from '../lib/store'
import type { Lang } from '../lib/types'

// 데모 모드 로그인. Supabase 연결 시 이메일+비밀번호(Auth)로 교체한다.
export default function Login() {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [lang, setLang] = useState<Lang>('ko')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    store.setProfile({
      name: name.trim(), role, nativeLang: lang,
      duration: null, levelMath: null, levelEnglish: null, startedAt: null,
    })
  }

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>GED 자율학습</h1>
        <p className="muted">데모 모드 — Supabase 연결 전 파일럿 미리보기</p>
        <label>
          이름
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" autoFocus />
        </label>
        <label>
          모국어
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="th">ไทย</option>
          </select>
        </label>
        <label>
          역할
          <select value={role} onChange={(e) => setRole(e.target.value as 'student' | 'admin')}>
            <option value="student">학생</option>
            <option value="admin">관리자</option>
          </select>
        </label>
        <button type="submit" className="primary">시작하기</button>
      </form>
    </div>
  )
}
