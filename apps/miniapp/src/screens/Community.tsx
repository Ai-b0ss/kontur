import { useEffect, useState } from 'react';
import type { CommunityResponse } from '@kontur/contracts';
import { api, ApiError, OfflineError } from '../api.js';
import { Bird } from '../components/Bird.js';
import { Card, Empty, Failed, Loading, Offline, Stat } from '../components/ui.js';
import { haptic } from '../telegram.js';

/**
 * Сообщество: дерево и рейтинг за неделю.
 *
 * Окно недельное намеренно: при рейтинге за всё время первая пятёрка заняла бы
 * верх навсегда, и остальные забили бы на второй неделе.
 */
export function CommunityScreen({
  onToast,
}: {
  onToast(text: string, tone: 'ok' | 'bad'): void;
}) {
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [error, setError] = useState<'offline' | string | null>(null);

  const load = () => {
    setError(null);
    setData(null);
    api
      .community()
      .then(setData)
      .catch((e) => {
        if (e instanceof OfflineError) setError('offline');
        else setError(e instanceof ApiError ? e.message : 'Не удалось загрузить');
      });
  };

  useEffect(load, []);

  if (error === 'offline') return <Offline onRetry={load} />;
  if (error) return <Failed text={error} onRetry={load} />;
  if (!data) return <Loading what="Стая" />;
  if (data.ranking.length === 0) {
    return <Empty text="В стае пока никого. Позови людей в чат." />;
  }

  const max = Math.max(1, ...data.ranking.map((r) => r.weekly));

  return (
    <>
      <div className="stats">
        <Stat label="Твоё место" value={data.myPosition || '—'} />
        <Stat label="В стае" value={data.totalInFlock} />
        <Stat label="Окно" value={`${data.windowDays} дн`} />
      </div>

      <div className={`tree ${data.ranking.length === 1 ? 'tree--solo' : ''}`}>
        {data.ranking.map((m, i) => (
          <button
            type="button"
            key={m.userId}
            className={`branch ${m.isMe ? 'branch--me' : ''} ${i % 2 ? 'branch--right' : ''}`}
            disabled={m.isMe}
            onClick={() => {
              haptic('tap');
              if (m.isMe) return;
              void api
                .visit(m.userId)
                .then(() => onToast('Отметился в чужом гнезде', 'ok'))
                .catch((e) => {
                  haptic('fail');
                  onToast(
                    e instanceof OfflineError
                      ? 'Нет связи'
                      : e instanceof ApiError
                        ? e.message
                        : 'Не получилось зайти в гнездо',
                    'bad',
                  );
                });
            }}
          >
            <div className="branch__line" />
            <div className="branch__nest">
              <Bird role={m.role} palette={m.palette} size={54} alive={false} />
            </div>
            <div className="branch__info">
              <div className="branch__name">
                {m.isMe ? 'ты' : m.birdName || (m.username ? `@${m.username}` : `#${m.userId}`)}
              </div>
              <div className="branch__role muted">
                #{m.position} · {m.roleTitle ?? '—'}
                {m.signals > 0 && (
                  <span className="branch__signals"> · {m.signals} пер.</span>
                )}
              </div>
            </div>
            <div className="branch__score">
              <div className="branch__bar" style={{ width: `${(m.weekly / max) * 100}%` }} />
              <span className="branch__num">{m.weekly}</span>
            </div>
          </button>
        ))}
        <div className="tree__trunk" />
      </div>

      <Card>
        <p className="muted small">
          Рейтинг считается за последние {data.windowDays} дней. Прошлые заслуги
          не держат место наверху — падает всё, что перестали кидать.
        </p>
      </Card>
    </>
  );
}
