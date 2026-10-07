import { useEffect, useState } from "react";
import { api, session } from "./api.js";
import Auth from "./Auth.jsx";
import Dashboard from "./Dashboard.jsx";
import "./auth.css";

// App is now only the "gatekeeper": who is signed in decides which screen renders.
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!session.get()); // if a token is saved, verify it before showing anything

  useEffect(() => {
    if (!session.get()) return;
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => session.clear())
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    // api.js fires this event when the server says our token is no longer valid
    const out = () => setUser(null);
    window.addEventListener("auth-expired", out);
    return () => window.removeEventListener("auth-expired", out);
  }, []);

  const signOut = () => {
    session.clear();
    setUser(null);
  }; // JWTs are stateless: "logout" = the client forgets the token

  if (checking) return <p className="boot">Loading…</p>;
  if (!user)
    return (
      <Auth
        onAuth={({ token, user }) => {
          session.set(token);
          setUser(user);
        }}
      />
    );
  return <Dashboard user={user} onSignOut={signOut} />;
}
