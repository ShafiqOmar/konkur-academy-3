import React from 'react';

// TrailPath — عنصر شاخص طراحی: یک «مسیر کوهستانی» که پیشرفت شاگرد
// را از «شروع» تا «روز کانکور» نشان می‌دهد. هر گره = یک کورس یا مرحله.
// milestones: [{ label, percent (0-100), sub }]
export default function TrailPath({ milestones = [], compact = false }) {
  const width = 100;
  const points = milestones.map((_, i) => {
    const x = (i / Math.max(milestones.length - 1, 1)) * (width - 10) + 5;
    const y = i % 2 === 0 ? 30 : 70;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return (
    <div className={compact ? 'w-full' : 'w-full max-w-3xl mx-auto'}>
      <svg viewBox="0 0 100 100" className="w-full" style={{ height: compact ? 120 : 180 }}>
        <path
          d={pathD}
          fill="none"
          className="stroke-line"
          strokeWidth="1.2"
          strokeDasharray="3 2"
          opacity="0.4"
        />
        {points.map((p, i) => {
          const m = milestones[i];
          const done = m.percent >= 100;
          const active = m.percent > 0 && m.percent < 100;
          const colorClass = done ? 'fill-sage' : active ? 'fill-gold' : 'fill-line opacity-30';
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={done ? 3.2 : 2.6} className={colorClass} />
              {done && (
                <text x={p.x} y={p.y + 1.2} fontSize="3" fill="white" textAnchor="middle">
                  ✓
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!compact && (
        <div className="flex justify-between mt-1 px-1">
          {milestones.map((m, i) => (
            <div key={i} className="text-center" style={{ maxWidth: 90 }}>
              <p className="text-xs font-bold text-heading truncate">{m.label}</p>
              <p className="text-[11px] text-ink/60 font-mono-nums">{m.percent}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
