import { useEffect, useState } from 'react';
import type {
  GameState,
  NestResponse,
  SignalKind,
  SignalsResponse,
} from '@kontur/contracts';
import { api, ApiError, OfflineError, serverNow } from '../api.js';
import { Bird } from '../components/Bird.js';
import { Button, Card, Empty, Failed, Loading, Offline, Stat } from '../components/ui.js';

interface Props {
  state: GameState;
  busy: string | null;
  onCollectPassive(): void;
}

/**
 * Профиль: птица, окрас, две валюты и гнездо — лента того,
 * кто тебе что кидал и кто заходил.
 */
export function ProfileScreen({ state, busy, onCollectPassive }: Props) {
  const [nest, setNest] = useState<NestResponse | null>(null);
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [nestError, setNestError] = useState<'offline' | string | null>(null);
  const [signalError, setSignalError] = useState<'offline' | string | null>(null);
  const p = state.player;

  const loadNest = () => {
    setNestError(null);
    api.nest()
      .then(setNest)
      .catch((e) => {
        if (e instanceof OfflineError) setNestError('offline');
        else setNestError(e instanceof ApiError ? e.message : 'Не удалось загрузить');
      });
  };

  const loadSignals = () => {
    setSignalError(null);
    api.signals()
      .then(setSignals)
      .catch((e) => {
        if (e instanceof OfflineError) setSignalError('offline');
        else setSignalError(e instanceof ApiError ? e.message : 'Не удалось загрузить');
      });
  };

  useEffect(() => {
    loadNest();
    loadSignals();
  }, []);

  return (
    <>
      <div className="hero">
        <div className="hero__glow" />
        <Bird role={p.role} palette={p.palette} size={184} />
        <div className="hero__meta">
          <div className="hero__role">{p.roleTitle}</div>
          {p.birdName && <div className="hero__name">{p.birdName}</div>}
          <div className="hero__tag">{p.roleTagline}</div>
        </div>
      </div>

      <div className="stats">
        <Stat label="Репутация" value={p.reputation.toLocaleString('ru')} />
        <Stat label="Кошелёк" value={p.wallet.toLocaleString('ru')} />
        <Stat label="Окрас" value={p.coloringTitle} />
      </div>

      <Card
        title="Золотые перья"
        aside={`${signals?.feathers ?? p.signalCount} подтверждено`}
      >
        {signalError === 'offline' ? (
          <Offline onRetry={loadSignals} />
        ) : signalError ? (
          <Failed text={signalError} onRetry={loadSignals} />
        ) : !signals ? (
          <Loading />
        ) : signals.cards.length === 0 ? (
          <p className="muted small signal-empty">
            Их нельзя выбить из яйца. Перо появляется после подтверждённого
            события ЦУ, выполненного кейса или проекта после ревью.
          </p>
        ) : (
          <div className="signals">
            {signals.cards.map((card) => (
              <div className="signal" key={card.id}>
                <i className="signal__feather" aria-hidden="true" />
                <div className="signal__body">
                  <div className="signal__title">{card.title}</div>
                  <div className="signal__meta">
                    {signalKindTitle(card.kind)} ·{' '}
                    {new Date(card.issuedAt).toLocaleDateString('ru')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="muted small">
          Репутация — сколько накидали всего, она только растёт и не тратится.
          Кошелёк — что на руках, его тратишь на яйца.
        </p>
      </Card>

      {state.passive && (
        <Button
          variant={state.passive.available > 0 ? 'primary' : 'ghost'}
          disabled={state.passive.available <= 0}
          busy={busy === 'passive'}
          onClick={onCollectPassive}
        >
          {state.passive.available > 0
            ? `Забрать ${state.passive.available} червяков`
            : 'На сегодня всё'}
        </Button>
      )}

      <Card title="Гнездо" aside={nest ? `+${nest.weeklyReceived} за неделю` : undefined}>
        {nestError === 'offline' ? (
          <Offline onRetry={loadNest} />
        ) : nestError ? (
          <Failed text={nestError} onRetry={loadNest} />
        ) : !nest ? (
          <Loading />
        ) : nest.entries.length === 0 ? (
          <Empty text="Пока пусто. Червяков кидают за полезные сообщения в чате." />
        ) : (
          <div className="feed">
            {nest.entries.map((e, i) => (
              <div key={i} className="feed__row">
                <div className="feed__who">
                  {e.fromUsername ? `@${e.fromUsername}` : `#${e.fromUserId}`}
                </div>
                <div className="feed__what">
                  {e.kind === 'grant' ? (
                    <>
                      <span className="feed__amount">+{e.amount}</span>
                      {e.reason ? (
                        <span className="feed__reason">{e.reason}</span>
                      ) : (
                        <span className="feed__reason muted">без причины</span>
                      )}
                    </>
                  ) : (
                    <span className="feed__reason muted">заходил в гнездо</span>
                  )}
                </div>
                <div className="feed__when">{ago(e.at)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function signalKindTitle(kind: SignalKind): string {
  return {
    cu_event: 'событие ЦУ',
    agency_case: 'выполненный кейс',
    own_project: 'проект после ревью',
  }[kind];
}

function ago(iso: string): string {
  const ms = serverNow().getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}
