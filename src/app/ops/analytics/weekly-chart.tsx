/**
 * Orders per week. Single series → one hue (teal, 4.75:1 on surface); magnitude job → columns from a
 * zero baseline; per-bar tooltip via <title> and an accessible table view below (dataviz guidance).
 */
export function WeeklyOrdersChart({ data }: { data: { week: string; orders: number }[] }) {
  const W = 560, H = 200, padL = 32, padB = 28, padT = 12;
  const max = Math.max(1, ...data.map((d) => d.orders));
  const nice = Math.max(1, Math.ceil(max / 4) * 4);
  const bw = data.length ? (W - padL) / data.length : 0;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / nice);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-navy">Orders placed per week (last 8 weeks)</figcaption>
      {data.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Orders per week, column chart; values in the table below" className="w-full max-w-xl">
          {[0, nice / 2, nice].map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{t}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = padL + i * bw + 2;
            const h = y(0) - y(d.orders);
            const w = Math.max(4, bw - 4);
            return (
              <g key={d.week}>
                <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent"><title>{`Week of ${fmt(d.week)}: ${d.orders} orders`}</title></rect>
                {d.orders > 0 ? <path d={`M${x},${y(0)} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z`} fill="var(--color-primary)" pointerEvents="none" /> : null}
                <text x={padL + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--color-muted)">{fmt(d.week)}</text>
              </g>
            );
          })}
        </svg>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-primary">Show as table</summary>
        <table className="mt-2 text-sm">
          <thead><tr><th scope="col" className="pr-6 text-left">Week of</th><th scope="col" className="text-right">Orders</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.week}><td className="pr-6">{fmt(d.week)}</td><td className="text-right tabular-nums">{d.orders}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
