// 강의 요약 — 영어 원문은 번들(칸 아카데미 CC BY-NC-SA), 모국어 번역은 Supabase.
import { useEffect, useState } from 'react'
import bundled from '../data/video_summaries.json'
import { supabase } from './supabase'
import type { Lang } from './types'

const EN: Record<string, { en: string }> = bundled as Record<string, { en: string }>

export function summaryEn(youtubeId: string | null): string | null {
  return youtubeId ? EN[youtubeId]?.en ?? null : null
}

/** 번역 캐시 — 같은 영상을 다시 열 때 재조회하지 않는다. */
const translated = new Map<string, Record<string, string>>()

export interface Summary {
  text: string
  lang: Lang | 'en'
  /** 모국어 번역이 아직 없어 영어 원문을 보여주는 중 */
  fallback: boolean
}

export function useSummary(youtubeId: string | null, lang: Lang): Summary | null {
  const en = summaryEn(youtubeId)
  const [tr, setTr] = useState<Record<string, string> | null>(
    youtubeId ? translated.get(youtubeId) ?? null : null,
  )

  useEffect(() => {
    if (!youtubeId || !supabase || lang === 'en') return
    if (translated.has(youtubeId)) { setTr(translated.get(youtubeId)!); return }
    let alive = true
    supabase.from('video_summaries')
      .select('summary_i18n').eq('youtube_id', youtubeId).maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const m = (data?.summary_i18n ?? {}) as Record<string, string>
        translated.set(youtubeId, m)
        setTr(m)
      })
    return () => { alive = false }
  }, [youtubeId, lang])

  if (!en) return null
  const native = lang !== 'en' ? tr?.[lang]?.trim() : undefined
  return native
    ? { text: native, lang, fallback: false }
    : { text: en, lang: 'en', fallback: lang !== 'en' }
}

/** 관리자 화면용 — 아직 번역되지 않은 영상 목록 (번역 함수에 넘길 페이로드). */
export function untranslatedItems(
  videos: { youtube_id: string | null; title: string }[],
): { youtube_id: string; title: string; en: string }[] {
  const out: { youtube_id: string; title: string; en: string }[] = []
  const seen = new Set<string>()
  for (const v of videos) {
    const id = v.youtube_id
    if (!id || seen.has(id)) continue
    const en = EN[id]?.en
    if (!en) continue
    seen.add(id)
    out.push({ youtube_id: id, title: v.title, en })
  }
  return out
}

export const summaryCount = Object.keys(EN).length
