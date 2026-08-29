import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { untranslatedItems, summaryCount } from '../lib/summaries'
import summaries from '../data/video_summaries.json'

const BATCH = 40

/** 강의 요약 모국어 번역 — 관리자가 배치로 돌린다. */
export default function TranslatePanel() {
  const { t } = useT()
  const [done, setDone] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    if (!supabase) return
    const { count } = await supabase
      .from('video_summaries').select('youtube_id', { count: 'exact', head: true })
      .not('translated_at', 'is', null)
    setDone(count ?? 0)
  }
  useEffect(() => { refresh() }, [])

  async function run() {
    if (!supabase) return
    setRunning(true); setMsg(null)
    try {
      // 아직 번역되지 않은 것부터 BATCH만큼
      const ids = Object.keys(summaries as Record<string, unknown>)
      const { data: existing } = await supabase
        .from('video_summaries').select('youtube_id').not('translated_at', 'is', null)
      const has = new Set((existing ?? []).map((r) => r.youtube_id as string))
      const pending = ids.filter((id) => !has.has(id)).slice(0, BATCH)
      if (pending.length === 0) { setMsg(t.trDoneAll); setRunning(false); return }

      const items = untranslatedItems(pending.map((id) => ({ youtube_id: id, title: id })))
      const { data, error } = await supabase.functions.invoke('translate-summaries', {
        body: { items },
      })
      if (error) throw error
      const r = data as { translated?: number; skipped?: number; error?: string }
      setMsg(r.error ? `${t.trFailed}: ${r.error}` : t.trResult(r.translated ?? 0, r.skipped ?? 0))
      await refresh()
    } catch (e) {
      setMsg(`${t.trFailed}: ${String((e as Error)?.message ?? e)}`)
    }
    setRunning(false)
  }

  const pct = done === null ? 0 : Math.round((done / summaryCount) * 100)
  return (
    <div className="card gen-panel">
      <h3>{t.trTitle}</h3>
      <p className="muted small">{t.trNote}</p>
      <div className="progressbar thin"><div style={{ width: `${pct}%` }} /></div>
      <div className="gen-row">
        <span className="muted small">
          {done === null ? '…' : t.trProgress(done, summaryCount, pct)}
        </span>
        <button className="primary" disabled={running} onClick={run}>
          {running ? t.trRunning : t.trRun(BATCH)}
        </button>
        <button className="ghost" disabled={running} onClick={refresh}>{t.genRefresh}</button>
      </div>
      {msg && <p className="muted small">{msg}</p>}
    </div>
  )
}
