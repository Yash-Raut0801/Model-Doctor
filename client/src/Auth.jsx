import { useState } from "react";
import { api } from "./api.js";

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // controlled inputs: React state is the single source of truth
  const isLogin = mode === "login";

  const submit = async (e) => {
    e.preventDefault(); // stop the browser's default full-page form submit
    setError("");
    setBusy(true);
    try {
      onAuth(await (isLogin ? api.login(f) : api.register(f)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">Model Doctor</span>
        <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">
          {isLogin
            ? "Sign in to see your datasets and diagnoses."
            : "Your datasets stay private to your account."}
        </p>
        {!isLogin && (
          <label className="lbl">
            Name
            <input
              className="field"
              value={f.name}
              onChange={set("name")}
              autoComplete="name"
              required
            />
          </label>
        )}
        <label className="lbl">
          Email
          <input
            className="field"
            type="email"
            value={f.email}
            onChange={set("email")}
            autoComplete="email"
            required
          />
        </label>
        <label className="lbl">
          Password
          <input
            className="field"
            type="password"
            value={f.password}
            onChange={set("password")}
            minLength={isLogin ? 1 : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />
          {!isLogin && <small>At least 8 characters</small>}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="cta" disabled={busy}>
          {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            setError("");
          }}
        >
          {isLogin
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
