import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store, COMPLETE_RATIO } from '../lib/store'
import { useRoadmap } from '../lib/roadmap'
import { useT } from '../lib/i18n'
import { useSummary } from '../lib/summaries'
import { loadYouTubeApi } from '../lib/youtube'
import {
  byteLength, decodeSeen, encodeSeen, markRange, seedFromLegacy, seenSeconds,
} from '../lib/watch'

export default function Lesson() {
  const { dayIndex = '0', blockIndex = '0', videoIndex = '0' } = useParams()
  const state = useAppState()
  const { t, lang } = useT()
  const p = state.profile!
  const { roadmap } = useRoadmap(p.duration, p.levelMath, p.levelEnglish, p.style)

  const di = Number(dayIndex); const bi = Number(blockIndex); const vi = Number(videoIndex)
  const video = roadmap?.days[di]?.blocks[bi]?.videos?.[vi]
  const summary = useSummary(video?.youtube_id ?? null, lang)

  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  const vp = video?.youtube_id ? state.videoProgress[video.youtube_id] : undefined
  const completed = vp?.completed ?? false
  // 플레이어가 알려주는 실제 길이를 우선 사용한다 (메타데이터가 틀리면 영원히 완료되지 않으므로)
  const duration = vp?.durationSec || video?.duration_sec || 0

  useEffect(() => {
    if (!video?.youtube_id || !hostRef.current) return
    const id = video.youtube_id
    let interval: ReturnType<typeof setInterval> | null = null
    let destroyed = false

    // 저장된 시청 구간을 불러와 이어서 채운다 (여러 번 나눠 봐도 누적되는 지점)
    const saved = store.get().videoProgress[id]
    let dur = saved?.durationSec || video.duration_sec || 0
    let bits = decodeSeen(saved?.seen, byteLength(dur))
    if (!saved?.seen && saved?.watchedSeconds) seedFromLegacy(bits, saved.watchedSeconds)
    let lastPos = saved?.lastPos ?? 0
    let ended = false

    const flush = () => {
      if (!dur) return
      store.recordWatch(id, {
        seen: encodeSeen(bits),
        watchedSeconds: seenSeconds(bits, dur),
        durationSec: dur,
        lastPos,
        ended,
      })
    }

    const sample = () => {
      const pl = playerRef.current
      if (!pl?.getCurrentTime) return
      const now = pl.getCurrentTime() as number
      if (typeof now !== 'number' || Number.isNaN(now)) return
      markRange(bits, lastPos, now)
      lastPos = now
    }

    loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: id,
        playerVars: { rel: 0, modestbranding: 1, start: Math.max(0, Math.floor((saved?.lastPos ?? 0) - 3)) },
        events: {
          onReady: (e: any) => {
            setReady(true)
            // 실제 길이로 교체 — 메타데이터와 다르면 비트맵 크기도 다시 맞춘다
            const real = Math.round(e.target.getDuration?.() ?? 0)
            if (real > 0 && Math.abs(real - dur) > 1) {
              const next = decodeSeen(encodeSeen(bits), byteLength(real))
              bits = next
              dur = real
            }
            lastPos = e.target.getCurrentTime?.() ?? lastPos
          },
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.PLAYING) {
              lastPos = playerRef.current?.getCurrentTime?.() ?? lastPos
              if (!interval) {
                // 재생 위치를 0.5초마다 표시 — 배속 재생에서도 구간이 빠지지 않는다
                interval = setInterval(() => { sample(); flush() }, 500)
              }
            } else {
              if (interval) { clearInterval(interval); interval = null }
              if (e.data === YT.PlayerState.ENDED) { ended = true; lastPos = dur }
              sample()
              flush()
            }
          },
        },
      })
    })

    return () => {
      destroyed = true
      if (interval) clearInterval(interval)
      sample()
      flush()
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.youtube_id])

  if (!roadmap) return <div className="page muted">{t.loading}</div>
  if (!video) return <div className="page">{t.videoNotFound} <Link to="/today">{t.toToday}</Link></div>

  const needSec = Math.max(0, Math.ceil(duration * COMPLETE_RATIO - (vp?.watchedSeconds ?? 0)))
  const watchedPct = duration
    ? Math.min(100, Math.round(((vp?.watchedSeconds ?? 0) / duration) * 100)) : 0
  const block = roadmap.days[di].blocks[bi]
  const nextVideo = block.videos?.[vi + 1]

  return (
    <div className="page">
      <div className="lesson-head">
        <Link to="/today" className="muted">{t.backToday}</Link>
        <h1>{video.title}</h1>
        <div className="muted small">{video.course_title} › {video.unit} › {video.lesson}</div>
      </div>

      <div className="player-wrap card">
        <div ref={hostRef} />
        {!ready && <div className="muted small">{t.playerLoading}</div>}
      </div>

      <div className="lesson-status card">
        <div className="progressbar"><div style={{ width: `${watchedPct}%` }} /></div>
        <div className="lesson-status-row">
          <span>
            {completed ? t.watchDone : (
              <>
                {t.watchPct(watchedPct)}
                {needSec > 0 && <span className="muted"> · {t.watchLeft(needSec)}</span>}
              </>
            )}
          </span>
          {nextVideo
            ? <Link className="btn primary" to={`/lesson/${di}/${bi}/${vi + 1}`}>{t.nextVideo}</Link>
            : <Link className="btn primary" to="/today">{t.backToTasks}</Link>}
        </div>
        {!completed && <p className="muted small watch-hint">{t.watchHint}</p>}
      </div>

      <div className="card summary">
        <h3>{t.summary}</h3>
        {summary
          ? (
            <>
              <p className="summary-body">{summary.text}</p>
              {summary.fallback && <p className="muted small">{t.summaryEnOnly}</p>}
            </>
          )
          : <p className="muted">{t.summaryPending}</p>}
        <p className="muted small">{t.source}: Khan Academy (CC BY-NC-SA) · <a href={video.youtube_url ?? '#'} target="_blank" rel="noreferrer">{t.watchOnYt}</a></p>
      </div>
    </div>
  )
}
