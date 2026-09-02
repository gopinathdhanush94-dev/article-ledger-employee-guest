import React, { useEffect, useState } from 'react';

function formatResult(value) {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Math.round((value + Number.EPSILON) * 1e12) / 1e12;
  return String(rounded);
}

export default function Calculator({ open, onClose }) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waiting, setWaiting] = useState(false);

  function clear() {
    setDisplay('0');
    setStored(null);
    setOperator(null);
    setWaiting(false);
  }

  function inputDigit(digit) {
    if (waiting || display === 'Error') {
      setDisplay(digit);
      setWaiting(false);
      return;
    }
    setDisplay(display === '0' ? digit : display + digit);
  }

  function inputDecimal() {
    if (waiting || display === 'Error') {
      setDisplay('0.');
      setWaiting(false);
      return;
    }
    if (!display.includes('.')) setDisplay(display + '.');
  }

  function toggleSign() {
    if (display === '0' || display === 'Error') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display);
  }

  function percent() {
    const value = Number(display);
    if (Number.isFinite(value)) setDisplay(formatResult(value / 100));
  }

  function backspace() {
    if (waiting || display === 'Error') return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  }

  function calculate(a, b, op) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? NaN : a / b;
    return b;
  }

  function chooseOperator(nextOperator) {
    const input = Number(display);
    if (!Number.isFinite(input)) return;

    if (stored !== null && operator && !waiting) {
      const result = calculate(stored, input, operator);
      const formatted = formatResult(result);
      setDisplay(formatted);
      setStored(result);
    } else {
      setStored(input);
    }
    setOperator(nextOperator);
    setWaiting(true);
  }

  function equals() {
    if (stored === null || !operator || waiting) return;
    const input = Number(display);
    const result = calculate(stored, input, operator);
    setDisplay(formatResult(result));
    setStored(null);
    setOperator(null);
    setWaiting(true);
  }

  function press(key) {
    if (/^[0-9]$/.test(key)) inputDigit(key);
    else if (key === '.') inputDecimal();
    else if (['+', '-', '×', '÷'].includes(key)) chooseOperator(key);
    else if (key === '=' || key === 'Enter') equals();
    else if (key === '%') percent();
    else if (key === 'Escape') onClose();
    else if (key === 'Backspace') backspace();
    else if (key.toLowerCase() === 'c') clear();
  }

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      const keyMap = { '*': '×', '/': '÷' };
      const key = keyMap[event.key] || event.key;
      if (['0','1','2','3','4','5','6','7','8','9','.','+','-','×','÷','=','Enter','%','Escape','Backspace','c','C','*','/'].includes(event.key)) {
        event.preventDefault();
        press(key);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!open) return null;

  const keys = [
    { label: 'C', action: clear, cls: 'calc-clear' },
    { label: '⌫', action: backspace, cls: 'calc-muted' },
    { label: '%', action: percent, cls: 'calc-muted' },
    { label: '÷', action: () => chooseOperator('÷'), cls: 'calc-op' },
    { label: '7', action: () => inputDigit('7') },
    { label: '8', action: () => inputDigit('8') },
    { label: '9', action: () => inputDigit('9') },
    { label: '×', action: () => chooseOperator('×'), cls: 'calc-op' },
    { label: '4', action: () => inputDigit('4') },
    { label: '5', action: () => inputDigit('5') },
    { label: '6', action: () => inputDigit('6') },
    { label: '-', action: () => chooseOperator('-'), cls: 'calc-op' },
    { label: '1', action: () => inputDigit('1') },
    { label: '2', action: () => inputDigit('2') },
    { label: '3', action: () => inputDigit('3') },
    { label: '+', action: () => chooseOperator('+'), cls: 'calc-op' },
    { label: '±', action: toggleSign, cls: 'calc-muted' },
    { label: '0', action: () => inputDigit('0') },
    { label: '.', action: inputDecimal },
    { label: '=', action: equals, cls: 'calc-equals' },
  ];

  return (
    <div className="calculator-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="calculator" role="dialog" aria-modal="true" aria-label="Calculator">
        <div className="calculator-head">
          <div>
            <strong>Calculator</strong>
            <span>Basic calculator</span>
          </div>
          <button type="button" className="calculator-close" onClick={onClose} aria-label="Close calculator">×</button>
        </div>
        <div className="calculator-display" aria-live="polite">
          <span>{operator && stored !== null ? `${formatResult(stored)} ${operator}` : '\u00a0'}</span>
          <strong>{display}</strong>
        </div>
        <div className="calculator-keys">
          {keys.map((key) => (
            <button key={key.label} type="button" className={key.cls || ''} onClick={key.action}>{key.label}</button>
          ))}
        </div>
        <div className="calculator-hint">Keyboard: numbers, + − × ÷, Enter, Backspace, Esc</div>
      </section>
    </div>
  );
}
