import React from 'react';

export default function CardGridSkeleton({ count = 10 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card skeleton-card" key={i}>
          <div className="skeleton-shimmer" style={{ aspectRatio: '1/1', borderBottom: '1px solid var(--border)' }} />
          <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-shimmer" style={{ width: 70, height: 16, borderRadius: 20 }} />
            <div className="skeleton-shimmer" style={{ width: '85%', height: 15, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '50%', height: 12, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '40%', height: 20, borderRadius: 4, marginTop: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
