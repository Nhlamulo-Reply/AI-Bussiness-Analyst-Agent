import {
  ArrowDown,
  ArrowRight,
  Bot,
  Brain,
  Check,
  Download,
  FileText,
  House,
  Info,
  Menu,
  Moon,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getInitialTheme,
  setThemePreference,
  type Theme,
} from "../features/theme/theme";
import "./LandingPage.css";

const navigation = [
  { label: "Home", href: "#home", icon: House },
  { label: "About", href: "#about" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Benefits", href: "#benefits" },
  { label: "Testimonials", href: "#testimonials" },
];

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Analysis",
    description: "Turn complex inputs into structured insights.",
  },
  {
    icon: FileText,
    title: "Traceable Requirements",
    description: "Keep full source traceability from input to output.",
  },
  {
    icon: UsersRound,
    title: "Collaborative Workflow",
    description: "Review, approve and manage with ease.",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Insights",
    description: "Track progress and measure impact.",
  },
  {
    icon: Download,
    title: "Flexible Export",
    description: "Download your results in Markdown, JSON or CSV.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Bring in context",
    description: "Upload business documents and keep their source in view.",
    icon: FileText,
  },
  {
    number: "02",
    title: "Analyse the problem",
    description: "Use AI to structure requirements, risks, and open questions.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Review together",
    description: "Collaborate on drafts and keep decisions with people.",
    icon: UsersRound,
  },
  {
    number: "04",
    title: "Share clear outcomes",
    description: "Export analysis and delivery artefacts for your team.",
    icon: Download,
  },
];

const benefits = [
  {
    title: "Secure & Reliable",
    description:
      "Keep project access role-aware and business decisions human-led.",
    icon: ShieldCheck,
  },
  {
    title: "Scalable Solution",
    description:
      "Move from source documents to structured work in one workspace.",
    icon: Zap,
  },
  {
    title: "Built for Collaboration",
    description:
      "Keep analysts, reviewers, and delivery teams connected to the work.",
    icon: UsersRound,
  },
];

const trustItems = [
  { label: "Secure & Reliable", icon: ShieldCheck },
  { label: "Scalable Solution", icon: Zap },
  { label: "Built for Collaboration", icon: UsersRound },
  { label: "Enterprise Ready", icon: Star },
];

export function LandingPage() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");

  const handleThemeToggle = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    setThemePreference(nextTheme);
  };

  const handleNavigation = (href: string) => {
    setActiveSection(href);
    setMenuOpen(false);
  };

  return (
    <div className="landing-ref">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>

      <header className="landing-ref__header">
        <div className="landing-ref__header-inner">
          <Link
            aria-label="AIVA — AI Virtual Analyst home"
            className="landing-ref__brand"
            to="/"
          >
            <img alt="" src="/aiva-logo.png" />
          </Link>

          <button
            aria-controls="landing-ref-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            className="landing-ref__menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? (
              <X aria-hidden="true" size={20} />
            ) : (
              <Menu aria-hidden="true" size={20} />
            )}
          </button>

          <nav
            aria-label="Main navigation"
            className={`landing-ref__nav${menuOpen ? " landing-ref__nav--open" : ""}`}
            id="landing-ref-navigation"
          >
            {navigation.map(({ href, icon: Icon, label }) => (
              <a
                aria-current={activeSection === href ? "location" : undefined}
                className={
                  activeSection === href
                    ? "landing-ref__nav-link landing-ref__nav-link--active"
                    : "landing-ref__nav-link"
                }
                href={href}
                key={label}
                onClick={(event) => {
                  event.preventDefault();
                  handleNavigation(href);
                }}
              >
                {Icon ? <Icon aria-hidden="true" size={14} /> : null}
                {label}
              </a>
            ))}
          </nav>

          <div className="landing-ref__actions">
            <button
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-pressed={theme === "dark"}
              className="landing-ref__theme-toggle"
              onClick={handleThemeToggle}
              type="button"
            >
              <span
                className={
                  theme === "light"
                    ? "landing-ref__theme-option landing-ref__theme-option--active"
                    : "landing-ref__theme-option"
                }
              >
                <Sun aria-hidden="true" size={17} />
              </span>
              <span
                className={
                  theme === "dark"
                    ? "landing-ref__theme-option landing-ref__theme-option--active"
                    : "landing-ref__theme-option"
                }
              >
                <Moon aria-hidden="true" size={17} />
              </span>
            </button>
            <Link className="landing-ref__get-started" to="/register">
              Get Started
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main
        className="landing-ref__main"
        data-screen={activeSection.slice(1)}
        id="landing-main"
      >
        <section
          aria-labelledby="landing-ref-title"
          className="landing-ref__hero"
          hidden={activeSection !== "#home"}
          id="home"
        >
          <div className="landing-ref__hero-inner">
            <div className="landing-ref__hero-copy">
              <p className="landing-ref__eyebrow">
                <Rocket aria-hidden="true" size={15} />
                The Future of Business Analysis
              </p>
              <h1 id="landing-ref-title">
                Welcome to <span>AIVA</span>
              </h1>
              <h2>Your AI Business Analyst Agent</h2>
              <p className="landing-ref__hero-description">
                Transform unstructured business problems into structured,
                traceable and actionable requirements — powered by AI.
              </p>
              <div className="landing-ref__hero-actions">
                <a
                  className="landing-ref__button landing-ref__button--primary"
                  href="#features"
                  onClick={(event) => {
                    event.preventDefault();
                    handleNavigation("#features");
                  }}
                >
                  <Play aria-hidden="true" fill="currentColor" size={15} />
                  Explore Features
                </a>
                <a
                  className="landing-ref__button landing-ref__button--outline"
                  href="#about"
                  onClick={(event) => {
                    event.preventDefault();
                    handleNavigation("#about");
                  }}
                >
                  <Info aria-hidden="true" size={16} />
                  Learn More
                </a>
              </div>
            </div>

            <LandingIllustration />
          </div>
        </section>

        <section
          aria-labelledby="landing-ref-features-title"
          className="landing-ref__features"
          hidden={activeSection !== "#home" && activeSection !== "#features"}
          id="features"
        >
          <div className="landing-ref__features-heading">
            <p>
              <span />
              Powerful Features
              <span />
            </p>
            <h2 id="landing-ref-features-title">
              Everything You Need for Smarter Business Analysis
            </h2>
          </div>
          <div className="landing-ref__feature-grid">
            {features.map(({ description, icon: Icon, title }) => (
              <article className="landing-ref__feature-card" key={title}>
                <Icon
                  aria-hidden="true"
                  className="landing-ref__feature-icon"
                  size={28}
                  strokeWidth={2.2}
                />
                <span className="landing-ref__feature-arrow">
                  <ArrowRight aria-hidden="true" size={16} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="landing-ref-testimonials-title"
          className="landing-ref__trust"
          hidden={
            activeSection !== "#home" && activeSection !== "#testimonials"
          }
          id="testimonials"
        >
          <h2 id="landing-ref-testimonials-title">
            Trusted by forward-thinking teams
          </h2>
          <div className="landing-ref__trust-items">
            {trustItems.map(({ icon: Icon, label }) => (
              <div className="landing-ref__trust-item" key={label}>
                <Icon aria-hidden="true" size={25} strokeWidth={1.8} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <a
            className="landing-ref__scroll-link"
            href="#about"
            onClick={(event) => {
              event.preventDefault();
              handleNavigation("#about");
            }}
          >
            <span>
              <ArrowDown aria-hidden="true" size={18} />
            </span>
            Explore About
          </a>
        </section>

        <section
          aria-labelledby="landing-ref-about-title"
          className="landing-ref__about landing-ref__section"
          hidden={activeSection !== "#about"}
          id="about"
        >
          <div className="landing-ref__section-heading">
            <p className="landing-ref__section-kicker">ABOUT AIVA</p>
            <h2 id="landing-ref-about-title">
              Business analysis, made clear and connected.
            </h2>
            <p>
              AIVA helps Business Analysts move from unstructured source
              material to traceable requirements, delivery artefacts, and
              stakeholder decisions.
            </p>
          </div>
          <div className="landing-ref__about-card">
            <span>
              <Bot aria-hidden="true" size={30} />
            </span>
            <div>
              <h3>AI support with people in control</h3>
              <p>
                Keep AI-generated analysis reviewable, preserve source context,
                and leave approvals to the right people.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="landing-ref-workflow-title"
          className="landing-ref__workflow landing-ref__section"
          hidden={activeSection !== "#how-it-works"}
          id="how-it-works"
        >
          <div className="landing-ref__section-heading">
            <p className="landing-ref__section-kicker">HOW IT WORKS</p>
            <h2 id="landing-ref-workflow-title">
              From source material to shared outcomes.
            </h2>
          </div>
          <ol className="landing-ref__workflow-grid">
            {workflow.map(({ description, icon: Icon, number, title }) => (
              <li className="landing-ref__workflow-card" key={number}>
                <span className="landing-ref__workflow-number">{number}</span>
                <Icon aria-hidden="true" size={23} />
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="landing-ref-benefits-title"
          className="landing-ref__benefits landing-ref__section"
          hidden={activeSection !== "#benefits"}
          id="benefits"
        >
          <div className="landing-ref__section-heading">
            <p className="landing-ref__section-kicker">BENEFITS</p>
            <h2 id="landing-ref-benefits-title">
              Everything stays connected to the work.
            </h2>
          </div>
          <div className="landing-ref__benefit-grid">
            {benefits.map(({ description, icon: Icon, title }) => (
              <article className="landing-ref__benefit-card" key={title}>
                <span>
                  <Icon aria-hidden="true" size={23} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="landing-ref__closing"
          hidden={activeSection === "#home"}
        >
          <h2>Ready to make business analysis clearer?</h2>
          <Link className="landing-ref__get-started" to="/register">
            Get Started
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      </main>

      <footer
        className="landing-ref__footer"
        hidden={activeSection === "#home"}
      >
        <Link aria-label="AIVA — AI Virtual Analyst home" to="/">
          <img alt="" src="/aiva-logo.png" />
        </Link>
        <p>AI Virtual Analyst · AI Business Analyst Agent</p>
        <Link to="/login">Sign in</Link>
      </footer>
    </div>
  );
}

function LandingIllustration() {
  return (
    <div aria-hidden="true" className="landing-ref__art">
      <div className="landing-ref__art-glow" />
      <div className="landing-ref__art-ring landing-ref__art-ring--one" />
      <div className="landing-ref__art-ring landing-ref__art-ring--two" />

      <div className="landing-ref__requirements-panel">
        {["Requirements", "User Stories", "Risk Analysis", "Roadmap"].map(
          (item) => (
            <span key={item}>
              <i>
                <Check size={12} strokeWidth={3} />
              </i>
              {item}
            </span>
          ),
        )}
      </div>

      <div className="landing-ref__analysis-panel">
        <Brain aria-hidden="true" size={54} strokeWidth={1.4} />
        <strong>Analyze</strong>
        <span>· Plan · Deliver</span>
      </div>

      <div className="landing-ref__chart-panel">
        <TrendingUp aria-hidden="true" size={49} />
        <div>
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      <div className="landing-ref__robot">
        <span className="landing-ref__robot-antenna" />
        <span className="landing-ref__robot-ear landing-ref__robot-ear--left" />
        <span className="landing-ref__robot-ear landing-ref__robot-ear--right" />
        <span className="landing-ref__robot-head">
          <i />
          <i />
          <b />
        </span>
        <span className="landing-ref__robot-neck" />
        <span className="landing-ref__robot-body">
          <strong>AIVA</strong>
          <small>AI ANALYST</small>
        </span>
        <span className="landing-ref__robot-arm landing-ref__robot-arm--left" />
        <span className="landing-ref__robot-arm landing-ref__robot-arm--right" />
        <span className="landing-ref__robot-hand" />
      </div>

      <div className="landing-ref__decision-panel">
        <Check aria-hidden="true" size={19} />
        <span>
          <strong>Smarter Analysis.</strong>
          <strong>Better Decisions.</strong>
        </span>
      </div>

      <div className="landing-ref__orbit-floor" />
    </div>
  );
}
