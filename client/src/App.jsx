import { useEffect, useState } from "react";
import { api } from "./api.js";
import CurveChart from "./CurveChart.jsx";

// Plain-language copy for each verdict: the UI explains, it doesn't just show numbers.
const VERDICTS = {
  "high-bias": {
    title: "High bias: the model is underfitting",
    color: "var(--amber)",
    text: "It scores poorly even on data it has seen. The model is too simple for this problem.",
  },
  "high-variance": {
    title: "High variance: the model is overfitting",
    color: "var(--coral)",
    text: "It memorizes the training data but fails on new data. Note the wide gap between the curves.",
  },
  "good-fit": {
    title: "Healthy fit",
    color: "var(--teal)",
    text: "Training and dev scores are high and close together. Focus on fine-tuning.",
  },
};

export default function App() {
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

  // Polling: ask the API for status every 1.5s until the job finishes. (alt: WebSockets / Server-Sent Events: push instead of pull)
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
    return () => clearInterval(t); // cleanup stops the timer when status changes or the component unmounts
  }, [dx?._id, dx?.status]);

  const onUpload = async (e) => {
    setError("");
    try {
      const ds = await api.upload(e.target.files[0]);
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
  const v = dx?.status === "done" ? VERDICTS[dx.result.verdict] : null;

  return (
    <>
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 64 24" width="44" aria-hidden="true">
            <polyline
              points="0,12 14,12 20,3 28,21 34,12 64,12"
              className="pulse"
            />
          </svg>
          <strong>Model Doctor</strong>
        </div>
        <span className="tag">
          Phase 1: mock diagnosis (real ML arrives in Phase 3)
        </span>
      </header>

      <section className="hero">
        <h1>Find out why your model is failing, and what to try next.</h1>
        <p>
          Upload a CSV, choose what to predict, and get a diagnosis of bias or
          variance with concrete fixes.
        </p>
      </section>

      <main className="grid">
        <div className="col">
          <div className="card">
            <h2>1. Upload a dataset</h2>
            <label className="drop">
              <input type="file" accept=".csv" onChange={onUpload} hidden />
              Choose a CSV file (max 10 MB)
            </label>
          </div>

          <div className="card">
            <h2>2. Choose what to predict</h2>
            {!datasets.length && (
              <p className="muted">No datasets yet. Upload one to begin.</p>
            )}
            <select
              value={dsId}
              onChange={(e) => {
                setDsId(e.target.value);
                setTarget("");
              }}
              disabled={!datasets.length}
            >
              <option value="">Select dataset</option>
              {datasets.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.rows} rows)
                </option>
              ))}
            </select>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!selected}
            >
              <option value="">Select target column</option>
              {selected?.columns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="card">
            <h2>3. Run the diagnosis</h2>
            <button onClick={run} disabled={!dsId || !target || busy}>
              {busy ? "Diagnosing…" : "Run diagnosis"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="col">
          <div className="monitor">
            <div className="monitor-head">
              <span>Learning curves</span>
              <span className="legend">
                <i className="k train" />
                Train <i className="k dev" />
                Dev
              </span>
            </div>
            {!dx && (
              <p className="empty">
                Your learning curves will appear here. Pick a dataset and run a
                diagnosis.
              </p>
            )}
            {busy && (
              <p className="empty beat">
                Training models on 10% to 100% of your data…
              </p>
            )}
            {dx?.status === "failed" && (
              <p className="empty">
                The diagnosis failed. Try again or check your dataset.
              </p>
            )}
            {v && <CurveChart curve={dx.result.curve} />}
          </div>

          {v && (
            <div className="card verdict" style={{ borderLeftColor: v.color }}>
              <h2 style={{ color: v.color }}>{v.title}</h2>
              <p>{v.text}</p>
              <h3>What to try next</h3>
              <ul>
                {dx.result.fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
