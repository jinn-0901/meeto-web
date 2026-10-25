import { useState } from "react";
import { checkApiHealth } from "./lib/api";

export default function App() {
  const [apiState, setApiState] = useState({
    kind: "idle",
    message: "Server connection has not been checked yet.",
  });

  async function handleCheckServer() {
    setApiState({ kind: "loading", message: "Checking the Meeto server…" });
    try {
      const result = await checkApiHealth();
      setApiState({
        kind: "success",
        message: `Connected to ${result.service}. API status: ${result.status}.`,
      });
    } catch {
      setApiState({
        kind: "error",
        message: "Could not reach the server. Check that it is running and REACT_APP_API_BASE_URL is correct.",
      });
    }
  }

  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="/" aria-label="Meeto home">
          <span className="brand-mark" aria-hidden="true">m</span><span>meeto</span>
        </a>
        <a className="nav-link" href="https://github.com/jinn-0901/meeto-server">
          Developer resources <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> VIDEO MEETINGS, MADE SIMPLE</div>
          <h1>Good conversations<br /><span>have no timer.</span></h1>
          <p className="hero-description">A calmer place to meet, share ideas, and stay connected. No arbitrary free-meeting countdown hanging over your conversation.</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={() => document.getElementById("meeting-entry")?.focus()}>Get started <span aria-hidden="true">→</span></button>
            <a className="button button-secondary" href="#how-it-works">How it works</a>
          </div>
          <p className="quiet-note">Built for the browser. Designed around the people in the room.</p>
        </div>

        <div className="preview-wrap" aria-label="Illustration of a video meeting interface">
          <div className="preview-window">
            <div className="window-bar">
              <div className="window-dots"><i /><i /><i /></div><span>weekly-catch-up</span><span className="secure-label">● Private room</span>
            </div>
            <div className="meeting-grid">
              <div className="person-tile person-one"><div className="avatar avatar-one">J</div><span className="person-label">Jamie <small>Mic on</small></span></div>
              <div className="person-tile person-two"><div className="avatar avatar-two">A</div><span className="person-label">Alex <small>Mic on</small></span></div>
              <div className="person-tile person-three"><div className="avatar avatar-three">S</div><span className="person-label">Sam <small>Mic on</small></span></div>
              <div className="person-tile invite-tile"><span className="invite-plus">+</span><span>Room for one more</span></div>
            </div>
            <div className="call-controls" aria-hidden="true"><span className="control-pill">◖ Mic</span><span className="control-pill">▣ Camera</span><span className="control-pill control-end">↗ Leave</span></div>
          </div>
          <div className="floating-note"><span className="note-icon">∞</span><span><strong>Your time is yours.</strong><small>No arbitrary meeting timer.</small></span></div>
        </div>
      </section>

      <section className="feature-strip" id="how-it-works">
        <article><span className="feature-icon">↗</span><div><h2>Easy to join</h2><p>Meet from a browser, without a complicated setup.</p></div></article>
        <article><span className="feature-icon">◉</span><div><h2>People first</h2><p>Keep the focus on the conversation, not the controls.</p></div></article>
        <article><span className="feature-icon">∞</span><div><h2>No arbitrary timer</h2><p>A product goal built around uninterrupted conversations.</p></div></article>
      </section>

      <section className="server-check" aria-labelledby="server-check-title">
        <div>
          <p className="section-kicker">DEVELOPER PREVIEW</p>
          <h2 id="server-check-title">Check the server connection</h2>
          <p className="server-copy">This starter build includes a health check. Live video meetings are still under development.</p>
          <p className={`api-status api-status--${apiState.kind}`} role="status">{apiState.message}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={handleCheckServer} disabled={apiState.kind === "loading"}>{apiState.kind === "loading" ? "Checking…" : "Test connection"}</button>
      </section>

      <section className="join-panel" aria-labelledby="meeting-entry-title">
        <div><p className="section-kicker">COMING NEXT</p><h2 id="meeting-entry-title">Your next meeting starts here.</h2><p>Meeting creation, invite links, and real-time video will be added in upcoming development stages.</p></div>
        <label className="meeting-entry" id="meeting-entry"><span>Meeting link or code</span><input type="text" placeholder="Meeting links will be supported soon" disabled aria-label="Meeting link or code (coming soon)" /><button type="button" disabled title="Meeting joining is not implemented yet">Join meeting</button></label>
      </section>

      <footer className="footer">
        <a className="wordmark wordmark-footer" href="/"><span className="brand-mark" aria-hidden="true">m</span><span>meeto</span></a>
        <span>Meet without limits.</span><span>Early development preview</span>
      </footer>
    </main>
  );
}