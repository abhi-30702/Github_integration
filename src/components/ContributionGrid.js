import React, { useEffect, useState } from 'react';

const LEVELS  = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const MONTHS  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEIGHTS = [35, 22, 16, 14, 13];

function weightedRandom(seed) {
  let h = (seed * 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const r = h % 100;
  let c = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    c += WEIGHTS[i];
    if (r < c) return i;
  }
  return 0;
}

function countToLevel(n) {
  if (n === 0) return 0;
  if (n <= 3)  return 1;
  if (n <= 6)  return 2;
  if (n <= 12) return 3;
  return 4;
}

export default function ContributionGrid({ weeks = [], total = 0 }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      setRevealed(i);
      if (i >= 364) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [weeks]);

  const cells = weeks.length > 0
    ? weeks.flatMap(w => w.contributionDays).map((d, i) => ({
        level: countToLevel(d.contributionCount),
        count: d.contributionCount,
        date:  d.date,
        idx:   i,
      }))
    : Array.from({ length: 364 }, (_, i) => ({
        level: weightedRandom(i * 31 + 7),
        count: 0,
        date:  '',
        idx:   i,
      }));

  const displayTotal = total > 0 ? total : cells.reduce((s, c) => s + c.level * 3, 0);
  const year = weeks.length > 0
    ? new Date(weeks[0]?.contributionDays?.[0]?.date || Date.now()).getFullYear()
    : new Date().getFullYear();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <div style={{ fontSize: '.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
          Contribution Activity — {year}
        </div>
        <div style={{ fontSize: '.75rem', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
          {displayTotal.toLocaleString()} contributions
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', marginBottom: '.35rem' }}>
        {MONTHS.map(m => (
          <span key={m} style={{ fontSize: '.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{m}</span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(52, 1fr)', gap: 2 }}>
        {cells.map((c, i) => (
          <div key={i}
            title={c.date ? `${c.date}: ${c.count} contributions` : `${c.level * 3} contributions`}
            style={{
              aspectRatio: '1', borderRadius: 2,
              background: i <= revealed ? LEVELS[c.level] : LEVELS[0],
              transition: 'background .3s', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.outline = '1px solid var(--text)'; e.currentTarget.style.outlineOffset = '1px'; }}
            onMouseLeave={e => { e.currentTarget.style.outline = 'none'; }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '.6rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>Less</span>
        {LEVELS.map((l, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: l, border: i === 0 ? '1px solid var(--border)' : 'none' }} />
        ))}
        <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>More</span>
      </div>
    </div>
  );
}
