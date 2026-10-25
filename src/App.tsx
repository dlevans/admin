import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import History from "./pages/History";
import Login from "./pages/Login";
import Notifications from "./pages/Notifications";
import Texts from "./pages/Texts";
import Volunteers from "./pages/Volunteers";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/notifications", label: "Push notifications" },
  { to: "/texts", label: "Text messages" },
  { to: "/events", label: "Events" },
  { to: "/volunteers", label: "Volunteers" },
  { to: "/history", label: "History" },
];

export default function App() {
  const { user, checking, logout } = useAuth();

  if (checking) return <div className="center muted">Loading…</div>;
  if (!user) return <Login />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src="./vkc_logo.png" alt="" className="logo" />
          <span>VolunteerKC Admin</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="who">
          <span className="muted">{user.name}</span>
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/texts" element={<Texts />} />
          <Route path="/events" element={<Events />} />
          <Route path="/volunteers" element={<Volunteers />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
