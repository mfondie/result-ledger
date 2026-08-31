import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { fetchOwnProfile, signOut } from "./lib/api";
import LoginScreen from "./components/LoginScreen.jsx";
import Workspace from "./components/Workspace.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    fetchOwnProfile(session.user.id)
      .then(setProfile)
      .catch((e) => setProfileError(e.message || String(e)));
  }, [session]);

  if (session === undefined) {
    return (
      <div className="centered">
        <div className="help-text">Loading\u2026</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (profileError) {
    return (
      <div className="centered">
        <div className="card">
          <h1 className="page-title">Couldn't load your profile</h1>
          <p className="error-text">{profileError}</p>
          <p className="help-text">
            Your account may not have a matching row in the <code>profiles</code> table yet — ask
            your superadmin to check.
          </p>
          <button className="secondary" onClick={() => signOut()}>Log out</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="centered">
        <div className="help-text">Loading your profile\u2026</div>
      </div>
    );
  }

  return <Workspace profile={profile} onSignOut={signOut} />;
}
