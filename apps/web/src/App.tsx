import 'reactflow/dist/style.css';
import './styles.css';

import { Activity, BarChart3, BookOpen, ExternalLink, GitBranch, LogOut, RefreshCw, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { emptyData, loadData, queueMonitorUrl, refreshSession, showQueueLink } from './api';
import { AuthScreen } from './auth/AuthScreen';
import { TabButton } from './components/ui';
import { DigestView, TelemetryView } from './digests/DigestView';
import { FeedView } from './feed/FeedView';
import { GraphView } from './graph/GraphView';
import { SettingsView } from './settings/SettingsView';
import type { AppData, AuthUser, Tab } from './types';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('nih_token') ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>('feed');
  const [data, setData] = useState<AppData>(emptyData);
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshSession(token, setUser, setMessage);
  }, [token]);

  useEffect(() => {
    if (!token || !user?.emailConfirmed) {
      return;
    }

    void loadData(token, setData, setMessage);
  }, [token, user?.emailConfirmed]);

  const setAuthToken = (nextToken: string) => {
    localStorage.setItem('nih_token', nextToken);
    setToken(nextToken);
  };

  if (!token || !user) {
    return (
      <AuthScreen
        devToken={devToken}
        message={message}
        onConfirmed={() => setMessage('Email підтверджено. Увійдіть, щоб продовжити.')}
        onDevToken={setDevToken}
        onMessage={setMessage}
        onToken={setAuthToken}
        onUser={setUser}
      />
    );
  }

  if (!user.emailConfirmed) {
    return (
      <AuthScreen
        devToken={devToken}
        message="Підтвердьте email перед роботою з кабінетом."
        onConfirmed={() => setMessage('Email підтверджено. Увійдіть, щоб продовжити.')}
        onDevToken={setDevToken}
        onMessage={setMessage}
        onToken={setAuthToken}
        onUser={setUser}
      />
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              UA-Skills
            </p>
            <h1 className="text-xl font-semibold">Центр новинної аналітики</h1>
          </div>
          <div className="flex items-center gap-2">
            {showQueueLink ? (
              <a className="secondary-button" href={queueMonitorUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={16} />
                Черги
              </a>
            ) : null}
            <button className="icon-button" onClick={() => void loadData(token, setData, setMessage)} title="Оновити">
              <RefreshCw size={18} />
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                localStorage.removeItem('nih_token');
                setToken('');
                setUser(null);
              }}
            >
              <LogOut size={16} />
              Вийти
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
          <TabButton icon={<Activity size={17} />} label="Стрічка" tab="feed" active={tab} onClick={setTab} />
          <TabButton icon={<GitBranch size={17} />} label="Граф" tab="graph" active={tab} onClick={setTab} />
          <TabButton icon={<BookOpen size={17} />} label="Дайджести" tab="digests" active={tab} onClick={setTab} />
          <TabButton icon={<Settings size={17} />} label="Налаштування" tab="settings" active={tab} onClick={setTab} />
          <TabButton icon={<BarChart3 size={17} />} label="Телеметрія" tab="telemetry" active={tab} onClick={setTab} />
        </nav>

        <section className="min-w-0">
          {message ? <div className="mb-3 rounded border border-line bg-white px-3 py-2 text-sm">{message}</div> : null}
          {tab === 'feed' ? (
            <FeedView
              data={data}
              onMessage={setMessage}
              onReload={() => loadData(token, setData, setMessage)}
              token={token}
            />
          ) : null}
          {tab === 'graph' ? (
            <GraphView
              categories={data.categories}
              graph={data.graph}
              onMessage={setMessage}
              token={token}
            />
          ) : null}
          {tab === 'digests' ? (
            <DigestView
              data={data}
              onReload={() => loadData(token, setData, setMessage)}
              token={token}
            />
          ) : null}
          {tab === 'settings' ? (
            <SettingsView
              data={data}
              onMessage={setMessage}
              onReload={() => loadData(token, setData, setMessage)}
              token={token}
            />
          ) : null}
          {tab === 'telemetry' ? <TelemetryView data={data} token={token} onReload={() => loadData(token, setData, setMessage)} /> : null}
        </section>
      </div>
    </main>
  );
}
