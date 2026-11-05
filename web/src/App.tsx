import { useEffect, useState, type FormEvent } from 'react';
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


function PrivacyPolicy() {
  return (
    <main
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '48px 24px',
        color: '#e8eaf0',
        lineHeight: 1.8,
        fontFamily: 'inherit',
      }}
    >
      <a
        href="/"
        style={{ color: '#e85b4a', textDecoration: 'none' }}
      >
        ← 返回观影报告
      </a>

      <h1 style={{ marginTop: 32 }}>Privacy Policy</h1>
      <p style={{ color: '#9299a8' }}>
        My Watch Report · Last updated: November 4, 2026
      </p>

      <h2>1. About My Watch Report</h2>
      <p>
        My Watch Report is a personal web application designed
        to import, organize, and visualize a user's own Trakt
        watch history.
      </p>
      <p>
        The website is publicly accessible. Information displayed
        in viewing reports may therefore be visible to anyone
        who visits the website.
      </p>
      <p>
        My Watch Report uses Trakt but is not endorsed or certified
        by Trakt.
      </p>

      <h2>2. Information We Collect</h2>
      <p>
        When connected to Trakt, the application may access and
        store information from the authorized account, including:
      </p>
      <ul>
        <li>Watched movies and TV episodes.</li>
        <li>Watch history and viewing dates.</li>
        <li>Personal ratings.</li>
        <li>Movie and TV show information used in reports.</li>
        <li>OAuth access tokens and refresh tokens.</li>
      </ul>
      <p>We do not collect your Trakt password.</p>

      <h2>3. How We Use Information</h2>
      <p>Information is used solely to:</p>
      <ul>
        <li>Generate viewing reports and statistics.</li>
        <li>Display watch history and personal ratings.</li>
        <li>Calculate yearly and monthly viewing summaries.</li>
        <li>Synchronize report data with Trakt.</li>
      </ul>
      <p>
        We do not sell Trakt data or provide it to other services
        for their own use.
      </p>

      <h2>4. Public Visibility</h2>
      <p>
        My Watch Report is designed as a publicly accessible
        viewing-report website. Information displayed on report
        pages may be viewed by other visitors.
      </p>
      <p>
        Do not connect an account if you do not want the resulting
        viewing information to be publicly visible.
      </p>

      <h2>5. Data Storage and Retention</h2>
      <p>
        Application data, including viewing records and OAuth
        tokens, is stored in a Cloudflare D1 database.
      </p>
      <p>
        Data is retained for as long as it is needed to provide
        the application's features, unless deletion is requested.
        There is currently no automatic data-retention period.
      </p>
      <p>
        Deletion requests are handled manually by the project
        maintainer.
      </p>

      <h2>6. Third-Party Services</h2>
      <ul>
        <li>
          <strong>Trakt:</strong> Provides authorized watch-history
          and account data through its API.
        </li>
        <li>
          <strong>Cloudflare:</strong> Hosts the application and
          provides database infrastructure.
        </li>
      </ul>
      <p>
        These services are subject to their own privacy policies
        and terms.
      </p>

      <h2>7. Disconnecting Trakt and Deleting Data</h2>
      <p>
        You can revoke My Watch Report's access through your
        Trakt account's connected applications or authorized
        applications settings.
      </p>
      <p>
        Revoking access does not automatically delete information
        already stored in the application's database.
      </p>
      <p>
        To request deletion of stored viewing records and OAuth
        tokens, submit a request through the project's GitHub
        Issues page:
      </p>
      <p>
        <a
          href="https://github.com/Alpha-9527/my-watch-report/issues"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#e85b4a' }}
        >
          GitHub Issues — My Watch Report
        </a>
      </p>
      <p>
        Please do not include passwords, access tokens, or other
        sensitive information in a public GitHub issue.
      </p>

      <h2>8. Security</h2>
      <p>
        Reasonable measures are used to protect application data
        and OAuth credentials. However, no method of storage or
        transmission over the Internet can be guaranteed to be
        completely secure.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        This Privacy Policy may be updated when the application
        or its data practices change. The latest version will
        be published on this page.
      </p>

      <h2>10. Contact</h2>
      <p>
        For questions, feedback, or data deletion requests,
        please use the project's GitHub Issues page:
      </p>
      <a
        href="https://github.com/Alpha-9527/my-watch-report/issues"
        target="_blank"
        rel="noreferrer"
        style={{ color: '#e85b4a' }}
      >
        https://github.com/Alpha-9527/my-watch-report/issues
      </a>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 20,
          borderTop: '1px solid #303746',
          color: '#9299a8',
        }}
      >
        My Watch Report uses Trakt but is not endorsed or
        certified by Trakt.
      </footer>
    </main>
  );
}


export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [appToken, setAppToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ''
  );
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  
  const year = new Date().getFullYear();

    async function load() {
    try {
      const [s, t] = await Promise.all([
        fetch(`${API}/api/summary?year=${year}`),
        fetch(`${API}/api/status`),
      ]);

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

  async function sync(token = appToken) {
    if (!token) {
      setShowTokenInput(true);
      setError('');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const r = await fetch(`${API}/api/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const d = await r.json();

      if (r.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setAppToken('');
        setTokenInput('');
        setShowTokenInput(true);
        setError('访问密钥不正确，请重新输入');
        return;
      }

      if (!r.ok) {
        throw new Error(d.error || '同步失败');
      }

      setShowTokenInput(false);
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
    setShowTokenInput(false);

    void sync(token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    setAppToken('');
    setTokenInput('');
    setShowTokenInput(false);
  }

  useEffect(() => {
    void load();
  }, []);
  if (window.location.pathname === '/privacy') {
  return <PrivacyPolicy />;
}
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
            onClick={() => void sync()}
            disabled={busy || !status?.connected}
          >
            <RefreshCw size={16} className={busy ? 'spin' : ''} />
            {busy ? '同步中' : '立即同步'}
          </button>

                    {appToken && (
            <button className="ghost" onClick={clearToken} title="清除同步密钥">
              清除密钥
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="dot" /> YOUR YEAR IN FILM
          </div>
          <h1>把看过的故事，<em>好好收藏。</em></h1>
          <p>私人观影档案与年度回顾。</p>
        </div>
        <div className="year">
          {year}
          <small>ANNUAL REPORT</small>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}
            {showTokenInput && (
        <section className="connect">
          <div>
            <b>输入同步密钥</b>
            <p>此密钥仅用于手动同步 Trakt 观看记录。</p>

            <form onSubmit={submitToken}>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="请输入同步密钥"
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
                验证并同步
              </button>

              <button
                className="ghost"
                type="button"
                onClick={() => setShowTokenInput(false)}
              >
                取消
              </button>
            </form>
          </div>
        </section>
      )}
      {!status?.connected && (
        <section className="connect">
          <div>
            <b>连接 Trakt 账户</b>
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
        <a href="https://watch.0x3.im/privacy">Privacy Policy</a>
        <span>Built with Cloudflare</span>
      </footer>
    </main>
  );
}
