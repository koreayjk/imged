import { Link } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { useT, setUiLang } from '../lib/i18n'
import imgHero from '../assets/lp/hero-bg.jpg'
import imgBooks from '../assets/lp/books-bg.jpg'
import imgLibertyBg from '../assets/lp/liberty-bg.jpg'

/** 실제 설계 값 (config/durations.json + data/syllabus/*_basic.json 산출) */
const PLANS = [
  { key: '6m', weeks: 32, days: 160, topics: 335, daily: 100, scope: 'lpScope6m' },
  { key: '1y', weeks: 52, days: 260, topics: 449, daily: 65, scope: 'lpScope1y' },
  { key: '2y', weeks: 104, days: 520, topics: 620, daily: 45, scope: 'lpScope2y' },
  { key: '3y', weeks: 156, days: 780, topics: 816, daily: 35, scope: 'lpScope3y' },
] as const

export default function Landing() {
  const { t, lang } = useT()
  const { profile } = useAppState()

  const cta = profile
    ? { to: profile.role === 'admin' ? '/admin' : '/today', label: t.lpCtaContinue }
    : { to: '/login', label: t.lpCta }

  const features = [
    [t.lpF1t, t.lpF1d], [t.lpF2t, t.lpF2d], [t.lpF3t, t.lpF3d],
    [t.lpF4t, t.lpF4d], [t.lpF5t, t.lpF5d], [t.lpF6t, t.lpF6d],
    [t.lpF7t, t.lpF7d], [t.lpF8t, t.lpF8d], [t.lpF9t, t.lpF9d],
  ]
  const steps = [
    [t.lpH1t, t.lpH1d], [t.lpH2t, t.lpH2d], [t.lpH3t, t.lpH3d],
  ]
  const durLabel: Record<string, string> = {
    '6m': lang === 'ko' ? '속성' : 'Fast track',
    '1y': lang === 'ko' ? '1년' : '1 year',
    '2y': lang === 'ko' ? '2년' : '2 years',
    '3y': lang === 'ko' ? '3년' : '3 years',
  }

  return (
    <div className="lp">
      {/* ───────────────────────── 히어로 */}
      <section className="lp-hero">
        <div className="lp-hero-photo" style={{ backgroundImage: `url(${imgHero})` }} aria-hidden="true" />
        <div className="lp-hero-veil" aria-hidden="true" />

        <header className="lp-nav">
          <div className="lp-brand">
            <span className="lp-brand-mark" aria-hidden="true" />
            {t.appName}
          </div>
          <div className="lp-nav-right">
            <button className="lp-navbtn" onClick={() => setUiLang(lang === 'ko' ? 'en' : 'ko')}>
              {t.langToggle}
            </button>
            <Link className="lp-navbtn solid" to="/login">{t.lpCtaLogin}</Link>
          </div>
        </header>

        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <p className="lp-eyebrow lp-fade" style={{ animationDelay: '40ms' }}>{t.lpTagline}</p>
            <h1 className="lp-fade" style={{ animationDelay: '120ms' }}>
              {t.lpTitle1}<br /><em>{t.lpTitle2}</em>
            </h1>
            <p className="lp-sub lp-fade" style={{ animationDelay: '200ms' }}>{t.lpSub}</p>
            <div className="lp-hero-actions lp-fade" style={{ animationDelay: '280ms' }}>
              <Link className="lp-btn" to={cta.to}>{cta.label}</Link>
              <ul className="lp-badges">
                <li>{t.lpBadge1}</li><li>{t.lpBadge2}</li><li>{t.lpBadge3}</li>
              </ul>
            </div>
          </div>

          {/* 오늘의 계획표 전표 */}
          <div className="lp-slip lp-fade" style={{ animationDelay: '380ms' }}>
            <div className="lp-slip-head">
              <span className="lp-slip-title">{t.lpSlipTitle}</span>
              <span className="lp-slip-day">042<span>/260</span></span>
            </div>
            <ol className="lp-slip-rows">
              <li className="done">
                <span className="lp-slip-state">{t.lpSlipDone}</span>
                <span className="lp-slip-name">{t.warmupTitle}</span>
                <span className="lp-slip-min">5</span>
              </li>
              <li className="now">
                <span className="lp-slip-state">{t.lpSlipNow}</span>
                <span className="lp-slip-name">{t.math}{t.studySuffix}</span>
                <span className="lp-slip-min">35</span>
              </li>
              <li>
                <span className="lp-slip-state">{t.lpSlipLock}</span>
                <span className="lp-slip-name">{t.english}{t.studySuffix}</span>
                <span className="lp-slip-min">20</span>
              </li>
              <li>
                <span className="lp-slip-state">{t.lpSlipLock}</span>
                <span className="lp-slip-name">{t.checkinTitle}</span>
                <span className="lp-slip-min">5</span>
              </li>
            </ol>
            <div className="lp-slip-foot">
              <span className="lp-slip-bar"><i style={{ width: '28%' }} /></span>
              <span className="lp-slip-pct">28%</span>
            </div>
          </div>
        </div>

        <dl className="lp-figures">
          <div><dt>3,145</dt><dd>{t.lpStat1}</dd></div>
          <div><dt>4</dt><dd>{t.lpStat2}</dd></div>
          <div><dt>24</dt><dd>{t.lpStat3}</dd></div>
          <div><dt>4</dt><dd>{t.lpStat4}</dd></div>
        </dl>
      </section>

      {/* ───────────────────────── 기간 설계 (핵심 콘텐츠) */}
      <section className="lp-section lp-plan">
        <div className="lp-head">
          <p className="lp-kicker">{t.lpKick2}</p>
          <h2>{t.lpPlanTitle}</h2>
          <p className="lp-lede">{t.lpPlanSub}</p>
        </div>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th scope="col">{t.lpColDur}</th>
                <th scope="col" className="num">{t.lpColWeeks}</th>
                <th scope="col" className="num">{t.lpColDays}</th>
                <th scope="col" className="num">{t.lpColTopics}</th>
                <th scope="col" className="num">{t.lpColDaily}</th>
                <th scope="col">{t.lpColScope}</th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map(p => (
                <tr key={p.key}>
                  <th scope="row">{durLabel[p.key]}</th>
                  <td className="num">{p.weeks}<span>{t.lpDurUnitW}</span></td>
                  <td className="num">{p.days}<span>{t.lpDurUnitD}</span></td>
                  <td className="num">{p.topics}<span>{t.lpDurUnitV}</span></td>
                  <td className="num">{p.daily}<span>{t.lpDurUnitM}</span></td>
                  <td className="scope">
                    <span className="lp-meter" aria-hidden="true">
                      <i style={{ width: `${Math.round((p.topics / 816) * 100)}%` }} />
                    </span>
                    {t[p.scope]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lp-note">{t.lpPlanFoot}</p>

        <div className="lp-styles">
          <div className="lp-head lp-styles-head">
            <h3>{t.lpStyleTitle}</h3>
            <p className="lp-lede">{t.lpStyleSub}</p>
          </div>
          <div className="lp-style-pair">
            <article className="lp-style focus">
              <h4>{t.lpStyleFocusT}</h4>
              <p>{t.lpStyleFocusD}</p>
              <span className="lp-style-week">{t.lpStyleFocusW}</span>
            </article>
            <article className="lp-style parallel">
              <h4>{t.lpStyleParT}</h4>
              <p>{t.lpStyleParD}</p>
              <span className="lp-style-week">{t.lpStyleParW}</span>
            </article>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 인용 배너 */}
      <section className="lp-banner" style={{ backgroundImage: `url(${imgBooks})` }}>
        <blockquote className="lp-quote">{t.lpQuote.replace(/^"|"$/g, '')}</blockquote>
      </section>

      {/* ───────────────────────── 기능 */}
      <section className="lp-section lp-feats">
        <div className="lp-head">
          <p className="lp-kicker">{t.lpKick1}</p>
          <h2>{t.lpFeatTitle}</h2>
        </div>
        <div className="lp-grid">
          {features.map(([title, desc], i) => (
            <article key={title} className="lp-feature">
              <span className="lp-feature-n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <ul className="lp-subjects">
          <li>{t.math}</li><li>{t.english}</li><li>{t.science}</li><li>{t.social}</li>
        </ul>
      </section>

      {/* ───────────────────────── 시작 3단계 (노선도) */}
      <section className="lp-section lp-how">
        <div className="lp-head">
          <p className="lp-kicker">{t.lpKick3}</p>
          <h2>{t.lpHowTitle}</h2>
        </div>
        <ol className="lp-route">
          {steps.map(([title, desc], i) => (
            <li key={title}>
              <span className="lp-route-n">{i + 1}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────────────────────── 마무리 CTA */}
      <section className="lp-band">
        <div className="lp-band-photo" style={{ backgroundImage: `url(${imgLibertyBg})` }} aria-hidden="true" />
        <div className="lp-band-inner">
          <h2>{t.lpBandTitle}</h2>
          <p>{t.lpBandSub}</p>
          <Link className="lp-btn light" to={cta.to}>{cta.label}</Link>
        </div>
      </section>

      <footer className="lp-foot">{t.lpFootNote} · Photos: Unsplash</footer>
    </div>
  )
}
