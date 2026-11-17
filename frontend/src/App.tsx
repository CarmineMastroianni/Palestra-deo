import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icon, ToastProvider } from './components/ui';
import { LockScreen } from './components/LockScreen';
import { useSettings } from './lib/settings';
import Home from './pages/Home';
import WorkoutHub from './pages/WorkoutHub';
import ReadinessCheck from './pages/ReadinessCheck';
import LiveWorkout from './pages/LiveWorkout';
import SessionDetail from './pages/SessionDetail';
import ExerciseDetail from './pages/ExerciseDetail';
import Progress from './pages/Progress';
import Body from './pages/Body';
import Nutrition from './pages/Nutrition';
import Profile from './pages/Profile';
import Assistant from './pages/Assistant';
import Onboarding from './pages/Onboarding';
import SettingsRoutes from './pages/settings/SettingsRoutes';

const Avatar = lazy(() => import('./pages/Avatar'));

function BottomNav() {
  const items = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/allenamento', label: 'Allenamento', icon: 'dumbbell' },
    { to: '/progressi', label: 'Progressi', icon: 'chart' },
    { to: '/alimentazione', label: 'Alimentazione', icon: 'food' },
    { to: '/profilo', label: 'Profilo', icon: 'user' }
  ];
  return (
    <nav className="bottom" aria-label="Navigazione principale">
      <div className="inner">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={i.icon} />
            <span>{i.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if (!offlineReady) return;
    const t = window.setTimeout(() => setOfflineReady(false), 4000);
    return () => window.clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  if (offlineReady) return <div className="toast">App pronta per l'uso offline ✓</div>;
  if (!needRefresh) return null;
  return (
    <div className="toast interactive row" style={{ gap: 10 }}>
      <span>Nuova versione disponibile</span>
      <button className="btn sm primary" onClick={() => updateServiceWorker(true)}>Aggiorna</button>
      <button className="btn sm ghost" onClick={() => setNeedRefresh(false)}>Dopo</button>
    </div>
  );
}

export default function App() {
  const settings = useSettings();
  const loc = useLocation();
  const [locked, setLocked] = useState(true);
  const hideNav = loc.pathname.startsWith('/allenamento/live');

  // blocco automatico dopo inattività / app in background
  useEffect(() => {
    if (!settings?.security.pinHash) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > settings.security.autoLockMin * 60000) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [settings?.security.pinHash, settings?.security.autoLockMin]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.style.setProperty('--accent', settings.ui.accent);
    document.documentElement.style.setProperty('--fs', String(settings.ui.fontScale));
  }, [settings]);

  if (!settings) return null;
  if (settings.security.pinHash && locked) return <><LockScreen onUnlock={() => setLocked(false)} /><UpdatePrompt /></>;
  if (!settings.onboardingDone) return <ToastProvider><Onboarding /><UpdatePrompt /></ToastProvider>;

  return (
    <ToastProvider>
      <div className="app">
        <Suspense fallback={<div className="page muted">Caricamento…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/allenamento" element={<WorkoutHub />} />
            <Route path="/allenamento/check" element={<ReadinessCheck />} />
            <Route path="/allenamento/live" element={<LiveWorkout />} />
            <Route path="/allenamento/seduta/:id" element={<SessionDetail />} />
            <Route path="/esercizi/:id" element={<ExerciseDetail />} />
            <Route path="/progressi" element={<Progress />} />
            <Route path="/corpo" element={<Body />} />
            <Route path="/alimentazione" element={<Nutrition />} />
            <Route path="/assistente" element={<Assistant />} />
            <Route path="/avatar" element={<Avatar />} />
            <Route path="/profilo" element={<Profile />} />
            <Route path="/profilo/*" element={<SettingsRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      {!hideNav && <BottomNav />}
      <UpdatePrompt />
    </ToastProvider>
  );
}
