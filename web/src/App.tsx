
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Activity, CalendarDays, Clapperboard, Clock3, Film,
  RefreshCw, Star, Tv, Wifi, WifiOff
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';

const API = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'my_watch_report_token';

type Summary = {
  year: number;
  totals: any;
  monthly: any[];
  genres: any[];
  recent: any[];
};

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [appToken, setAppToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ''
  );
  const [tokenInput, setTokenInput] = useState('');

  const year = new Date().getFullYear();

  async function load(token = appToken) {
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [s, t] = await Promise.all([
        fetch(`${API}/api/summary?year=${year}`, { headers }),
        fetch(`${API}/api/status`, { headers }),
      ]);

      if (s.status === 401 || t.status === 401) {
        throw new Error('访问密钥不正确，请检查后重新输入');
      }

      if (!s.ok || !t.ok) {
        throw new Error('无法连接观影报告 API，请检查 Worker 部署状态');
      }

      setSummary(await s.json());
      setStatus(await t.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function sync() {
    setBusy(true);
    setError('');

    try {
      const r = await fetch(`${API}/api/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appToken}`,
        },
      });

      const d = await r.json();

      if (r.status === 401) {
        throw new Error('访问密钥不正确，请重新输入');
      }

      if (!r.ok) {
        throw new Error(d.error || '同步失败');
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function submitToken(e: FormEvent) {
    e.preventDefault();

    const token = tokenInput.trim();
    if (!token) return;

    sessionStorage.setItem(TOKEN_KEY, token);
    setAppToken(token);
    setTokenInput('');
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setAppToken('');
    setSummary(null);
    setStatus(null);
    setError('');
  }

  useEffect(() => {
    if (appToken) load(appToken);
  }, [appToken]);

  const totals = summary?.totals || {};

  const cards = [
    { label: '电影观看次数', value: totals.movies ?? '—', icon: Film },
    { label: '追过的剧集', value: totals.shows ?? '—', icon: Tv },
    {
      label: '累计观影时长',
      value: totals.minutes ? `${Math.round(totals.minutes / 60)}h` : '—',
      icon: Clock3,
    },
    { label: '观看事件', value: totals.plays ?? '—', icon: Clapperboard },
  ];

  if (!appToken) {
    return (
      <main className="shell">
        <section className="connect" style={{ marginTop: '15vh' }}>
          <div>
            <b>MY WATCH REPORT</b>
            <p>请输入访问密钥，进入你的私人观影档案。</p>
            <form onSubmit={submitToken}>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="请输入访问密钥"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  margin: '12px 0',
                  borderRadius: '8px',
                }}
              />
              <button className="primary" type="submit">
                进入观影报告
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark"><Clapperboard size={20} /></span>
          <div>
            <b>MY WATCH REPORT</b>
            <small>PERSONAL CINEMA ARCHIVE</small>
          </div>
        </div>

        <div className="actions">
          <span className={`connection ${status?.connected ? 'online' : ''}`}>
            {status?.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            {status?.connected ? 'Trakt 已连接' : '尚未连接 Trakt'}
          </span>

          <button className="ghost" onClick={() => load()}>
            <RefreshCw size={16} />
          </button>

          <button
            className="primary"
            onClick={sync}
            disabled={busy || !status?.connected}
          >
            <RefreshCw size={16} className={busy ? 'spin' : ''} />
            {busy ? '同步中' : '立即同步'}
          </button>

          <button className="ghost" onClick={logout} title="退出">
            退出
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="dot" /> YOUR YEAR IN FILM
          </div>
          <h1>把看过的故事，<em>好好收藏。</em></h1>
          <p>你的私人观影档案与年度回顾。</p>
        </div>
        <div className="year">
          {year}
          <small>ANNUAL REPORT</small>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}

      {!status?.connected && (
        <section className="connect">
          <div>
            <b>连接你的 Trakt 账户</b>
            <p>授权后即可导入观看历史，后台每小时自动同步。</p>
          </div>
          <a className="primary linkbtn" href={`${API}/api/auth/start`}>
            连接 Trakt 账户
          </a>
        </section>
      )}

      <section className="stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <article className="stat" key={label}>
            <div className="stathead">
              {label}<Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>
              {label === '累计观影时长' ? '按可用片长估算' : `${year} 年累计`}
            </small>
          </article>
        ))}
      </section>

      <section className="grid">
        <article className="panel chartpanel">
          <div className="paneltitle">
            <div>
              <span className="eyebrow">ACTIVITY</span>
              <h2>月度观影趋势</h2>
            </div>
            <CalendarDays />
          </div>

          <div className="chart">
            {summary ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Array.from({ length: 12 }, (_, i) => ({
                    month: `${i + 1}月`,
                    plays: Number(
                      summary.monthly.find(x => Number(x.month) === i + 1)?.plays ?? 0
                    ),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#252a35" vertical={false} />
                  <XAxis dataKey="month" stroke="#777f90" tickLine={false} axisLine={false} />
                  <YAxis stroke="#777f90" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{
                    background: '#171b24',
                    border: '1px solid #303746',
                    borderRadius: 10,
                  }} />
                  <Bar dataKey="plays" name="观看次数" fill="#e85b4a" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty">连接 Trakt 并同步后显示趋势</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="paneltitle">
            <div>
              <span className="eyebrow">GENRES</span>
              <h2>偏爱的类型</h2>
            </div>
            <Activity />
          </div>

          {summary?.genres?.length ? (
            <div className="genrelist">
              {summary.genres.map((g: any) => (
                <div className="genre" key={g.genre}>
                  <span>{g.genre}</span><b>{g.count}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">同步影片资料后生成类型分布</div>
          )}
        </article>
      </section>

      <section className="panel recent">
        <div className="paneltitle">
          <div>
            <span className="eyebrow">RECENTLY WATCHED</span>
            <h2>最近观看</h2>
          </div>
          <Star />
        </div>

        {summary?.recent?.length ? (
          <div className="history">
            {summary.recent.map((r: any) => (
              <div className="historyrow" key={r.event_id}>
                <div className="poster"><Film size={19} /></div>
                <div className="historyname">
                  <b>{r.title}</b>
                  <small>
                    {r.media_type === 'movie' ? '电影' : '剧集'}
                    {r.season ? ` · 第 ${r.season} 季 第 ${r.episode} 集` : ''}
                  </small>
                </div>
                <time>{new Date(r.watched_at).toLocaleDateString('zh-CN')}</time>
                <span className="duration">
                  {r.runtime_minutes ? `${r.runtime_minutes} 分钟` : '时长未知'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">还没有观影记录。连接 Trakt 后开始同步。</div>
        )}
      </section>

      <footer>
        MY WATCH REPORT
        <span>数据仅保存在你自己的 Cloudflare D1 数据库中</span>
      </footer>
    </main>
  );
}
