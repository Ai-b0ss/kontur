import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColoringDto,
  RestoredActionDto,
  RestoredExperienceState,
  RestoredPathKind,
  RestoredVisibility,
} from '@kontur/contracts';
import { ApiError, OfflineError, api } from '../api.js';
import { Bird } from '../components/Bird.js';
import { haptic, shareToChat } from '../telegram.js';
import {
  RESTORED_PATHS as PATHS,
  RESTORED_PATH_BY_KIND as PATH_BY_KIND,
  RESTORED_TABS as TABS,
  restoredDefaultStatus,
  restoredDraftKey as draftKey,
  type PathMeta,
  type RestoredTab,
} from '../restored-model.js';

interface Props {
  state: RestoredExperienceState;
  onState(state: RestoredExperienceState): void;
}


function readableError(error: unknown): string {
  if (error instanceof OfflineError) return 'Нет связи. Черновик сохранён на устройстве.';
  if (error instanceof ApiError) return error.message;
  return 'Не получилось. Попробуй ещё раз.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export function RestoredExperience({ state, onState }: Props) {
  const [tab, setTab] = useState<RestoredTab>('bird');
  const [selectedPath, setSelectedPath] = useState<PathMeta | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [visibility, setVisibility] = useState<RestoredVisibility>('private');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [colorings, setColorings] = useState<ColoringDto[] | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  const reduced = state.preferences.motion === 'reduced';
  const completed = useMemo(() => new Set(state.progress.completedKinds), [state.progress.completedKinds]);

  const notify = (text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast(null), 3200);
  };

  const run = async (key: string, work: () => Promise<RestoredExperienceState>, ok?: string) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(key);
    haptic('tap');
    try {
      const next = await work();
      onState(next);
      if (ok) notify(ok);
      haptic('ok');
      return next;
    } catch (error) {
      notify(readableError(error), true);
      haptic('fail');
      return null;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const refresh = () => run('refresh', () => api.restoredState(), 'Данные обновлены');

  const choosePath = (path: PathMeta, initial?: { title?: string; note?: string }) => {
    if (path.kind === 'progress') {
      setTab('collection');
      haptic('tap');
      return;
    }
    let saved: { title?: string; note?: string; visibility?: RestoredVisibility } = {};
    try { saved = JSON.parse(localStorage.getItem(draftKey(path.kind)) ?? '{}'); } catch { /* пустой черновик */ }
    setDraftTitle(initial?.title ?? saved.title ?? path.defaultTitle);
    setDraftNote(initial?.note ?? saved.note ?? '');
    setVisibility(path.kind === 'connect' ? (saved.visibility ?? 'flock') : 'private');
    setSelectedPath(path);
    haptic('tap');
  };

  useEffect(() => {
    if (!selectedPath) return;
    try {
      localStorage.setItem(draftKey(selectedPath.kind), JSON.stringify({
        title: draftTitle, note: draftNote, visibility,
      }));
    } catch { /* приватный режим может запрещать storage */ }
  }, [selectedPath, draftTitle, draftNote, visibility]);

  useEffect(() => {
    if (tab !== 'collection' || colorings || collectionError) return;
    api.colorings().then((result) => setColorings(result.colorings)).catch((error) => {
      setCollectionError(readableError(error));
    });
  }, [tab, colorings, collectionError]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [tab, reduced]);

  const submitPath = async (openChat: boolean) => {
    if (!selectedPath || !draftTitle.trim()) return;
    const status = restoredDefaultStatus(selectedPath.kind);
    const first = await run('path', () => api.saveRestoredAction({
      kind: selectedPath.kind,
      status,
      title: draftTitle.trim(),
      note: draftNote.trim() || undefined,
      visibility,
    }));
    if (!first) return;
    let finalState = first;
    if (selectedPath.kind === 'save') {
      const nested = await run('path', () => api.saveRestoredNest({
        sourceKind: 'note', title: draftTitle.trim(), note: draftNote.trim() || undefined,
      }));
      if (nested) finalState = nested;
    }
    onState(finalState);
    try { localStorage.removeItem(draftKey(selectedPath.kind)); } catch { /* no-op */ }
    const shareText = `${draftTitle.trim()}${draftNote.trim() ? `\n\n${draftNote.trim()}` : ''}`;
    setSelectedPath(null);
    notify(openChat ? 'Черновик готов. Отправка остаётся за тобой.' : 'Путь сохранён');
    if (openChat) shareToChat(shareText);
  };

  const loadCollection = async () => {
    setCollectionError(null);
    try {
      const result = await api.colorings();
      setColorings(result.colorings);
    } catch (error) { setCollectionError(readableError(error)); }
  };

  const openEgg = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy('egg');
    haptic('tap');
    try {
      const result = await api.openEgg();
      const [next, palette] = await Promise.all([api.restoredState(), api.colorings()]);
      onState(next);
      setColorings(palette.colorings);
      notify(result.duplicate ? `Повтор: вернулось ${result.refund}` : `Новый окрас — ${result.coloringTitle}`);
      haptic('ok');
    } catch (error) { notify(readableError(error), true); haptic('fail'); }
    finally { busyRef.current = false; setBusy(null); }
  };

  const equip = async (code: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(`equip-${code}`);
    try {
      await api.equip(code);
      const [next, palette] = await Promise.all([api.restoredState(), api.colorings()]);
      onState(next);
      setColorings(palette.colorings);
      notify('Окрас надет');
      haptic('ok');
    } catch (error) { notify(readableError(error), true); haptic('fail'); }
    finally { busyRef.current = false; setBusy(null); }
  };

  const birdMood = state.progress.verifiedSignals > 0
    ? 'achieved' : state.actions.some((item) => item.status === 'active') ? 'active' : 'ready';

  return (
    <div className={`r3-shell${reduced ? ' r3-reduced' : ''}`}>
      <header className="r3-topbar">
        <div className="r3-brand"><SignalMark /><span>КОНТУР</span></div>
        <div className="r3-top-actions">
          <button className="r3-icon-button" type="button" onClick={() => run('motion', () => api.updateRestoredMotion(reduced ? 'system' : 'reduced'))} aria-label={reduced ? 'Включить системную анимацию' : 'Уменьшить анимацию'}>
            {reduced ? '▶' : '≈'}
          </button>
          <button className={`r3-icon-button${busy === 'refresh' ? ' is-spinning' : ''}`} type="button" onClick={refresh} aria-label="Обновить данные">↻</button>
        </div>
      </header>

      <main ref={mainRef} className="r3-main" aria-live="polite">
        {tab === 'bird' && (
          <BirdHome state={state} birdMood={birdMood} busy={busy} onRun={run} onChoose={choosePath} />
        )}
        {tab === 'community' && (
          <Community state={state} onChoose={choosePath} onSave={async (code, title, description) => {
            await run(`save-${code}`, () => api.saveRestoredNest({
              sourceKind: 'opportunity', sourceId: code, title, note: description,
            }), 'Возможность сохранена в гнездо');
          }} busy={busy} />
        )}
        {tab === 'actions' && (
          <Actions completed={completed} actions={state.actions} onChoose={choosePath} onDone={(action) => run(`done-${action.id}`, () => api.updateRestoredAction(action.id, 'done'), 'Полезный шаг отмечен')} busy={busy} />
        )}
        {tab === 'nest' && (
          <Nest state={state} busy={busy} onDone={(id) => run(`nest-${id}`, () => api.updateRestoredNest(id, 'done'), 'Результат завершён')} onSaveAction={(action) => run(`nest-action-${action.id}`, () => api.saveRestoredNest({ sourceKind: 'action', sourceId: String(action.id), title: action.title, note: action.note ?? undefined }), 'Добавлено в гнездо')} />
        )}
        {tab === 'collection' && (
          <Collection state={state} colorings={colorings} error={collectionError} busy={busy} onRetry={loadCollection} onOpen={openEgg} onEquip={equip} />
        )}
      </main>

      <nav className="r3-nav" aria-label="Основные разделы">
        {TABS.map((item) => (
          <button type="button" key={item.key} className={tab === item.key ? 'is-active' : ''} onClick={() => { setTab(item.key); haptic('tap'); }}>
            <NavGlyph tab={item.key} /><span>{item.label}</span>
          </button>
        ))}
      </nav>

      {selectedPath && (
        <div className="r3-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPath(null); }}>
          <section className="r3-sheet" role="dialog" aria-modal="true" aria-labelledby="path-title">
            <div className="r3-sheet-handle" />
            <button className="r3-sheet-close" type="button" onClick={() => setSelectedPath(null)} aria-label="Закрыть">×</button>
            <span className={`r3-path-dot is-${selectedPath.accent}`} />
            <h2 id="path-title">{selectedPath.label}</h2>
            <p>{selectedPath.prompt}</p>
            <label>Заголовок<input maxLength={100} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label>
            <label>Контекст или следующий шаг<textarea maxLength={500} rows={4} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Коротко и конкретно" /></label>
            {selectedPath.kind === 'connect' && (
              <label className="r3-switch"><input type="checkbox" checked={visibility === 'flock'} onChange={(event) => setVisibility(event.target.checked ? 'flock' : 'private')} /><span>Показать запрос в стае</span></label>
            )}
            {selectedPath.kind === 'help' && <div className="r3-info"><strong>/worm</strong> отправляется только реплаем на конкретный полезный ответ. С причиной ценнее; репутация растёт, кошелёк получателя тоже.</div>}
            {selectedPath.kind === 'contribution' && <div className="r3-info">Самоотметка сохраняет историю, но не выдаёт золотое перо. Перо появляется только после отдельного подтверждения.</div>}
            <div className="r3-sheet-actions">
              <button className="r3-button is-primary" disabled={busy === 'path' || !draftTitle.trim()} onClick={() => submitPath(true)}>Сохранить и открыть чат</button>
              <button className="r3-button is-secondary" disabled={busy === 'path' || !draftTitle.trim()} onClick={() => submitPath(false)}>Только сохранить</button>
            </div>
            <small>Черновик сохраняется на этом устройстве. Сообщение не отправится без твоего подтверждения.</small>
          </section>
        </div>
      )}

      {toast && <div className={`r3-toast${toast.bad ? ' is-bad' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}

function BirdHome({ state, birdMood, busy, onRun, onChoose }: {
  state: RestoredExperienceState;
  birdMood: 'ready' | 'active' | 'achieved';
  busy: string | null;
  onRun: (key: string, work: () => Promise<RestoredExperienceState>, ok?: string) => Promise<RestoredExperienceState | null>;
  onChoose: (path: PathMeta) => void;
}) {
  const game = state.game;
  const next = state.progress.nextKind ? PATH_BY_KIND.get(state.progress.nextKind) : PATH_BY_KIND.get('contribution');
  const progress = state.progress.nextLevelAt
    ? Math.min(100, (state.progress.score / state.progress.nextLevelAt) * 100) : 100;
  return (
    <div className="r3-stack">
      <section className="r3-hero-card">
        <div className="r3-thread-map" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="r3-bird-wrap"><Bird role={game.player.role} palette={game.player.palette} size={176} mood={birdMood} /></div>
        <div className="r3-hero-copy">
          <span className="r3-kicker">уровень {state.progress.level}</span>
          <h1>{game.player.birdName || game.player.roleTitle}</h1>
          <p>{state.progress.levelTitle} · {game.player.coloringTitle}</p>
        </div>
        <div className="r3-level"><span style={{ width: `${progress}%` }} /></div>
        <div className="r3-level-meta"><span>{state.progress.score} сигналов пути</span><span>{state.progress.nextLevelAt ? `до ${state.progress.nextLevelAt}` : 'максимум'}</span></div>
      </section>

      <div className="r3-resource-grid">
        <article><span className="is-worm">●</span><strong>{game.player.wallet}</strong><small>кошелёк · тратится</small></article>
        <article><span className="is-rep">◆</span><strong>{game.player.reputation}</strong><small>репутация · только растёт</small></article>
        <article><span className="is-gold">✦</span><strong>{game.player.signalCount}</strong><small>подтверждённые перья</small></article>
      </div>

      <section className="r3-card r3-next-card">
        <div><span className="r3-kicker">следующий полезный шаг</span><h2>{next?.label}</h2><p>{next?.prompt}</p></div>
        {next && <button className="r3-button is-primary" onClick={() => onChoose(next)}>Начать</button>}
      </section>

      {game.passive && (
        <section className="r3-card r3-daily">
          <div><span className="r3-kicker">тихий запас</span><h2>{game.passive.collectedToday ? 'Сегодня собрано' : `+${game.passive.available} в кошелёк`}</h2><p>Не даёт репутацию и не заменяет помощь людей.</p></div>
          <button className="r3-button is-secondary" disabled={game.passive.collectedToday || busy === 'passive'} onClick={() => onRun('passive', async () => { await api.collectPassive(); return api.restoredState(); }, 'Запас в кошельке')}>{game.passive.collectedToday ? 'Готово' : 'Собрать'}</button>
        </section>
      )}

      <section className="r3-card r3-worm-card"><div className="r3-worm-symbol">↳</div><div><span className="r3-kicker">конкретная благодарность</span><h2>/worm реплаем</h2><p>1 без причины, 2 с причиной. Получатель растит репутацию и кошелёк; у тебя остаётся {game.give.left} из {game.give.budget} раздач сегодня.</p></div></section>
    </div>
  );
}

function Community({ state, onChoose, onSave, busy }: {
  state: RestoredExperienceState;
  onChoose: (path: PathMeta, initial?: { title?: string; note?: string }) => void;
  onSave: (code: string, title: string, description: string) => Promise<void>;
  busy: string | null;
}) {
  return (
    <div className="r3-stack">
      <header className="r3-page-head"><span className="r3-kicker">живые сигналы</span><h1>Стая и возможности</h1><p>Не рейтинг ради цифры, а видимые способы быть полезными друг другу.</p></header>
      <section className="r3-card">
        <div className="r3-section-title"><div><span className="r3-kicker">ищут сейчас</span><h2>Люди и команды</h2></div><button className="r3-link" onClick={() => onChoose(PATH_BY_KIND.get('connect')!)}>Создать запрос</button></div>
        {state.connections.length ? <div className="r3-connections">{state.connections.map((item) => <article key={item.actionId}><Bird role={item.role} palette={item.palette} size={60} mood="ready" /><div><strong>{item.title}</strong><p>{item.note || 'Контекст появится после ответа'}</p><small>{item.isMe ? 'твой запрос' : item.birdName || (item.username ? `@${item.username}` : item.roleTitle)}</small></div></article>)}</div> : <Empty title="Пока тихо" text="Первый точный запрос лучше пустой витрины. Он виден только после явного согласия." />}
      </section>

      <section>
        <div className="r3-section-title outside"><div><span className="r3-kicker">маршруты</span><h2>Возможности</h2></div></div>
        <div className="r3-opportunities">{state.opportunities.map((item) => <article key={item.code} className={`is-${item.kind}`}><SignalGlyph kind={item.kind} /><div><h3>{item.title}</h3><p>{item.description}</p></div><div className="r3-op-actions"><button onClick={() => onChoose(PATH_BY_KIND.get('opportunity')!, { title: item.title, note: item.description })}>{item.actionLabel}</button><button aria-label={`Сохранить ${item.title}`} disabled={busy === `save-${item.code}`} onClick={() => onSave(item.code, item.title, item.description)}>＋</button></div></article>)}</div>
      </section>

      <section className="r3-card"><span className="r3-kicker">куда идти</span><h2>Карта чатов</h2>{state.chats.length ? <div className="r3-chat-list">{state.chats.map((chat) => <button key={chat.code} onClick={() => onChoose(PATH_BY_KIND.get('orient')!, { title: chat.title, note: chat.purpose })}><i /><span><strong>{chat.title}</strong><small>{chat.purpose}</small></span><b>→</b></button>)}</div> : <Empty title="Карта готовится" text="Новые чаты не показываются, пока оператор не подтвердит их назначение." />}</section>
    </div>
  );
}

function Actions({ completed, actions, onChoose, onDone, busy }: {
  completed: Set<RestoredPathKind>;
  actions: RestoredActionDto[];
  onChoose: (path: PathMeta) => void;
  onDone: (action: RestoredActionDto) => void;
  busy: string | null;
}) {
  const active = actions.filter((item) => item.status !== 'done').slice(0, 3);
  return (
    <div className="r3-stack">
      <header className="r3-page-head"><span className="r3-kicker">восемь равных входов</span><h1>Выбери полезный путь</h1><p>Вопрос — не единственный способ участвовать. Начни с того, что уместно сейчас.</p></header>
      <div className="r3-path-grid">{PATHS.map((path, index) => <button type="button" className={`r3-path is-${path.accent}${completed.has(path.kind) ? ' is-done' : ''}`} key={path.kind} onClick={() => onChoose(path)}><span className="r3-path-number">{String(index + 1).padStart(2, '0')}</span><PathGlyph kind={path.kind} /><strong>{path.label}</strong><small>{path.short}</small>{completed.has(path.kind) && <b>✓</b>}</button>)}</div>
      {active.length > 0 && <section className="r3-card"><div className="r3-section-title"><div><span className="r3-kicker">в работе</span><h2>Текущие нити</h2></div></div><div className="r3-active-list">{active.map((action) => <article key={action.id}><span className={`r3-path-dot is-${PATH_BY_KIND.get(action.kind)?.accent ?? 'ink'}`} /><div><strong>{action.title}</strong><small>{PATH_BY_KIND.get(action.kind)?.label} · {formatDate(action.updatedAt)}</small></div><button disabled={busy === `done-${action.id}`} onClick={() => onDone(action)}>Готово</button></article>)}</div></section>}
    </div>
  );
}

function Nest({ state, busy, onDone, onSaveAction }: {
  state: RestoredExperienceState;
  busy: string | null;
  onDone: (id: number) => void;
  onSaveAction: (action: RestoredActionDto) => void;
}) {
  const unsaved = state.actions.filter((action) => !state.nest.some((item) => item.sourceKind === 'action' && item.sourceId === String(action.id))).slice(0, 3);
  return (
    <div className="r3-stack">
      <header className="r3-page-head"><span className="r3-kicker">личная память</span><h1>Гнездо результатов</h1><p>Контакты, решения и следующие шаги — отдельно от шума чата.</p></header>
      {state.nest.length ? <div className="r3-nest-list">{state.nest.map((item) => <article key={item.id} className={item.status === 'done' ? 'is-done' : ''}><div className="r3-nest-pin" /><div><span className="r3-kicker">{item.sourceKind} · {formatDate(item.updatedAt)}</span><h3>{item.title}</h3>{item.note && <p>{item.note}</p>}{item.nextStep && <small>Дальше: {item.nextStep}</small>}</div>{item.status === 'active' && <button disabled={busy === `nest-${item.id}`} onClick={() => onDone(item.id)}>Завершить</button>}</article>)}</div> : <Empty title="Гнездо пусто" text="Сохрани результат, возможность или контакт — они останутся здесь после закрытия приложения." />}
      {unsaved.length > 0 && <section className="r3-card"><span className="r3-kicker">можно сохранить</span><h2>Недавние действия</h2><div className="r3-save-list">{unsaved.map((action) => <button key={action.id} disabled={busy === `nest-action-${action.id}`} onClick={() => onSaveAction(action)}><span>{action.title}</span><b>＋ в гнездо</b></button>)}</div></section>}
      <section className="r3-card r3-signal-section"><div className="r3-section-title"><div><span className="r3-kicker">нефармящийся след</span><h2>Сигнал-карты</h2></div><strong>{state.signals.length} ✦</strong></div>{state.signals.length ? <div className="r3-signal-cards">{state.signals.map((signal) => <article key={signal.id}><i>✦</i><div><strong>{signal.title}</strong><small>{formatDate(signal.issuedAt)}</small></div></article>)}</div> : <p>Самоотметка не выдаёт перо. Карта появляется только после подтверждённого события, кейса или проекта.</p>}</section>
    </div>
  );
}

function Collection({ state, colorings, error, busy, onRetry, onOpen, onEquip }: {
  state: RestoredExperienceState;
  colorings: ColoringDto[] | null;
  error: string | null;
  busy: string | null;
  onRetry: () => void;
  onOpen: () => void;
  onEquip: (code: string) => void;
}) {
  return (
    <div className="r3-stack">
      <header className="r3-page-head"><span className="r3-kicker">внешность меняется, роль остаётся</span><h1>Коллекция птицы</h1><p>Окрасы — память о возвращениях. Золотые перья выдаются только за подтверждённый вклад.</p></header>
      <section className="r3-collection-hero"><div className="r3-egg-art"><span /><span /><span /></div><div><span className="r3-kicker">яйцо · {state.game.egg?.cost ?? 0} из кошелька</span><h2>{state.game.egg?.affordable ? 'Можно открыть' : 'Нужно ещё немного'}</h2><p>{state.progress.collectedSkins} из {state.game.egg?.total ?? 0} окрасов собрано</p><button className="r3-button is-primary" disabled={!state.game.egg?.affordable || busy === 'egg'} onClick={onOpen}>{busy === 'egg' ? 'Открываем…' : 'Открыть яйцо'}</button></div></section>
      {error ? <section className="r3-card"><p>{error}</p><button className="r3-button is-secondary" onClick={onRetry}>Повторить</button></section> : !colorings ? <div className="r3-loading">Собираем коллекцию…</div> : <div className="r3-skins">{colorings.map((item) => <button key={item.code} className={`${item.owned ? 'is-owned' : ''}${item.equipped ? ' is-equipped' : ''}`} disabled={!item.owned || item.equipped || busy === `equip-${item.code}`} onClick={() => onEquip(item.code)}><span className="r3-skin-bird" style={{ '--skin-body': item.palette.body, '--skin-wing': item.palette.wing, '--skin-beak': item.palette.beak } as React.CSSProperties}><i /></span><strong>{item.title}</strong><small>{item.equipped ? 'надет' : item.owned ? item.rarity : 'в яйце'}</small></button>)}</div>}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="r3-empty"><SignalMark /><strong>{title}</strong><p>{text}</p></div>;
}

function SignalMark() { return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="5" /><circle cx="20" cy="20" r="12" /><path d="M20 2v6M20 32v6M2 20h6M32 20h6" /></svg>; }
function SignalGlyph({ kind }: { kind: string }) { return <div className="r3-signal-glyph" aria-hidden="true"><i /><i /><b>{kind === 'grant' ? '✦' : kind === 'project' ? '↗' : kind === 'event' ? '◉' : '⌁'}</b></div>; }
function PathGlyph({ kind }: { kind: RestoredPathKind }) { const glyph: Record<RestoredPathKind, string> = { ask: '?', help: '↳', connect: '∞', orient: '◎', opportunity: '✦', contribution: '↑', save: '⌄', progress: '◇' }; return <span className="r3-path-glyph" aria-hidden="true">{glyph[kind]}</span>; }
function NavGlyph({ tab }: { tab: RestoredTab }) { const glyph: Record<RestoredTab, string> = { bird: '◒', community: '⌁', actions: '＋', nest: '⌄', collection: '◇' }; return <i aria-hidden="true">{glyph[tab]}</i>; }
