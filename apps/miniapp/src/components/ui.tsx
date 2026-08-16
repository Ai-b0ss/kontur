import { useEffect, useState, type ReactNode } from 'react';
import { serverNow } from '../api.js';

/** Общие элементы интерфейса. Тон §9.1: сухо, без восклицательных знаков. */

export function Meter({ value, max, full }: { value: number; max: number; full?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`meter ${full ? 'meter--full' : ''}`}>
      <div className="meter__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Res({ kind, value }: { kind: 'worm' | 'branch'; value: number }) {
  return (
    <div className="res">
      <i className={`dot dot--${kind}`} />
      <span className="res__value">{value.toLocaleString('ru')}</span>
    </div>
  );
}

/**
 * Обратный отсчёт от серверного времени (I2). Клиентские часы участвуют
 * только в измерении прошедшего с момента ответа — сама точка отсчёта
 * пришла с сервера.
 */
export function Countdown({ to }: { to: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const left = new Date(to).getTime() - serverNow().getTime();
  if (left <= 0) return <span>—</span>;

  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);

  return (
    <span className="tabular">
      {h > 0 ? `${h} ч ${m} мин` : m > 0 ? `${m} мин ${s} с` : `${s} с`}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'ghost',
  busy,
}: {
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      className={`btn btn--${variant} ${busy ? 'btn--busy' : ''}`}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? <span className="btn__spinner" /> : children}
    </button>
  );
}

export function Card({
  title,
  aside,
  children,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || aside) && (
        <div className="card__head">
          {title && <span className="card__title">{title}</span>}
          {aside && <span className="muted small">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}

/* ─── четыре состояния экрана (§9.1) ────────────────────────── */

export function Loading({ what }: { what?: string }) {
  return (
    <div className="state">
      <div className="spinner" />
      {what && <p className="muted small">{what}</p>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="state">
      <p className="muted">{text}</p>
    </div>
  );
}

export function Failed({ text, onRetry }: { text: string; onRetry?(): void }) {
  return (
    <div className="state">
      <p className="lead">Не получилось</p>
      <p className="muted small">{text}</p>
      {onRetry && (
        <button className="btn btn--ghost btn--inline" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Offline({ onRetry }: { onRetry(): void }) {
  return (
    <div className="state">
      <p className="lead">Нет связи</p>
      <p className="muted small">Проверьте интернет</p>
      <button className="btn btn--ghost btn--inline" onClick={onRetry}>
        Повторить
      </button>
    </div>
  );
}
