import React, { useState, useRef } from 'react';

export default function Autocomplete({ id, value, onChange, options, placeholder, required }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef(null);

  const q = (value || '').trim().toLowerCase();
  const filtered = (q ? options.filter(o => o.toLowerCase().includes(q)) : options).slice(0, 30);

  function pick(v) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="autocomplete">
      <input
        id={id}
        type="text"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
      />
      <div className={`autocomplete-menu ${open ? 'show' : ''}`}>
        {filtered.length === 0 ? (
          <div className="autocomplete-empty">No matches — keep typing to add "{value}" as new</div>
        ) : (
          filtered.map((opt, i) => (
            <div
              key={opt}
              className={`autocomplete-item ${i === activeIndex ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
            >
              {opt}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
