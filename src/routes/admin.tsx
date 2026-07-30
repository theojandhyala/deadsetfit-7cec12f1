import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, ArrowLeft, Users, Crown, TrendingUp, Globe, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStats, type AdminStats } from "@/lib/admin.functions";

const ADMIN_EMAILS = ["theojandhyala@icloud.com"];

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "DEADSET — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email?.toLowerCase();
      if (!email || !ADMIN_EMAILS.includes(email)) {
        navigate({ to: "/train", replace: true });
        return;
      }
      setStats(await getAdminStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last7 = stats ? stats.signupsPerDay.slice(-7).reduce((s, d) => s + d.count, 0) : 0;

  return (
    <div className="min-h-screen bg-grit text-white px-4 py-6 pb-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Link to="/train" className="flex items-center gap-2 text-grit-dim text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <button onClick={load} className="flex items-center gap-2 text-grit-dim text-sm press">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <h1 className="display mt-4 text-3xl font-extrabold italic">
          ADMIN <span className="text-accent-red">DASHBOARD</span>
        </h1>

        {error && (
          <div className="mt-6 border border-accent-red/40 bg-accent-red/10 p-4 text-sm">
            {error}
          </div>
        )}

        {loading && !stats && (
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
          </div>
        )}

        {stats && (
          <>
            {/* KPI cards */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Kpi icon={<Users size={16} />} label="USERS" value={stats.totalUsers} />
              <Kpi icon={<TrendingUp size={16} />} label="LAST 7 DAYS" value={last7} />
              <Kpi
                icon={<Crown size={16} />}
                label="PRO SUBS"
                value={stats.activeSubscriptions}
                accent
              />
            </div>

            <Section title="ACTIVATION & RETENTION">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric
                  label="Setup complete"
                  value={stats.engagement.onboardedUsers}
                  total={stats.engagement.syncedUsers}
                />
                <Metric
                  label="Started a workout"
                  value={stats.engagement.startedWorkoutUsers}
                  total={stats.engagement.syncedUsers}
                />
                <Metric
                  label="Finished a workout"
                  value={stats.engagement.finishedWorkoutUsers}
                  total={stats.engagement.syncedUsers}
                />
                <Metric
                  label="Active in 7 days"
                  value={stats.engagement.active7DayUsers}
                  total={stats.engagement.syncedUsers}
                  accent
                />
                <Metric
                  label="Active in 30 days"
                  value={stats.engagement.active30DayUsers}
                  total={stats.engagement.syncedUsers}
                />
                <div className="border border-[#262626] bg-[#141414] p-3">
                  <p className="flex items-center gap-1 text-[9px] uppercase text-grit-dim">
                    <Activity size={11} /> Workouts finished
                  </p>
                  <p className="display mt-1 text-2xl font-extrabold text-white">
                    {stats.engagement.completedWorkouts}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-grit-dim">
                Counts use synced account activity only. Watch these before and after acquisition
                campaigns to see whether new users reach their first workout and return.
              </p>
            </Section>

            {/* New users per day */}
            <Section title="NEW USERS — LAST 30 DAYS">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.signupsPerDay}
                    margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#8A8A8A", fontSize: 10 }}
                      tickFormatter={(d: string) => d.slice(5)}
                      interval={6}
                      axisLine={{ stroke: "#222" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#8A8A8A", fontSize: 10 }}
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        background: "#141414",
                        border: "1px solid #262626",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#8A8A8A" }}
                    />
                    <Bar dataKey="count" fill="#E10600" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* Where users came from */}
            <Section title="WHERE USERS CAME FROM">
              {stats.sources.length === 0 ? (
                <Empty text="No source data yet — it starts collecting from new visitors now." />
              ) : (
                <div className="space-y-2">
                  {stats.sources.map((s) => {
                    const max = stats.sources[0]?.count || 1;
                    return (
                      <div key={s.source} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs uppercase tracking-wider text-grit-dim flex items-center gap-1">
                          <Globe size={11} /> {s.source}
                        </span>
                        <div className="h-3 flex-1 bg-[#1a1a1a]">
                          <div
                            className="h-full bg-accent-red"
                            style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-white">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Plans */}
            <Section title="ACTIVE PLANS">
              {stats.subscriptionPlans.length === 0 ? (
                <Empty text="No active subscriptions yet." />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {stats.subscriptionPlans.map((p) => (
                    <div key={p.plan} className="border border-[#262626] bg-[#141414] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-grit-dim">
                        {p.plan}
                      </p>
                      <p className="display mt-1 text-2xl font-extrabold text-accent-red">
                        {p.count}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Recent signups */}
            <Section title="RECENT SIGNUPS">
              <div className="divide-y divide-[#1f1f1f]">
                {stats.recentSignups.map((u, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="text-white">
                        {u.displayName || u.username || "Anonymous"}
                      </span>
                      {u.username && <span className="ml-2 text-grit-dim">@{u.username}</span>}
                      {u.location && (
                        <span className="ml-2 text-[11px] text-grit-dim">{u.location}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-grit-dim">{u.date?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <p className="mt-8 text-center text-[11px] text-grit-dim">
              Revenue detail lives in your{" "}
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noreferrer"
                className="text-accent-red underline"
              >
                Stripe dashboard
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="border border-[#262626] bg-[#141414] p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-grit-dim">
        {icon} {label}
      </p>
      <p
        className={`display mt-1 text-3xl font-extrabold ${accent ? "text-accent-red" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="label-cap mb-3 text-xs text-grit-dim">{title}</h2>
      <div className="border border-[#262626] bg-[#0f0f0f] p-4">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent?: boolean;
}) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="border border-[#262626] bg-[#141414] p-3">
      <p className="text-[9px] uppercase text-grit-dim">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p
          className={`display text-2xl font-extrabold ${accent ? "text-accent-red" : "text-white"}`}
        >
          {value}
        </p>
        <p className="text-xs font-bold text-grit-dim">{percentage}%</p>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-grit-dim">{text}</p>;
}
