import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@kontur/core';
import type { ExperienceV2State, GameState, Palette, RestoredExperienceState } from '@kontur/contracts';
import { ApiError, OfflineError, api, authenticate } from './api.js';
import { haptic, initTelegram, isInsideTelegram } from './telegram.js';
import { Card, Failed, Loading, Offline, Stat } from './components/ui.js';
import { Onboarding } from './screens/Onboarding.js';
import { ProfileScreen } from './screens/Profile.js';
import { CommunityScreen } from './screens/Community.js';
import { EggsScreen } from './screens/Eggs.js';
import { Bird } from './components/Bird.js';
import { availableTabs, type Tab } from './navigation.js';
import { ExperienceV2 } from './screens/ExperienceV2.js';
import { RestoredExperience } from './screens/RestoredExperience.js';
import { previewInitData } from './preview.js';
import { ZeroSeason } from './screens/ZeroSeason.js';
import { LocalKontur } from './screens/LocalKontur.js';
import { LiveCampaign } from './screens/LiveCampaign.js';

const DEV_BIRDS: { role: Role; title: string }[] = [
  { role: 'designer', title: 'Дизайнер' },
  { role: 'coder', title: 'Кодер' },
  { role: 'creative', title: 'Креативщик' },
  { role: 'manager', title: 'Менеджер' },
  { role: 'vibe', title: 'Вайбодел' },
];

const DEV_PALETTE: Palette = {
  body: '#edd9b6',
  belly: '#faeed6',
  wing: '#d3ae74',
  tail: '#c09a68',
  crest: '#c8a26c',
  beak: '#ef8a52',
};

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'bad';
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  // V5 is an isolated surface: only its explicit query flag can enter it.
  // Existing V1–V4 launch URLs keep their original routing unchanged.
  if (params.get('campaign') === 'v5') return <LiveCampaign />;
  if (params.get('season') === 'zero') return <LocalKontur />;
  if (import.meta.env.DEV && params.get('season') === 'zero-shelf') return <ZeroSeason />;
  if (import.meta.env.DEV && params.has('birds')) return <BirdGallery />;
  if (import.meta.env.DEV && params.has('signals')) return <SignalGallery />;
  if (import.meta.env.DEV && params.get('legacy') === '1') return <GameApp />;
  if (
    import.meta.env.VITE_PREVIEW_MODE === 'true'
    && !previewInitData(window.location.search, true)
  ) return <InvalidPreviewSlot />;
  return <LocalKontur />;
}

function InvalidPreviewSlot() {
  return (
    <div className="v2-shell">
      <main className="v2-panel v2-stack">
        <div>
          <span className="v2-eyebrow">Предпросмотр</span>
          <h1>Эта ссылка не подходит</h1>
          <p className="v2-lead">Откройте личную ссылку с номером места от 1 до 10.</p>
        </div>
      </main>
    </div>
  );
}

function GameApp() {
  const [state, setState] = useState<GameState | null>(null);
  const [experience, setExperience] = useState<ExperienceV2State | null | undefined>(undefined);
  const [restored, setRestored] = useState<RestoredExperienceState | null | undefined>(undefined);
  const [archiveMode, setArchiveMode] = useState(false);
  const [fatal, setFatal] = useState<'offline' | string | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Guard от двойного нажатия. Именно ref: setState асинхронный,
  // и два клика в одном тике оба проскочили бы проверку
  const busyRef = useRef(false);
  const toastId = useRef(0);

  const boot = useCallback(() => {
    setFatal(null);
    setState(null);
    setExperience(undefined);
    setRestored(undefined);
    setArchiveMode(false);
    authenticate()
      .then(async (legacyState) => {
        let nextRestored: RestoredExperienceState | null = null;
        try {
          nextRestored = await api.restoredState();
        } catch (error) {
          if (!(error instanceof ApiError && error.code === 'EXPERIENCE_DISABLED')) throw error;
        }
        let nextExperience: ExperienceV2State | null = null;
        if (!nextRestored) {
          try {
            nextExperience = await api.experienceState();
          } catch (error) {
            if (!(error instanceof ApiError && error.code === 'EXPERIENCE_DISABLED')) throw error;
          }
        }
        setRestored(nextRestored);
        setExperience(nextExperience);
        setState(legacyState);
      })
      .catch((e) => {
        if (e instanceof OfflineError) setFatal('offline');
        else setFatal(e instanceof ApiError ? e.message : 'Не удалось войти');
      });
  }, []);

  useEffect(() => {
    initTelegram();
    boot();
  }, [boot]);

  // Возврат из фона — перечитываем состояние
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (restored) {
        api.restoredState().then((next) => { setRestored(next); setState(next.game); }).catch(() => {});
      } else if (experience) {
        api.experienceState().then(setExperience).catch(() => {});
      } else if (state?.hatched) {
        api.state().then(setState).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [restored, experience, state?.hatched]);

  useEffect(() => {
    if (!state) return;
    if (tab === 'eggs' && !state.features.eggs) setTab('profile');
    if (tab === 'community' && !state.features.community) setTab('profile');
  }, [state, tab]);

  const toast = useCallback((text: string, tone: 'ok' | 'bad') => {
    const id = ++toastId.current;
    setToasts((l) => [...l, { id, text, tone }]);
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), 2800);
  }, []);

  /** Оптимистичного UI нет: кнопка ждёт ответа, состояние приходит целиком. */
  const run = useCallback(
    async <T extends { state?: GameState }>(
      key: string,
      fn: () => Promise<T>,
      onDone?: (r: T) => void,
    ) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(key);
      haptic('tap');
      try {
        const r = await fn();
        if (r.state) setState(r.state);
        onDone?.(r);
        haptic('ok');
      } catch (e) {
        toast(
          e instanceof OfflineError
            ? 'Нет связи'
            : e instanceof ApiError
              ? e.message
              : 'Не получилось',
          'bad',
        );
        haptic('fail');
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [toast],
  );

  if (fatal === 'offline') return <Shell><Offline onRetry={boot} /></Shell>;
  if (fatal) return <Shell><Failed text={fatal} onRetry={boot} /></Shell>;
  if (!state || experience === undefined || restored === undefined) return <Shell><Loading what="Ищем вашу нить" /></Shell>;

  if (!state.hatched) {
    return (
      <Shell>
        <Onboarding variant={restored ? 'restored' : 'legacy'} onHatched={async (r) => {
          setState(r.state);
          if (restored) {
            const next = await api.restoredState();
            setRestored(next);
            setState(next.game);
          }
        }} />
      </Shell>
    );
  }

  if (restored) {
    return <RestoredExperience state={restored} onState={(next) => { setRestored(next); setState(next.game); }} />;
  }

  if (experience && !archiveMode) {
    return (
      <ExperienceV2
        state={experience}
        onState={setExperience}
        onOpenArchive={() => setArchiveMode(true)}
      />
    );
  }

  if (experience && archiveMode) {
    return <LegacyArchive state={state} onReturn={() => setArchiveMode(false)} />;
  }

  const tabs = availableTabs(state.features);

  return (
    <Shell game>
      <header className="bar">
        <div className="bar__res">
          <div className="res">
            <i className="dot dot--worm" />
            <span className="res__value">{state.player.wallet.toLocaleString('ru')}</span>
          </div>
          <div className="res res--rep" title="Репутация — только растёт">
            <i className="dot dot--rep" />
            <span className="res__value">{state.player.reputation.toLocaleString('ru')}</span>
          </div>
        </div>
        <div className="bar__give">
          <span className="muted small">раздать</span>
          <span className="bar__left">
            {state.give.left}/{state.give.budget}
          </span>
        </div>
      </header>

      {state.isDoubleDay && (
        <div className="friday">Пятница · червяки идут вдвойне</div>
      )}

      <main className="content">
        {tab === 'profile' && (
          <ProfileScreen
            state={state}
            busy={busy}
            onCollectPassive={() =>
              run('passive', () => api.collectPassive(), (r) =>
                toast(`Забрано ${r.collected}`, 'ok'),
              )
            }
          />
        )}
        {tab === 'community' && (
          <CommunityScreen onToast={(text, tone) => toast(text, tone)} />
        )}
        {tab === 'eggs' && (
          <EggsScreen
            state={state}
            busy={busy}
            onOpened={(r) => setState(r.state)}
            onState={setState}
            onError={(text) => toast(text, 'bad')}
          />
        )}
      </main>

      <nav className="nav">
        <div className="nav__scroll">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`nav__item ${tab === t.key ? 'nav__item--on' : ''}`}
              onClick={() => {
                haptic('tap');
                setTab(t.key);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {!isInsideTelegram && (
        <p className="devnote small muted">Открыто вне Telegram · dev-режим</p>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function LegacyArchive({ state, onReturn }: { state: GameState; onReturn(): void }) {
  return (
    <Shell>
      <button className="v2-archive-return" type="button" onClick={onReturn}>
        Вернуться в новый «Контур»
      </button>
      <main className="v2-legacy-archive">
        <div>
          <span className="v2-eyebrow">Архив прежней версии</span>
          <h1>Всё сохранено, но больше не меняется</h1>
          <p className="v2-lead">Здесь можно посмотреть прежний профиль. Игровые действия в новой версии недоступны.</p>
        </div>
        {!state.hatched ? (
          <Card><p className="muted">В прежней версии у вас нет сохранённой птицы.</p></Card>
        ) : (
          <>
            <div className="hero v2-legacy-hero">
              <Bird role={state.player.role} palette={state.player.palette} size={150} alive={false} />
              <div className="hero__meta">
                <div className="hero__role">{state.player.roleTitle}</div>
                {state.player.birdName && <div className="hero__name">{state.player.birdName}</div>}
                <div className="hero__tag">{state.player.coloringTitle}</div>
              </div>
            </div>
            <div className="stats">
              <Stat label="Репутация" value={state.player.reputation.toLocaleString('ru')} />
              <Stat label="Кошелёк" value={state.player.wallet.toLocaleString('ru')} />
              <Stat label="Перьев" value={state.player.signalCount} />
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}

function BirdGallery() {
  return (
    <div className="screen bird-gallery">
      <div>
        <h1 className="bird-gallery__title">Пять птиц</h1>
        <p className="small muted bird-gallery__sub">Обычный окрас · dev-просмотр</p>
      </div>
      <div className="bird-gallery__grid">
        {DEV_BIRDS.map(({ role, title }) => (
          <div className="bird-gallery__card" key={role}>
            <Bird role={role} palette={DEV_PALETTE} size={132} alive={false} />
            <strong>{title}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalGallery() {
  return (
    <div className="screen signal-preview">
      <div>
        <h1 className="bird-gallery__title">Мост в реальность</h1>
        <p className="small muted bird-gallery__sub">dev-просмотр · без Telegram</p>
      </div>

      <Card title="Золотые перья" aside="1 подтверждено">
        <div className="signals">
          <div className="signal">
            <i className="signal__feather" aria-hidden="true" />
            <div className="signal__body">
              <div className="signal__title">Проект прошёл ревью</div>
              <div className="signal__meta">проект после ревью · сегодня</div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Пока без перьев" aside="0 подтверждено">
        <p className="muted small signal-empty">
          Их нельзя выбить из яйца. Перо появляется после подтверждённого
          события ЦУ, выполненного кейса или проекта после ревью.
        </p>
      </Card>

      <Card title="Как выглядит в стае">
        <div className="signal-preview__member">
          <Bird role="manager" palette={DEV_PALETTE} size={68} alive={false} />
          <div>
            <strong>ты</strong>
            <div className="branch__role muted">
              Менеджер<span className="branch__signals"> · 1 пер.</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Shell({ children, game = false }: { children: React.ReactNode; game?: boolean }) {
  return <div className={`screen${game ? ' screen--game' : ''}`}>{children}</div>;
}
