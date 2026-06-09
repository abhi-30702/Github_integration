import React, { useEffect, useState } from 'react';

const LEVELS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEIGHTS = [35, 22, 16, 14, 13]; // probability weights for level 0-4

function weightedRandom(seed) {
  // deterministic pseudo-random
  let h = (seed * 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const r = (h % 100);
  let c = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    c += WEIGHTS[i];
    if (r < c) return i;
  }
  return 0;
}

export default function ContributionGrid() {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      setRevealed(i);
      if (i >= 364) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const cells = Array.from({ length: 364 }, (_, i) => ({
    level: weightedRandom(i * 31 + 7),
    day: i,
  }));

  const totalContribs = cells.reduce((s, c) => s + c.level * 3, 0);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <div style={{ fontSize: '.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>Contribution Activity — 2025</div>
        <div style={{ fontSize: '.75rem', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{totalContribs.toLocaleString()} contributions</div>
      </div>

      {/* Month labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', marginBottom: '.35rem' }}>
        {MONTHS.map(m => (
          <span key={m} style={{ fontSize: '.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{m}</span>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(52, 1fr)', gap: 2 }}>
        {cells.map((c, i) => (
          <div key={i} title={`${c.level * 3} contributions`} style={{
            aspectRatio: '1', borderRadius: 2,
            background: i <= revealed ? LEVELS[c.level] : LEVELS[0],
            transition: 'background .3s',
            cursor: 'pointer',
          }}
            onMouseEnter={e => { e.currentTarget.style.outline = '1px solid var(--text)'; e.currentTarget.style.outlineOffset = '1px'; }}
            onMouseLeave={e => { e.currentTarget.style.outline = 'none'; }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '.6rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>Less</span>
        {LEVELS.map((l, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: l, border: i === 0 ? '1px solid var(--border)' : 'none' }} />)}
        <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>More</span>
      </div>
    </div>
  );
}
