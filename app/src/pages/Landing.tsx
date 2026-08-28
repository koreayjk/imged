import { Link } from 'react-router-dom'
import { useAppState } from '../lib/useStore'
import { useT, setUiLang } from '../lib/i18n'

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

  return (
    <div className="lp">
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
        <div className="lp-tagline">{t.lpTagline}</div>
        <h1>{t.lpTitle1}<br />{t.lpTitle2}</h1>
        <p className="lp-sub">{t.lpSub}</p>
        <Link className="btn primary lp-cta" to={cta.to}>{cta.label}</Link>

        <div className="lp-mock card">
          <div className="lp-mock-bar">
            <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
          </div>
          <div className="lp-mock-row active">▶️ {t.warmupTitle} <span className="badge">{t.minutes(5)}</span></div>
          <div className="lp-mock-row">🔒 {t.math}{t.studySuffix} <span className="badge">{t.minutes(35)}</span></div>
          <div className="lp-mock-row">🔒 {t.english}{t.studySuffix} <span className="badge">{t.minutes(20)}</span></div>
          <div className="lp-mock-row">🔒 {t.checkinTitle} <span className="badge">{t.minutes(5)}</span></div>
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
        <h2>{t.lpFeatTitle}</h2>
        <div className="lp-grid">
          {features.map(([title, desc]) => (
            <div key={title} className="card lp-feature">
              <h3>{title}</h3>
              <p className="muted">{desc}</p>
            </div>
          ))}
        </div>
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
        <blockquote className="lp-quote">{t.lpQuote}</blockquote>
        <Link className="btn primary lp-cta" to={cta.to}>{cta.label}</Link>
      </section>

      <footer className="lp-foot muted small">{t.lpFootNote}</footer>
    </div>
  )
}
