// Hand-drawn SVG chart: zero dependencies, and you learn how scales work.
// (alt: Recharts, Chart.js, D3 once charts get complex)
export default function CurveChart({ curve }) {
  const W = 640,
    H = 320,
    P = { l: 44, r: 20, t: 20, b: 36 };
  const n = curve.length;
  // Scales map data to pixels: x spreads points evenly; y maps 0.4..1.0 onto the height (SVG y grows downward).
  const x = (i) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - 0.4) / 0.6) * (H - P.t - P.b);
  const line = (k) => curve.map((p, i) => `${x(i)},${y(p[k])}`).join(" ");
  // Shaded polygon between the curves = the generalization gap, the first thing a "doctor" reads.
  const gap = [
    ...curve.map((p, i) => `${x(i)},${y(p.train)}`),
    ...[...curve].reverse().map((p, i) => `${x(n - 1 - i)},${y(p.dev)}`),
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Learning curves: training vs dev score by training set size"
      className="chart"
    >
      {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={P.l - 8} y={y(v) + 4} textAnchor="end" className="tick">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {curve.map((p, i) => (
        <text
          key={p.size}
          x={x(i)}
          y={H - 12}
          textAnchor="middle"
          className="tick"
        >
          {p.size}%
        </text>
      ))}
      <polygon points={gap} className="gap" />
      <polyline points={line("train")} className="ln train" />
      <polyline points={line("dev")} className="ln dev" />
      {curve.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.train)} r="4" className="dot train" />
          <circle cx={x(i)} cy={y(p.dev)} r="4" className="dot dev" />
        </g>
      ))}
    </svg>
  );
}
