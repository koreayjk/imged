import { Link } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { useT, setUiLang } from '../lib/i18n'
import imgStudy from '../assets/lp/study-group.jpg'
import imgGrad from '../assets/lp/graduation.jpg'
import imgLiberty from '../assets/lp/liberty.jpg'
import imgBooks from '../assets/lp/books-bg.jpg'

const FEATURE_ICONS = ['📅', '🎯', '🎬', '✍️', '🌏', '📊']
const FEATURE_TONES = ['blue', 'purple', 'orange', 'green', 'teal', 'pink']

export default function Landing() {
  const { t, lang } = useT()
  const { profile } = useAppState()

  const cta = profile
    ? { to: profile.role === 'admin' ? '/admin' : '/today', label: t.lpCtaContinue }
    : { to: '/login', label: t.lpCta }

  const features = [
    [t.lpF1t, t.lpF1d], [t.lpF2t, t.lpF2d], [t.lpF3t, t.lpF3d],
    [t.lpF4t, t.lpF4d], [t.lpF5t, t.lpF5d], [t.lpF6t, t.lpF6d],
  ]
  const stats = [
    [t.lpStat1n, t.lpStat1], [t.lpStat2n, t.lpStat2],
    [t.lpStat3n, t.lpStat3], [t.lpStat4n, t.lpStat4],
  ]
  const steps = [
    [t.lpH1t, t.lpH1d], [t.lpH2t, t.lpH2d], [t.lpH3t, t.lpH3d],
  ]
  const subjects: [string, string][] = [
    [t.math, 'blue'], [t.english, 'purple'], [t.science, 'green'], [t.social, 'orange'],
  ]

  return (
    <div className="lp">
      <div className="lp-glow lp-glow-a" />
      <div className="lp-glow lp-glow-b" />

      <header className="lp-nav">
        <div className="brand">🎓 {t.appName}</div>
        <div className="lp-nav-right">
          <button className="ghost small" onClick={() => setUiLang(lang === 'ko' ? 'en' : 'ko')}>
            {t.langToggle}
          </button>
          <Link className="btn ghost" to="/login">{t.lpCtaLogin}</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-tagline lp-fade" style={{ animationDelay: '0ms' }}>🇹🇭 {t.lpTagline}</div>
        <h1 className="lp-fade" style={{ animationDelay: '80ms' }}>
          {t.lpTitle1}<br /><span className="lp-grad">{t.lpTitle2}</span>
        </h1>
        <p className="lp-sub lp-fade" style={{ animationDelay: '160ms' }}>{t.lpSub}</p>
        <div className="lp-fade" style={{ animationDelay: '240ms' }}>
          <Link className="btn primary lp-cta" to={cta.to}>{cta.label} →</Link>
          <div className="lp-badges">
            <span>{t.lpBadge1}</span><span>{t.lpBadge2}</span><span>{t.lpBadge3}</span>
          </div>
        </div>

        <div className="lp-mock-wrap lp-fade" style={{ animationDelay: '320ms' }}>
          <figure className="lp-polaroid lp-pol-1">
            <img src={imgStudy} alt="" loading="lazy" />
            <figcaption>{t.lpPh1}</figcaption>
          </figure>
          <figure className="lp-polaroid lp-pol-2">
            <img src={imgGrad} alt="" loading="lazy" />
            <figcaption>{t.lpPh2}</figcaption>
          </figure>
          <figure className="lp-polaroid lp-pol-3">
            <img src={imgLiberty} alt="" loading="lazy" />
            <figcaption>{t.lpPh3}</figcaption>
          </figure>
          <div className="lp-mock">
            <div className="lp-mock-bar">
              <span className="lp-dot r" /><span className="lp-dot y" /><span className="lp-dot g" />
              <span className="lp-mock-title">{t.navToday}</span>
            </div>
            <div className="lp-mock-progress"><div /></div>
            <div className="lp-mock-row done">✅ {t.warmupTitle} <span className="badge">{t.minutes(5)}</span></div>
            <div className="lp-mock-row active">▶️ {t.math}{t.studySuffix} <span className="badge on">{t.minutes(35)}</span></div>
            <div className="lp-mock-row">🔒 {t.english}{t.studySuffix} <span className="badge">{t.minutes(20)}</span></div>
            <div className="lp-mock-row">🔒 {t.checkinTitle} <span className="badge">{t.minutes(5)}</span></div>
          </div>
        </div>
      </section>

      <section className="lp-stats">
        {stats.map(([n, label]) => (
          <div key={label} className="lp-stat">
            <div className="lp-stat-n">{n}</div>
            <div className="muted">{label}</div>
          </div>
        ))}
      </section>

      <section className="lp-section">
        <div className="lp-kicker">{t.appName}</div>
        <h2>{t.lpFeatTitle}</h2>
        <div className="lp-grid">
          {features.map(([title, desc], i) => (
            <div key={title} className={`card lp-feature tone-${FEATURE_TONES[i]}`}>
              <div className="lp-feature-icon">{FEATURE_ICONS[i]}</div>
              <h3>{title.replace(/^\S+\s/, '')}</h3>
              <p className="muted">{desc}</p>
            </div>
          ))}
        </div>
        <div className="lp-subjects">
          {subjects.map(([label, tone]) => (
            <span key={label} className={`lp-pill tone-${tone}`}>{label}</span>
          ))}
        </div>
      </section>

      <section className="lp-banner" style={{ backgroundImage: `url(${imgBooks})` }}>
        <blockquote className="lp-quote"><span className="lp-qmark">“</span>{t.lpQuote.replace(/^"|"$/g, '')}</blockquote>
      </section>

      <section className="lp-section lp-how">
        <h2>{t.lpHowTitle}</h2>
        <div className="lp-steps">
          {steps.map(([title, desc], i) => (
            <div key={title} className="lp-step">
              <div className="lp-step-n">{i + 1}</div>
              <h3>{title}</h3>
              <p className="muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-band" style={{ backgroundImage: `url(${imgGrad})` }}>
        <div className="lp-band-inner">
          <h2>{t.lpBandTitle}</h2>
          <p>{t.lpBandSub}</p>
          <Link className="btn lp-band-cta" to={cta.to}>{cta.label} →</Link>
        </div>
      </section>

      <footer className="lp-foot muted small">{t.lpFootNote} · Photos: Unsplash</footer>
    </div>
  )
}
