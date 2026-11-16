import { AlertTriangle, CheckCircle2, CircleDot, ListTodo } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { errorMessage } from '@/api/errors';
import type { ProjectSummaryQuery, TaskFilter } from '@/api/generated/graphql';
import { Alert } from '@/components/ui/alert';
import { useSummary } from './queries';

type Summary = ProjectSummaryQuery['projectSummary'];

// Chart tokens: one series per chart -> the brand color; recessive grid and axis ink.
const BAR = '#7600FD';
const GRID = '#ECE9F2';
const AXIS = '#5B5B66';

function Tile({
  label,
  value,
  icon,
  tone = 'default',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: 'default' | 'critical' | 'good';
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'critical' ? 'text-red-700' : tone === 'good' ? 'text-green-700' : ''}`}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Pure numbers for the tiles (tested separately). */
export function tileNumbers(s: Summary) {
  const byCat = Object.fromEntries(s.byCategory.map((c) => [c.category, c.count])) as Record<string, number>;
  const done = byCat.COMPLETED ?? 0;
  const cancelled = byCat.CANCELLED ?? 0;
  const open = s.total - done - cancelled;
  const doneShare = s.total - cancelled > 0 ? Math.round((done / (s.total - cancelled)) * 100) : 0;
  return { total: s.total, open, done, doneShare, overdue: s.overdueCount };
}

function ChartTooltip({
  active,
  payload,
  label,
  extra,
}: {
  active?: boolean;
  payload?: { value: number; payload: Record<string, unknown> }[];
  label?: string;
  extra?: (p: Record<string, unknown>) => string | null;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label ?? String(row.payload.name)}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{row.value}</span> task
        {row.value === 1 ? '' : 's'}
      </p>
      {extra?.(row.payload) && <p className="text-red-700">{extra(row.payload)}</p>}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description: string;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <figure className="rounded-xl border bg-card p-4 shadow-xs">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </figcaption>
      {children}
      {table}
    </figure>
  );
}

export function SummaryPanel({ projectId, filter }: { projectId: string; filter: TaskFilter }) {
  const summary = useSummary(projectId, filter);
  if (summary.isError) return <Alert>{errorMessage(summary.error)}</Alert>;
  if (!summary.data) return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy="true" />;
  const s = summary.data;
  const n = tileNumbers(s);
  const byStatus = s.byStatus.map((b) => ({ name: b.status.name, count: b.count }));
  const byAssignee = s.byAssignee
    .slice(0, 8)
    .map((a) => ({ name: a.user?.name ?? 'Unassigned', count: a.count, overdue: a.overdue }));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total tasks" value={n.total} icon={<ListTodo className="size-3.5" />} />
        <Tile
          label="Open"
          value={n.open}
          icon={<CircleDot className="size-3.5" />}
          hint="Not started or started"
        />
        <Tile
          label="Done"
          value={n.done}
          icon={<CheckCircle2 className="size-3.5 text-green-700" />}
          tone="good"
          hint={`${n.doneShare}% of non-cancelled`}
        />
        <Tile
          label="Overdue"
          value={n.overdue}
          icon={<AlertTriangle className="size-3.5 text-red-700" />}
          tone={n.overdue ? 'critical' : 'default'}
          hint="Past due, not done or cancelled"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tasks by status"
          description="How many tasks sit in each column."
          table={
            <table className="sr-only">
              <caption>Tasks by status</caption>
              <tbody>
                {byStatus.map((r) => (
                  <tr key={r.name}>
                    <th scope="row">{r.name}</th>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <div className="h-56" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byStatus}
                margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
                barCategoryGap={2}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: '#F6EFFF' }} content={<ChartTooltip />} />
                <Bar dataKey="count" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="count" position="top" fill={AXIS} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Tasks per assignee"
          description="Load per person (top 8). Hover a bar for overdue work."
          table={
            <table className="sr-only">
              <caption>Tasks per assignee</caption>
              <tbody>
                {byAssignee.map((r) => (
                  <tr key={r.name}>
                    <th scope="row">{r.name}</th>
                    <td>{r.count} tasks</td>
                    <td>{r.overdue} overdue</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          {byAssignee.length === 0 ? (
            <p className="grid h-56 place-items-center text-sm text-muted-foreground">
              No tasks match these filters.
            </p>
          ) : (
            <div className="h-56" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byAssignee}
                  layout="vertical"
                  margin={{ top: 0, right: 32, left: 8, bottom: 0 }}
                  barCategoryGap={2}
                >
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: AXIS, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fill: AXIS, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                  />
                  <Tooltip
                    cursor={{ fill: '#F6EFFF' }}
                    content={
                      <ChartTooltip
                        extra={(p) => (Number(p.overdue) > 0 ? `${String(p.overdue)} overdue` : null)}
                      />
                    }
                  />
                  <Bar dataKey="count" fill={BAR} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="count" position="right" fill={AXIS} fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
