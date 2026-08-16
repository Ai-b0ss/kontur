import { useEffect, useState } from 'react';
import type { ColoringsResponse, EggOpenResponse, GameState } from '@kontur/contracts';
import { api, ApiError, OfflineError } from '../api.js';
import { Bird } from '../components/Bird.js';
import { Egg } from '../components/Egg.js';
import { Button, Card, Failed, Loading, Offline, Stat } from '../components/ui.js';
import { haptic, shareToChat } from '../telegram.js';

interface Props {
  state: GameState;
  busy: string | null;
  onOpened(r: EggOpenResponse): void;
  onState(next: GameState): void;
  onError(text: string): void;
}

/**
 * Яйца — гача на внешность. Роль не меняется никогда, только окрас.
 *
 * Редкое выпадение бот объявляет в чат: это бесплатный контент и главный
 * двигатель всей механики.
 */
export function EggsScreen({ state, busy, onOpened, onState, onError }: Props) {
  const [collection, setCollection] = useState<ColoringsResponse | null>(null);
  const [error, setError] = useState<'offline' | string | null>(null);
  const [last, setLast] = useState<EggOpenResponse | null>(null);
  const [cracking, setCracking] = useState(false);

  const load = () => {
    setError(null);
    api
      .colorings()
      .then(setCollection)
      .catch((e) => {
        if (e instanceof OfflineError) setError('offline');
        else setError(e instanceof ApiError ? e.message : 'Не удалось загрузить');
      });
  };

  useEffect(load, []);

  const egg = state.egg;
  if (!egg) return <Loading />;

  const open = async () => {
    if (cracking) return;
    setCracking(true);
    haptic('tap');
    try {
      const [r] = await Promise.all([
        api.openEgg(),
        new Promise((res) => setTimeout(res, 900)),
      ]);
      setLast(r);
      onOpened(r);
      load();
      haptic('ok');
    } catch (e) {
      haptic('fail');
      onError(
        e instanceof OfflineError
          ? 'Нет связи'
          : e instanceof ApiError
            ? e.message
            : 'Не получилось открыть яйцо',
      );
    } finally {
      setCracking(false);
    }
  };

  return (
    <>
      <div className="eggbox">
        {last ? (
          <div className={`eggbox__result eggbox__result--${last.rarity}`}>
            <Bird role={state.player.role} palette={last.palette} size={140} />
            <div className="eggbox__title">{last.coloringTitle}</div>
            <div className="eggbox__rarity">{RARITY[last.rarity]}</div>
            {last.duplicate && (
              <div className="eggbox__dupe muted small">
                Уже был — вернули {last.refund}
              </div>
            )}
            {last.shareText && (
              <button
                className="btn btn--ghost btn--inline"
                onClick={() => shareToChat(last.shareText!)}
              >
                Похвастаться
              </button>
            )}
          </div>
        ) : (
          <Egg cracks={cracking ? 6 : 2} mood={cracking ? 'nudge' : 'idle'} size={150} />
        )}
      </div>

      <div className="stats">
        <Stat label="Кошелёк" value={state.player.wallet.toLocaleString('ru')} />
        <Stat label="Яйцо" value={egg.cost} />
        <Stat label="Собрано" value={`${egg.owned} из ${egg.total}`} />
      </div>

      <Button
        variant="primary"
        disabled={!egg.affordable}
        busy={busy === 'egg' || cracking}
        onClick={open}
      >
        {egg.affordable ? `Разбить яйцо · ${egg.cost}` : `Нужно ${egg.cost} червяков`}
      </Button>

      <Card title="Коллекция">
        {error === 'offline' ? (
          <Offline onRetry={load} />
        ) : error ? (
          <Failed text={error} onRetry={load} />
        ) : !collection ? (
          <Loading />
        ) : (
          <div className="collection">
            {collection.colorings.map((c) => (
              <button
                key={c.code}
                className={`swatch swatch--${c.rarity} ${c.owned ? '' : 'swatch--locked'} ${
                  c.equipped ? 'swatch--on' : ''
                }`}
                disabled={!c.owned}
                onClick={() => {
                  haptic('tap');
                  void api
                    .equip(c.code)
                    .then((r) => {
                      onState(r.state);
                      load();
                    })
                    .catch((e) => {
                      haptic('fail');
                      onError(
                        e instanceof OfflineError
                          ? 'Нет связи'
                          : e instanceof ApiError
                            ? e.message
                            : 'Не получилось надеть окрас',
                      );
                    });
                }}
              >
                <span
                  className="swatch__dot"
                  style={{
                    background: c.owned
                      ? `linear-gradient(135deg, ${c.palette.body}, ${c.palette.wing})`
                      : undefined,
                  }}
                />
                <span className="swatch__name">{c.owned ? c.title : '···'}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

const RARITY: Record<string, string> = {
  common: 'обычный',
  rare: 'редкий',
  legendary: 'легендарный',
};
