import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LiveCampaignAction, LiveCampaignBird } from '@kontur/core';
import {
  ApiError,
  OfflineError,
  api,
  authenticate,
  serverNow,
  type LiveCampaignActiveBirdDto,
  type LiveCampaignCardDto,
  type LiveCampaignForecastOption,
  type LiveCampaignLastResultDto,
  type LiveCampaignRaidDto,
  type LiveCampaignSessionDto,
  type LiveCampaignState,
} from '../api.js';
import { V5Bird } from '../components/V5Bird.js';
import {
  LIVE_CAMPAIGN_ACTIONS,
  LIVE_CAMPAIGN_BIRDS,
  LIVE_CAMPAIGN_PRETEST,
  LIVE_CAMPAIGN_SECTOR_LABEL,
  formatLiveCampaignCountdown,
  liveCampaignActionMeta,
  liveCampaignBirdMeta,
  secondsUntilLiveCampaignClose,
} from '../live-campaign-model.js';
import { haptic, initTelegram } from '../telegram.js';

type ScreenError = 'offline' | string | null;

function eventIdFromLocation(): number | null {
  const value = new URLSearchParams(window.location.search).get('event');
  if (!value || !/^\d+$/.test(value)) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : null;
}

function errorText(error: unknown): string {
  if (error instanceof OfflineError) return 'Нет связи. Игра не записывала ход на устройстве.';
  if (error instanceof ApiError) {
    const reason = typeof error.details?.reason === 'string' ? error.details.reason : null;
    if (reason === 'v5_forecast_phase') return 'Ещё фаза прогнозов — серия откроется чуть позже.';
    if (reason === 'v5_active_bird_required') return 'Сначала выберите активную птицу кампании.';
    if (reason === 'v5_session_start_rejected') return 'Не удалось начать серию. Закройте Mini App и откройте полёт заново.';
    if (reason === 'v5_item_not_owned') return 'Выбранный предмет уже недоступен. Уберите его и начните снова.';
    return error.message;
  }
  return 'Не удалось выполнить действие. Ничего не списано — попробуйте ещё раз.';
}

function stateStatus(state: LiveCampaignState): { text: string; tone: 'quiet' | 'warning' | 'danger' } {
  if (!state.event) return { text: 'ожидание окна', tone: 'quiet' };
  if (state.event.status === 'open') return { text: state.event.actionTaken ? 'ход записан' : 'окно открыто', tone: 'warning' };
  if (state.event.status === 'locked') return { text: 'подводим итог', tone: 'warning' };
  if (state.event.status === 'resolved') return { text: 'итог готов', tone: 'quiet' };
  return { text: 'следующее окно', tone: 'quiet' };
}

function sectorCrownLabel(sectorId: number): string {
  const names = ['Нижняя крона', 'Левая ветвь', 'Средняя крона', 'Правая ветвь', 'Верхняя крона', 'Дупло', 'Корни'];
  return names[sectorId] ?? `Сектор ${sectorId + 1}`;
}

function raidGlanceCount(raid: LiveCampaignRaidDto): string {
  return raid.members < 4 ? `${raid.members}/4` : `${raid.members}/6`;
}

function worldEffectCopy(result: LiveCampaignLastResultDto, action: LiveCampaignAction | null): { title: string; detail: string } {
  if (result.contribution === 0) {
    return {
      title: 'Удар не прошёл',
      detail: action === 'hold'
        ? 'Ветка осталась без твоего щита. Дерево общее — завтра можно снова.'
        : 'Вклад слабый. Крона не изменилась от этого хода.',
    };
  }
  if (action === 'hold') {
    return {
      title: result.contribution === 2 ? 'Щит держит ветку' : 'Щит частично встал',
      detail: 'Туча над сектором слабеет. Ward виден всем, кто откроет крону.',
    };
  }
  if (action === 'claim') {
    return {
      title: result.contribution === 2 ? 'Путь закреплён' : 'Путь чуть открылся',
      detail: 'Сектор меняет состояние на общем дереве.',
    };
  }
  if (action === 'scout') {
    return {
      title: result.contribution === 2 ? 'Соседний путь раскрыт' : 'Крона чуть виднее',
      detail: 'Риск или соседний сектор становится яснее для стаи.',
    };
  }
  return {
    title: result.contribution === 2 ? 'Крона приняла удар' : 'Слабый след на кроне',
    detail: `${result.sectorProgress}/${result.threshold} общей шкалы сектора.`,
  };
}

/**
 * V5 never falls back to a local game. If the campaign cannot be loaded, the
 * player sees an explicit explanation instead of a tempting but non-recorded
 * demo state.
 */
export function LiveCampaign() {
  const requestedEventId = useMemo(eventIdFromLocation, []);
  const [state, setState] = useState<LiveCampaignState | null>(null);
  const [session, setSession] = useState<LiveCampaignSessionDto | null>(null);
  const [fatal, setFatal] = useState<ScreenError>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busyRef = useRef(false);

  const boot = useCallback(async () => {
    setFatal(null);
    setNotice(null);
    setState(null);
    setSession(null);
    try {
      await authenticate('campaign-v5');
      const next = await api.liveCampaignState(requestedEventId ?? undefined);
      setState(next);
      setSession(next.session);
    } catch (error) {
      setFatal(error instanceof OfflineError ? 'offline' : errorText(error));
    }
  }, [requestedEventId]);

  useEffect(() => {
    initTelegram();
    void boot();
  }, [boot]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      api.liveCampaignState(requestedEventId ?? undefined)
        .then((next) => {
          setState(next);
          setSession(next.session);
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [requestedEventId]);

  const run = useCallback(async <T,>(key: string, action: () => Promise<T>, apply: (payload: T) => void): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(key);
    setNotice(null);
    haptic('tap');
    try {
      const payload = await action();
      apply(payload);
      haptic('ok');
      return payload;
    } catch (error) {
      setNotice(errorText(error));
      haptic('fail');
      return undefined;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, []);

  if (fatal === 'offline') return <CampaignShell><Failure title="Нет связи" detail="Откройте личную ссылку из Telegram, когда соединение вернётся." onRetry={boot} /></CampaignShell>;
  if (fatal) return <CampaignShell><Failure title="Крона пока недоступна" detail={fatal} onRetry={boot} /></CampaignShell>;
  if (!state) return <CampaignShell><Loading /></CampaignShell>;

  if (!requestedEventId) {
    return (
      <CampaignShell>
        <section className="v5-card v5-stack" aria-live="polite">
          <span className="v5-kicker">Личный вход</span>
          <h1 className="v5-title">Ждём приглашение к кроне</h1>
          <p className="v5-subtitle">Откройте кнопку из личного сообщения «Контура». В ней есть ID окна — без него игра не выбирает чужой чат.</p>
          <button className="v5-button v5-button--ghost" type="button" onClick={() => void boot()}>Проверить снова</button>
        </section>
      </CampaignShell>
    );
  }

  if (!state.profile) {
    return (
      <CampaignShell>
        <Topbar state={state} />
        <Notice text={notice} />
        <Pretest
          eventId={requestedEventId}
          busy={busy}
          onSave={(answers) => run('pretest', () => api.saveLiveCampaignPretest(requestedEventId, answers), (payload) => setState(payload.state))}
        />
      </CampaignShell>
    );
  }

  if (!state.activeBird) {
    return (
      <CampaignShell>
        <Topbar state={state} />
        <Notice text={notice} />
        <BirdChoice
          state={state}
          eventId={requestedEventId}
          busy={busy}
          onChoose={(bird) => run('bird', () => api.chooseLiveCampaignBird(requestedEventId, bird), (payload) => setState(payload.state))}
        />
      </CampaignShell>
    );
  }

  const activeSession = session ?? state.session;
  if (activeSession) {
    return (
      <CampaignShell>
        <Topbar state={state} />
        <Notice text={notice} />
        <CampaignQuiz
          session={activeSession}
          busy={busy}
          onSubmit={async (answers) => Boolean(await run('submit', () => api.submitLiveCampaignSession(activeSession.eventId, answers), (payload) => {
            setState(payload.state);
            setSession(null);
          }))}
        />
      </CampaignShell>
    );
  }

  return (
    <CampaignShell>
      <Topbar state={state} />
      <Notice text={notice} />
      <CampaignBoard
        state={state}
        requestedEventId={requestedEventId}
        busy={busy}
        onStart={(input) => run('start', () => api.startLiveCampaignSession(input), (payload) => {
          setState(payload.state);
          setSession(payload.session);
        })}
        onForecast={(eventId, sectorId, action, prediction) => run('forecast', () => api.saveLiveCampaignForecast(eventId, sectorId, action, prediction), (payload) => setState(payload.state))}
        onRaid={(eventId, sectorId, action) => run('raid', () => api.joinLiveCampaignRaid(eventId, sectorId, action), (payload) => setState(payload.state))}
        onRaidStart={(eventId) => run('raid-start', () => api.startLiveCampaignRaid(eventId), (payload) => setState(payload.state))}
        onRaidSubmit={async (eventId, answers) => Boolean(await run('raid-submit', () => api.submitLiveCampaignRaid(eventId, answers), (payload) => setState(payload.state)))}
        onMolt={(eventId, sourceBird, targetBird) => run('molt', () => api.moltLiveCampaignBird(eventId, sourceBird, targetBird), (payload) => setState(payload.state))}
      />
    </CampaignShell>
  );
}

function CampaignShell({ children }: { children: ReactNode }) {
  return <main className="v5-shell"><div className="v5-main">{children}</div></main>;
}

function Topbar({ state }: { state: LiveCampaignState }) {
  const status = stateStatus(state);
  return (
    <header className="v5-topbar">
      <span className="v5-wordmark">КОНТУР</span>
      <div className={`v5-status v5-status--${status.tone}`}>{status.text}</div>
    </header>
  );
}

function Loading() {
  return (
    <section className="v5-loading" aria-live="polite">
      <div className="v5-loading__crown" aria-hidden="true" />
      <span className="v5-kicker">Крона</span>
      <h1 className="v5-title">Дерево в тумане</h1>
      <p className="v5-subtitle">Открываем твоё окно у живой кроны.</p>
    </section>
  );
}

function Failure({ title, detail, onRetry }: { title: string; detail: string; onRetry(): void }) {
  return (
    <section className="v5-card v5-stack">
      <span className="v5-kicker">Крона</span>
      <h1 className="v5-title">{title}</h1>
      <p className="v5-error" role="alert">{detail}</p>
      <button className="v5-button v5-button--primary" type="button" onClick={() => void onRetry()}>Повторить вход</button>
    </section>
  );
}

function Notice({ text }: { text: string | null }) {
  return text ? <p className="v5-error" role="alert">{text}</p> : null;
}

function Pretest({
  eventId,
  busy,
  onSave,
}: {
  eventId: number;
  busy: string | null;
  onSave(answers: LiveCampaignBird[]): void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<LiveCampaignBird[]>([]);
  const question = LIVE_CAMPAIGN_PRETEST[index]!;

  const choose = (bird: LiveCampaignBird) => {
    if (busy) return;
    const next = [...answers, bird];
    if (next.length === LIVE_CAMPAIGN_PRETEST.length) onSave(next);
    else {
      setAnswers(next);
      setIndex((value) => value + 1);
      haptic('tap');
    }
  };

  return (
    <section className="v5-card v5-card--paper v5-stack" aria-labelledby="v5-pretest-title">
      <div className="v5-card__head">
        <div>
          <span className="v5-kicker">Претест · {index + 1}/6</span>
          <h1 className="v5-title" id="v5-pretest-title">Как собираешь решение?</h1>
        </div>
        <span className="v5-card__meta">окно {eventId}</span>
      </div>
      <div className="v5-progress" aria-label={`Вопрос ${index + 1} из 6`}>
        {LIVE_CAMPAIGN_PRETEST.map((item, itemIndex) => <i key={item.id} className={itemIndex < index ? 'is-done' : itemIndex === index ? 'is-current' : ''} />)}
      </div>
      <h2 className="v5-title">{question.prompt}</h2>
      <div className="v5-choice-grid">
        {question.options.map((option, optionIndex) => (
          <button className="v5-choice" type="button" key={option.bird} disabled={Boolean(busy)} onClick={() => choose(option.bird)}>
            <span className="v5-choice__mark">{String.fromCharCode(65 + optionIndex)}</span>
            <span className="v5-choice__copy"><strong className="v5-choice__title">{option.text}</strong></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BirdChoice({
  state,
  eventId,
  busy,
  onChoose,
}: {
  state: LiveCampaignState;
  eventId: number;
  busy: string | null;
  onChoose(bird: LiveCampaignBird): void;
}) {
  const baseBird = state.profile?.baseBird ?? state.birds[0]?.bird;
  const hero = state.birds.find((bird) => bird.bird === baseBird) ?? state.birds[0];
  if (!hero) return null;
  const meta = liveCampaignBirdMeta(hero.bird);
  const others = state.birds.filter((bird) => bird.bird !== hero.bird);

  return (
    <section className="v5-stack">
      <article className="v5-reveal">
        <div className="v5-reveal__bird">
          <V5Bird bird={hero.bird} form={hero.form === 2 ? 'advanced' : 'base'} state="ready" size={132} />
        </div>
        <span className="v5-kicker">Ты — {meta.title}</span>
        <h1 className="v5-reveal__phrase">{meta.note}</h1>
        <p className="v5-subtitle">Одна активная птица на кампанию. После первого хода выбор запирается.</p>
        <button className="v5-button v5-button--primary v5-button--wide" type="button" disabled={Boolean(busy)} onClick={() => onChoose(hero.bird)}>
          {busy === 'bird' ? 'Фиксируем…' : `Идти как ${meta.title}`}
        </button>
      </article>
      {others.length > 0 && (
        <details className="v5-details">
          <summary>Другие открытые формы</summary>
          <div className="v5-choice-grid">
            {others.map((bird) => {
              const birdMeta = liveCampaignBirdMeta(bird.bird);
              return (
                <button className="v5-choice" type="button" key={bird.bird} disabled={Boolean(busy)} onClick={() => onChoose(bird.bird)}>
                  <span className="v5-choice__mark">{birdMeta.mark}</span>
                  <span className="v5-choice__copy">
                    <strong className="v5-choice__title">{birdMeta.title}</strong>
                    <span className="v5-choice__text">{birdMeta.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </details>
      )}
      <span className="v5-card__meta">окно {eventId}</span>
    </section>
  );
}

function CampaignBoard({
  state,
  requestedEventId,
  busy,
  onStart,
  onForecast,
  onRaid,
  onRaidStart,
  onRaidSubmit,
  onMolt,
}: {
  state: LiveCampaignState;
  requestedEventId: number;
  busy: string | null;
  onStart(input: { eventId: number; sectorId: number; action: LiveCampaignAction; itemId?: number; useSignature?: boolean }): void;
  onForecast(eventId: number, sectorId: number, action: LiveCampaignAction, prediction: 'sector_resolves' | 'sector_misses'): void;
  onRaid(eventId: number, sectorId: number, action: LiveCampaignAction): void;
  onRaidStart(eventId: number): void;
  onRaidSubmit(eventId: number, answers: number[]): Promise<boolean>;
  onMolt(eventId: number, sourceBird: LiveCampaignBird, targetBird: LiveCampaignBird): void;
}) {
  const activeBird = state.activeBird!;
  // Never redirect a deep-link session into another event just because the
  // server opened a newer window while the Mini App was in the background.
  const event = state.event?.id === requestedEventId ? state.event : null;
  const eventMismatch = state.event !== null && event === null;
  const [selectedItemId, setSelectedItemId] = useState<number | undefined>(undefined);
  const [useSignature, setUseSignature] = useState(false);
  const [raidOpen, setRaidOpen] = useState(false);
  const objective = event?.objective ?? null;

  useEffect(() => {
    if (!selectedItemId || state.inventory.some((item) => item.id === selectedItemId && item.status === 'owned' && (!objective || objective.itemKinds.includes(item.kind)))) return;
    setSelectedItemId(undefined);
  }, [objective, selectedItemId, state.inventory]);

  const forecastPhase = Boolean(event && serverNow().getTime() < new Date(event.forecastDeadline).getTime());
  const canStart = Boolean(event && event.id === requestedEventId && event.status === 'open' && !event.actionTaken && objective && !forecastPhase);
  const meta = liveCampaignBirdMeta(activeBird.bird);
  const actionMeta = objective ? liveCampaignActionMeta(objective.action) : null;
  const threatenedSector = objective?.sectorId ?? state.sectors.find((sector) => sector.state === 'exposed')?.id ?? state.sectors[0]?.id ?? null;
  const threatened = threatenedSector === null ? null : state.sectors.find((sector) => sector.id === threatenedSector) ?? null;
  const ownedItems = objective
    ? state.inventory.filter((item) => item.status === 'owned' && objective.itemKinds.includes(item.kind))
    : state.inventory.filter((item) => item.status === 'owned');
  const showForecast = Boolean(event && forecastPhase && (state.eggs >= 1 || state.forecast));
  const lastAction = event?.actionTaken && objective ? objective.action : null;

  if (event?.raid?.cards && event.raid.closeAt) {
    return (
      <CampaignQuiz
        session={{ id: event.raid.id, eventId: event.id, sectorId: event.raid.sectorId, action: event.raid.action, closeAt: event.raid.closeAt, cards: event.raid.cards }}
        busy={busy === 'raid-submit' ? 'raid-submit' : busy}
        label="Рейд"
        onSubmit={(answers) => onRaidSubmit(event.id, answers)}
      />
    );
  }

  return (
    <section className="v5-stack v5-home">
      <article className="v5-crown-home" aria-labelledby="v5-home-title">
        <div className="v5-crown-home__sky" aria-hidden="true" />
        <div className="v5-crown-home__row">
          <div className="v5-crown-home__copy">
            <span className="v5-kicker">{meta.title} · день {state.campaign.day}/28</span>
            <h1 className="v5-crown-home__title" id="v5-home-title">
              {objective
                ? `${sectorCrownLabel(objective.sectorId)} под угрозой`
                : eventMismatch
                  ? 'Это окно уже сменилось'
                  : event
                    ? 'Крона ждёт следующее окно'
                    : 'Сейчас нет открытого окна'}
            </h1>
            <p className="v5-subtitle">
              {objective
                ? objective.label
                : eventMismatch
                  ? 'Вернитесь к личной кнопке из нужного поста. Ход не перейдёт в другое событие сам.'
                  : event
                    ? 'Карта доступна, новые серии появятся, когда сервер откроет окно.'
                    : 'Три окна в неделю создаются на сервере. Локальной серии без записи не будет.'}
            </p>
            {threatened && (
              <div className="v5-crown-home__sector">
                <span>{LIVE_CAMPAIGN_SECTOR_LABEL[threatened.state]}</span>
                <span>{threatened.progress}/{threatened.threshold}{threatened.ward ? ' · ward' : ''}</span>
              </div>
            )}
          </div>
          <div className="v5-crown-home__bird">
            <V5Bird
              bird={activeBird.bird}
              form={activeBird.form === 2 ? 'advanced' : 'base'}
              state={event?.status === 'open' && !event.actionTaken ? 'ready' : state.lastResult?.contribution === 2 ? 'victory' : 'idle'}
              size={108}
            />
          </div>
        </div>

        {event?.status === 'open' && !event.actionTaken && objective && actionMeta ? (
          <div className="v5-crown-home__cta">
            {forecastPhase ? (
              <p className="v5-callout v5-callout--coral">Фаза прогнозов. Серия откроется после её закрытия.</p>
            ) : null}
            <button
              className="v5-button v5-button--primary v5-button--wide v5-button--gesture"
              type="button"
              disabled={!canStart || Boolean(busy)}
              onClick={() => {
                if (!event || !objective) return;
                onStart({ eventId: event.id, sectorId: objective.sectorId, action: objective.action, itemId: selectedItemId, useSignature });
              }}
            >
              {busy === 'start' ? 'Фиксируем ход…' : forecastPhase ? 'Серия после прогнозов' : actionMeta.gesture}
            </button>
            <p className="v5-crown-home__hint">~75 сек на ветке · соло достаточно</p>
          </div>
        ) : event ? (
          <p className="v5-callout">
            {event.actionTaken
              ? 'Ход окна уже сделан. Крона сохранила твой след.'
              : event.status === 'scheduled'
                ? 'Окно ещё не открыто.'
                : event.status === 'locked'
                  ? 'Сервер закрывает шкалы сектора.'
                  : event.status === 'resolved'
                    ? 'Итог зафиксирован. Следующий ход — в новом окне.'
                    : 'Это окно пока не принимает новые ходы.'}
          </p>
        ) : null}

        {event?.storm && (
          <p className="v5-crown-home__storm">
            {event.storm.revealed && event.storm.targetSector !== null
              ? `Шторм над ${sectorCrownLabel(event.storm.targetSector)}.`
              : 'Скрытый шторм в этом окне. Разведка может раскрыть сектор.'}
          </p>
        )}
      </article>

      {state.lastResult && <Result result={state.lastResult} action={lastAction} />}

      {showForecast && event && (
        <Forecast
          eventId={event.id}
          eggs={state.eggs}
          forecast={state.forecast}
          options={event.forecastOptions}
          disabled={Boolean(busy) || event.status !== 'open'}
          onForecast={onForecast}
        />
      )}

      {event?.raid && (
        <QuietCall
          eventId={event.id}
          raid={event.raid}
          open={raidOpen}
          onToggle={() => setRaidOpen((value) => !value)}
          disabled={Boolean(busy)}
          onJoin={onRaid}
          onStart={onRaidStart}
        />
      )}

      {(ownedItems.length > 0 || activeBird.signatureAvailable) && event?.status === 'open' && !event.actionTaken && (
        <details className="v5-details">
          <summary>Перед серией · необязательно</summary>
          {ownedItems.length > 0 && (
            <InventoryPicker inventory={ownedItems} selectedItemId={selectedItemId} disabled={Boolean(busy) || forecastPhase} onSelect={setSelectedItemId} />
          )}
          {activeBird.signatureAvailable && (
            <button className={`v5-choice ${useSignature ? 'is-selected' : ''}`} type="button" disabled={Boolean(busy) || forecastPhase} onClick={() => setUseSignature((value) => !value)}>
              <span className="v5-choice__mark">+1</span>
              <span className="v5-choice__copy">
                <strong className="v5-choice__title">Манёвр формы II</strong>
                <span className="v5-choice__text">Один раз за кампанию; только личная шкала.</span>
              </span>
            </button>
          )}
        </details>
      )}

      {state.sectors.length > 0 && (
        <details className="v5-details">
          <summary>Семь секторов кроны</summary>
          <TreeMap sectors={state.sectors} selectedSector={threatenedSector ?? 0} />
        </details>
      )}

      {event && <Molt eventId={event.id} birds={state.birds} activeBird={activeBird} disabled={Boolean(busy)} onMolt={onMolt} />}
    </section>
  );
}

function TreeMap({
  sectors,
  selectedSector,
}: {
  sectors: LiveCampaignState['sectors'];
  selectedSector: number;
}) {
  return (
    <div className="v5-map" aria-label="Карта кроны">
      {sectors.map((sector) => (
        <div
          className={`v5-map__node v5-map__node--${sector.state} ${selectedSector === sector.id ? 'is-selected' : ''}`}
          key={sector.id}
          aria-label={`${sectorCrownLabel(sector.id)}, ${LIVE_CAMPAIGN_SECTOR_LABEL[sector.state]}`}
        >
          <span className="v5-map__num">{sector.id + 1}</span>
          <span className="v5-map__state">{LIVE_CAMPAIGN_SECTOR_LABEL[sector.state]}</span>
        </div>
      ))}
    </div>
  );
}

function InventoryPicker({
  inventory,
  selectedItemId,
  disabled,
  onSelect,
}: {
  inventory: LiveCampaignState['inventory'];
  selectedItemId: number | undefined;
  disabled: boolean;
  onSelect(value: number | undefined): void;
}) {
  if (inventory.length === 0) return null;
  return (
    <div className="v5-stack v5-stack--tight">
      <div className="v5-row v5-row--between"><span className="v5-label">Предмет</span><span className="v5-card__meta">по желанию</span></div>
      <div className="v5-inventory">
        {inventory.slice(0, 3).map((item) => (
          <button
            className={`v5-inventory__slot ${selectedItemId === item.id ? 'is-armed' : ''}`}
            type="button"
            key={item.id}
            disabled={disabled}
            onClick={() => onSelect(selectedItemId === item.id ? undefined : item.id)}
          >
            <span className="v5-inventory__icon">{item.kind === 'lens' ? '◉' : item.kind === 'nest-resin' ? '▣' : item.kind === 'signal-thread' ? '⌁' : '✦'}</span>
            <strong className="v5-inventory__name">{item.name}</strong>
            <span className="v5-inventory__detail">{item.effect}</span>
            {selectedItemId === item.id && <i className="v5-inventory__armed">ВЗЯТ</i>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Forecast({
  eventId,
  eggs,
  forecast,
  options,
  disabled,
  onForecast,
}: {
  eventId: number;
  eggs: number;
  forecast: LiveCampaignState['forecast'];
  options: LiveCampaignForecastOption[];
  disabled: boolean;
  onForecast(eventId: number, sectorId: number, action: LiveCampaignAction, prediction: 'sector_resolves' | 'sector_misses'): void;
}) {
  if (forecast) {
    return (
      <article className="v5-forecast v5-forecast--compact">
        <span className="v5-kicker">Яйцо на кроне</span>
        <p className="v5-forecast__copy">Сектор {forecast.sectorId + 1} · {liveCampaignActionMeta(forecast.action).title.toLowerCase()} · {forecast.status}</p>
      </article>
    );
  }
  if (options.length === 0 || eggs < 1) return null;
  return (
    <article className="v5-forecast v5-forecast--compact">
      <div className="v5-card__head">
        <div>
          <span className="v5-kicker">Поставить яйцо</span>
          <h2 className="v5-card__title">Тихий прогноз</h2>
        </div>
        <span className="v5-card__meta">{eggs}</span>
      </div>
      <p className="v5-forecast__copy">Необязательно. Соло-ход от этого не зависит.</p>
      <div className="v5-forecast__options">
        {options.flatMap((option) => [
          <button className="v5-forecast__option" type="button" key={`${option.sectorId}:${option.action}:yes`} disabled={disabled} onClick={() => onForecast(eventId, option.sectorId, option.action, 'sector_resolves')}>
            <strong>{option.label} · успеет</strong>
          </button>,
          <button className="v5-forecast__option" type="button" key={`${option.sectorId}:${option.action}:no`} disabled={disabled} onClick={() => onForecast(eventId, option.sectorId, option.action, 'sector_misses')}>
            <strong>{option.label} · не успеет</strong>
          </button>,
        ])}
      </div>
    </article>
  );
}

function QuietCall({
  eventId,
  raid,
  open,
  onToggle,
  disabled,
  onJoin,
  onStart,
}: {
  eventId: number;
  raid: LiveCampaignRaidDto;
  open: boolean;
  onToggle(): void;
  disabled: boolean;
  onJoin(eventId: number, sectorId: number, action: LiveCampaignAction): void;
  onStart(eventId: number): void;
}) {
  const count = raidGlanceCount(raid);
  return (
    <aside className={`v5-quiet-call ${open ? 'is-open' : ''}`}>
      <button className="v5-quiet-call__glance" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="v5-quiet-call__mark" aria-hidden="true" />
        <span className="v5-quiet-call__label">Тихий зов · {count}</span>
        <span className="v5-quiet-call__hint">{open ? 'свернуть' : 'необязательно'}</span>
      </button>
      {open && (
        <div className="v5-quiet-call__sheet">
          <p className="v5-subtitle">Рейд не обязателен. Соло-ход уже доступен. Очередь растворится без наказания, если не наберётся 4.</p>
          <div className="v5-raid__queue" aria-label={`Очередь: ${raid.members} из 6`}>
            {Array.from({ length: 6 }, (_, index) => (
              <span className={`v5-raid__member ${index < raid.members ? '' : 'v5-raid__member--open'}`} key={index}>
                {index < raid.members ? index + 1 : '+'}
              </span>
            ))}
          </div>
          <div className="v5-role-row">
            {LIVE_CAMPAIGN_ACTIONS.map((action) => (
              <span className={`v5-role-chip ${raid.roles[action.id] ? 'is-covered' : ''}`} key={action.id}>{action.title}</span>
            ))}
          </div>
          <div className="v5-actions">
            <button
              className="v5-button v5-button--ghost"
              type="button"
              disabled={disabled || raid.status === 'dissolved' || raid.status === 'resolved' || (raid.joined && raid.status !== 'ready')}
              onClick={() => (raid.joined && raid.status === 'ready' ? onStart(eventId) : onJoin(eventId, raid.sectorId, raid.action))}
            >
              {raid.joined && raid.status === 'ready'
                ? 'Начать рейд'
                : raid.joined
                  ? 'Уже в очереди'
                  : raid.status === 'ready'
                    ? 'Состав готов'
                    : raid.status === 'dissolved'
                      ? 'Растворился'
                      : raid.status === 'resolved'
                        ? 'Завершён'
                        : 'Встать в очередь'}
            </button>
            <button className="v5-button v5-button--ghost" type="button" onClick={onToggle}>Позже</button>
          </div>
        </div>
      )}
    </aside>
  );
}

function Molt({
  eventId,
  birds,
  activeBird,
  disabled,
  onMolt,
}: {
  eventId: number;
  birds: LiveCampaignState['birds'];
  activeBird: LiveCampaignActiveBirdDto;
  disabled: boolean;
  onMolt(eventId: number, sourceBird: LiveCampaignBird, targetBird: LiveCampaignBird): void;
}) {
  const sources = birds.filter((bird) => bird.form === 1 && bird.feathers >= 8);
  if (sources.length === 0) return null;
  return (
    <article className="v5-card v5-stack">
      <div>
        <span className="v5-kicker">Линька</span>
        <h2 className="v5-card__title">Восемь перьев собраны</h2>
        <p className="v5-subtitle">Улучшите птицу или откройте новую во II форме. Выбор необратим.</p>
      </div>
      {sources.map((source) => {
        const targets = LIVE_CAMPAIGN_BIRDS.filter((bird) => bird.id === source.bird || !birds.some((owned) => owned.bird === bird.id));
        return (
          <div className="v5-stack v5-stack--tight" key={source.bird}>
            <span className="v5-label">Источник · {liveCampaignBirdMeta(source.bird).title}</span>
            <div className="v5-actions">
              {targets.map((target) => (
                <button className="v5-button v5-button--ghost" type="button" disabled={disabled} key={target.id} onClick={() => onMolt(eventId, source.bird, target.id)}>
                  {target.id === source.bird ? `${target.title} · форма II` : `Открыть ${target.title}`}
                </button>
              ))}
            </div>
            {activeBird.bird === source.bird && <span className="v5-card__meta">текущая птица останется активной до следующей кампании</span>}
          </div>
        );
      })}
    </article>
  );
}

function Result({ result, action }: { result: LiveCampaignLastResultDto; action: LiveCampaignAction | null }) {
  const effect = worldEffectCopy(result, action);
  return (
    <article className="v5-payoff" aria-live="polite">
      <span className="v5-kicker">На кроне</span>
      <h2 className="v5-payoff__world">{effect.title}</h2>
      <p className="v5-subtitle">{effect.detail}</p>
      <div className="v5-payoff__rewards">
        <span>{result.featherAwarded ? '+1 перо пути' : 'перо не добавилось'}</span>
        {result.itemAwarded ? <span>предмет: {result.itemAwarded}</span> : null}
        <span className="v5-payoff__nums">{result.sectorProgress}/{result.threshold} · вклад {result.contribution}</span>
      </div>
    </article>
  );
}

function CampaignQuiz({
  session,
  busy,
  onSubmit,
  label = 'Серия',
}: {
  session: LiveCampaignSessionDto;
  busy: string | null;
  onSubmit(answers: number[]): Promise<boolean>;
  label?: string;
}) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [now, setNow] = useState(() => serverNow().getTime());
  const [submitFailed, setSubmitFailed] = useState(false);
  const submitted = useRef(false);
  const seconds = secondsUntilLiveCampaignClose(session.closeAt, now);
  const index = Math.min(answers.length, session.cards.length - 1);
  const card = session.cards[index];
  const gesture = liveCampaignActionMeta(session.action).gesture;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow().getTime()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const submit = useCallback((next: number[]) => {
    if (submitted.current) return;
    submitted.current = true;
    void onSubmit(next).then((accepted) => {
      if (accepted) return;
      submitted.current = false;
      setSubmitFailed(true);
    });
  }, [onSubmit]);

  useEffect(() => {
    if (seconds > 0 || submitted.current || submitFailed) return;
    submit([...answers, ...Array(Math.max(0, session.cards.length - answers.length)).fill(-1)]);
  }, [answers, seconds, session.cards.length, submit, submitFailed]);

  if (!card) return <section className="v5-card v5-error">Серия не содержит карточек. Обновите игру — сервер не создал локальный заменитель.</section>;

  const choose = (answer: number) => {
    if (busy || submitted.current || seconds <= 0) return;
    const next = [...answers, answer];
    setAnswers(next);
    haptic('tap');
    if (next.length === session.cards.length) submit(next);
  };

  return (
    <section className="v5-quiz v5-quiz--branch" aria-labelledby="v5-quiz-title">
      <div className="v5-quiz__branch-sky" aria-hidden="true" />
      <div className="v5-quiz__meta">
        <span className="v5-quiz__counter">{label === 'Рейд' ? 'РЕЙД' : 'НА ВЕТКЕ'} · {index + 1}/{session.cards.length}</span>
        <strong className={`v5-quiz__timer ${seconds <= 15 ? 'is-danger' : ''}`}>{formatLiveCampaignCountdown(seconds)}</strong>
      </div>
      <div className="v5-progress" aria-label={`Карточка ${index + 1} из ${session.cards.length}`}>
        {session.cards.map((item, itemIndex) => <i key={item.id} className={itemIndex < index ? 'is-done' : itemIndex === index ? 'is-current' : ''} />)}
      </div>
      <span className="v5-kicker">{cardKindLabel(card)} · {sectorCrownLabel(session.sectorId)}</span>
      <h1 className="v5-quiz__question" id="v5-quiz-title">{card.prompt}</h1>
      {card.hint && <p className="v5-quiz__hint">{card.hint}</p>}
      <div className="v5-quiz__options">
        {card.options.map((option, optionIndex) => (
          <button className="v5-quiz__option" type="button" disabled={Boolean(busy) || seconds <= 0} key={`${card.id}:${optionIndex}`} onClick={() => choose(optionIndex)}>
            <b>{String.fromCharCode(65 + optionIndex)}</b>
            <span>{option}</span>
          </button>
        ))}
      </div>
      <p className="v5-callout">
        {label === 'Рейд'
          ? 'Рейд даёт предмет или маршрут и не добавляет второй соло-ход.'
          : `Жест окна: ${gesture}. Таймер закрывает позднюю попытку, очки за скорость не даёт.`}
      </p>
      {busy === 'submit' && <p className="v5-card__meta">Сервер проверяет серию…</p>}
      {submitFailed && (
        <button
          className="v5-button v5-button--ghost"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            setSubmitFailed(false);
            submit([...answers, ...Array(Math.max(0, session.cards.length - answers.length)).fill(-1)]);
          }}
        >
          Повторить отправку этой серии
        </button>
      )}
    </section>
  );
}

function cardKindLabel(card: LiveCampaignCardDto): string {
  if (card.kind === 'base') return 'Микроскилл';
  if (card.kind === 'track') return 'Путь птицы';
  if (card.kind === 'chain') return 'Развилка';
  if (card.kind === 'tactical') return 'Жест';
  return 'Риск';
}
