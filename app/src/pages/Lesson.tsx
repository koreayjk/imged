import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { store } from '../lib/store'
import { useRoadmap } from '../lib/roadmap'
import { loadYouTubeApi } from '../lib/youtube'

export default function Lesson() {
  const { dayIndex = '0', blockIndex = '0', videoIndex = '0' } = useParams()
  const state = useAppState()
  const p = state.profile!
  const { roadmap } = useRoadmap(p.duration, p.levelMath, p.levelEnglish)

  const di = Number(dayIndex); const bi = Number(blockIndex); const vi = Number(videoIndex)
  const video = roadmap?.days[di]?.blocks[bi]?.videos?.[vi]

  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const watchedRef = useRef(0)          // 실제 시청 누적 초
  const lastTickRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)

  const vp = video?.youtube_id ? state.videoProgress[video.youtube_id] : undefined
  const completed = vp?.completed ?? false

  useEffect(() => {
    if (!video?.youtube_id || !hostRef.current) return
    let interval: ReturnType<typeof setInterval> | null = null
    let destroyed = false

    loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: video.youtube_id,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.PLAYING) {
              lastTickRef.current = Date.now()
              if (!interval) {
                interval = setInterval(() => {
                  // 재생 중일 때만 1초씩 누적 (스킵 방지: 실시청 시간 기준)
                  watchedRef.current += 1
                  if (watchedRef.current % 5 === 0) {
                    store.updateVideoProgress(video.youtube_id!, watchedRef.current, video.duration_sec)
                  }
                }, 1000)
              }
            } else {
              if (interval) { clearInterval(interval); interval = null }
              store.updateVideoProgress(video.youtube_id!, watchedRef.current, video.duration_sec)
            }
          },
        },
      })
    })

    return () => {
      destroyed = true
      if (interval) clearInterval(interval)
      if (video.youtube_id && watchedRef.current > 0) {
        store.updateVideoProgress(video.youtube_id, watchedRef.current, video.duration_sec)
      }
      playerRef.current?.destroy?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.youtube_id])

  if (!roadmap) return <div className="page muted">불러오는 중…</div>
  if (!video) return <div className="page">영상을 찾을 수 없습니다. <Link to="/today">오늘의 과제로</Link></div>

  const watchedPct = Math.min(100, Math.round(((vp?.watchedSeconds ?? 0) / video.duration_sec) * 100))
  const block = roadmap.days[di].blocks[bi]
  const nextVideo = block.videos?.[vi + 1]

  return (
    <div className="page">
      <div className="lesson-head">
        <Link to="/today" className="muted">← 오늘의 과제</Link>
        <h1>{video.title}</h1>
        <div className="muted small">{video.course_title} › {video.unit} › {video.lesson}</div>
      </div>

      <div className="player-wrap card">
        <div ref={hostRef} />
        {!ready && <div className="muted small">플레이어 로딩 중…</div>}
      </div>

      <div className="lesson-status card">
        <div className="progressbar"><div style={{ width: `${watchedPct}%` }} /></div>
        <div className="lesson-status-row">
          <span>{completed ? '✅ 시청 완료' : `시청 ${watchedPct}% (90% 이상이면 완료)`}</span>
          {nextVideo
            ? <Link className="btn primary" to={`/lesson/${di}/${bi}/${vi + 1}`}>다음 영상 →</Link>
            : <Link className="btn primary" to="/today">과제로 돌아가기</Link>}
        </div>
      </div>

      <div className="card summary">
        <h3>요약</h3>
        <p className="muted">모국어 요약이 준비 중입니다. (다국어 해설 파이프라인 Phase 2)</p>
        <p className="muted small">출처: Khan Academy (CC BY-NC-SA) · <a href={video.youtube_url ?? '#'} target="_blank" rel="noreferrer">YouTube에서 보기</a></p>
      </div>
    </div>
  )
}
