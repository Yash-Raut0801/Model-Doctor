import { useEffect, useState } from "react";
import { api } from "./api.js";
import CurveChart from "./CurveChart.jsx";

// Plain-language copy per verdict: the UI explains, it doesn't just show numbers.
const VERDICTS = {
  "high-bias": {
    label: "High bias",
    title: "Your model is underfitting",
    tone: "amber",
    text: "It scores poorly even on data it has already seen, so the model is too simple for this problem.",
  },
  "high-variance": {
    label: "High variance",
    title: "Your model is overfitting",
    tone: "coral",
    text: "It memorizes the training data but fails on new data. Note the wide gap between the curves.",
  },
  "good-fit": {
    label: "Healthy fit",
    title: "Your model generalizes well",
    tone: "teal",
    text: "Training and dev scores are high and close together. Focus on fine-tuning.",
  },
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// The heartbeat line: one faint full line + one bright segment that travels along it (CSS animation).
const Pulse = ({ className = "" }) => (
  <svg viewBox="0 0 400 60" className={`pulse ${className}`} aria-hidden="true">
    <path
      d="M0 30 H120 L140 8 L165 52 L185 30 H400"
      pathLength="100"
      className="p-base"
    />
    <path
      d="M0 30 H120 L140 8 L165 52 L185 30 H400"
      pathLength="100"
      className="p-glow"
    />
  </svg>
);

function Step({ n, title, done, children }) {
  return (
    <section className={`step ${done ? "done" : ""}`}>
      <div className="step-head">
        <span className="num">{done ? "✓" : n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function Dashboard({ user, onSignOut }) {
  const [datasets, setDatasets] = useState([]);
  const [dsId, setDsId] = useState("");
  const [target, setTarget] = useState("");
  const [dx, setDx] = useState(null);
  const [error, setError] = useState("");

  const refresh = () =>
    api
      .datasets()
      .then(setDatasets)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []); // [] = run once on mount

  // Polling: ask for status every 1.5s until the job ends. (alt: WebSockets / Server-Sent Events)
  useEffect(() => {
    if (!dx || ["done", "failed"].includes(dx.status)) return;
    const t = setInterval(
      () =>
        api
          .getDiagnosis(dx._id)
          .then(setDx)
          .catch((e) => setError(e.message)),
      1500,
    );
    return () => clearInterval(t); // cleanup stops the timer on status change or unmount
  }, [dx?._id, dx?.status]);

  const onUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    try {
      const ds = await api.upload(file);
      await refresh();
      setDsId(ds._id);
      setTarget("");
    } catch (err) {
      setError(err.message);
    }
  };
  const run = async () => {
    setError("");
    setDx(null);
    try {
      setDx(await api.diagnose(dsId, target));
    } catch (err) {
      setError(err.message);
    }
  };

  const selected = datasets.find((d) => d._id === dsId);
  const busy = dx && ["queued", "running"].includes(dx.status);
  const done = dx?.status === "done";
  const v = done ? VERDICTS[dx.result.verdict] : null;
  const last = done ? dx.result.curve.at(-1) : null;

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo">
            <Pulse />
          </span>
          <strong>Model Doctor</strong>
        </div>
        <div className="who">
          <span>{user.name}</span>
          <button className="ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="hero">
        <span className="eyebrow">ML diagnostics · bias vs variance</span>
        <h1>
          Find out <span className="grad">why your model fails</span> and
          exactly what to try next.
        </h1>
        <p>
          Upload a CSV, choose what to predict, and get a learning-curve
          diagnosis with concrete, prioritized fixes.
        </p>
        <div className="feats">
          <span>Learning curves</span>
          <span>Bias / variance verdict</span>
          <span>Actionable fixes</span>
        </div>
      </section>

      <main className="grid">
        <div className="col">
          <Step n="1" title="Upload a dataset" done={!!selected}>
            <label className="drop">
              <input type="file" accept=".csv" onChange={onUpload} hidden />
              <strong>{selected ? selected.name : "Choose a CSV file"}</strong>
              <span>
                {selected
                  ? `${selected.rows.toLocaleString()} rows · ${selected.columns.length} columns`
                  : "Max 10 MB · header row required"}
              </span>
            </label>
          </Step>

          <Step n="2" title="Choose what to predict" done={!!target}>
            <select
              aria-label="Dataset"
              value={dsId}
              onChange={(e) => {
                setDsId(e.target.value);
                setTarget("");
              }}
              disabled={!datasets.length}
            >
              <option value="">
                {datasets.length ? "Select dataset" : "No datasets yet"}
              </option>
              {datasets.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Target column"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!selected}
            >
              <option value="">Select target column</option>
              {selected?.columns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Step>

          <Step n="3" title="Run the diagnosis" done={done}>
            <button
              className="cta"
              onClick={run}
              disabled={!dsId || !target || busy}
            >
              {busy ? "Diagnosing…" : "Run diagnosis"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </Step>
        </div>

        <div className="col">
          <div className="monitor">
            <div className="monitor-head">
              <span>Learning curves</span>
              <span className="legend">
                <i className="k train" />
                Train
                <i className="k dev" />
                Dev
              </span>
            </div>
            {!dx && (
              <div className="empty">
                <Pulse className="big" />
                <p>
                  Your learning curves will appear here.
                  <br />
                  Pick a dataset and run a diagnosis.
                </p>
              </div>
            )}
            {busy && (
              <div className="empty">
                <Pulse className="big" />
                <p className="beat">
                  Training models on 10% to 100% of your data…
                </p>
              </div>
            )}
            {dx?.status === "failed" && (
              <div className="empty">
                <p>The diagnosis failed. Try again or check your dataset.</p>
              </div>
            )}
            {done && <CurveChart curve={dx.result.curve} />}
          </div>

          {done && (
            <>
              <div className="tiles">
                <div className="tile">
                  <span>Train score</span>
                  <b className="t-teal">{pct(last.train)}</b>
                </div>
                <div className="tile">
                  <span>Dev score</span>
                  <b className="t-coral">{pct(last.dev)}</b>
                </div>
                <div className="tile">
                  <span>Gap</span>
                  <b className={`t-${v.tone}`}>{pct(last.train - last.dev)}</b>
                </div>
              </div>
              <div className={`verdict tone-${v.tone}`}>
                <span className="badge">{v.label}</span>
                <h2>{v.title}</h2>
                <p>{v.text}</p>
                <h3>What to try next</h3>
                <ol>
                  {dx.result.fixes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="foot">
        Built with MongoDB · Express · React · Node. Python worker, Redis and
        Docker arrive in Phase 3.
      </footer>
    </>
  );
}
