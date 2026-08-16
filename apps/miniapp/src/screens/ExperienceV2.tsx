import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ExperienceV2State,
  NestItemDto,
  ParticipationIntent,
  ParticipationStage,
} from '@kontur/contracts';
import { ApiError, OfflineError, api } from '../api.js';
import { haptic, shareToChat } from '../telegram.js';
import {
  buildQuestionDraft,
  STAGE_LABELS,
  viewForJourney,
  type QuestionDraft,
} from '../experience-v2-state.js';

const DRAFT_KEY = 'kontur:v2:question-draft';

const INTENTS: Array<{ key: ParticipationIntent; title: string; note: string }> = [
  { key: 'orient', title: 'Разобраться, что здесь происходит', note: 'Короткая карта подключённых чатов' },
  { key: 'ask', title: 'Задать понятный вопрос', note: 'Собрать три детали перед отправкой' },
  { key: 'help', title: 'Помочь другому участнику', note: 'Найти доступный разговор помощи' },
  { key: 'return', title: 'Вернуться к разговору', note: 'Открыть сохранённый результат' },
];

const EMPTY_DRAFT: QuestionDraft = { goal: '', checked: '', needed: '' };

function loadDraft(): QuestionDraft {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<QuestionDraft> | null;
    return parsed ? {
      goal: typeof parsed.goal === 'string' ? parsed.goal : '',
      checked: typeof parsed.checked === 'string' ? parsed.checked : '',
      needed: typeof parsed.needed === 'string' ? parsed.needed : '',
    } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraft(draft: QuestionDraft): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* локальное хранение необязательно */ }
}

function errorText(error: unknown): string {
  if (error instanceof OfflineError) return 'Нет связи. Черновик остался на устройстве.';
  if (error instanceof ApiError) return error.message;
  return 'Не получилось выполнить действие';
}

export function ExperienceV2({
  state,
  onState,
  onOpenArchive,
}: {
  state: ExperienceV2State;
  onState(state: ExperienceV2State): void;
  onOpenArchive(): void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(loadDraft);
  const [selectedChat, setSelectedChat] = useState(state.chats[0]?.code ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motion, setMotion] = useState(true);
  const requests = useRef(new Map<string, string>());

  const stage = state.profile?.stage ?? 'looking';
  const question = useMemo(() => buildQuestionDraft(draft), [draft]);

  async function run(key: string, action: (requestId: string) => Promise<ExperienceV2State>) {
    if (busy) return;
    const requestId = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, requestId);
    setBusy(key);
    setError(null);
    haptic('tap');
    try {
      const next = await action(requestId);
      requests.current.delete(key);
      onState(next);
      haptic('ok');
    } catch (caught) {
      setError(errorText(caught));
      haptic('fail');
    } finally {
      setBusy(null);
    }
  }

  function changeDraft(field: keyof QuestionDraft, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    saveDraft(next);
  }

  return (
    <div className={`v2-shell ${motion ? '' : 'v2-reduced'}`}>
      <header className="v2-topbar">
        <div>
          <span className="v2-kicker">Контур</span>
          <strong>Первая полезная нить</strong>
        </div>
        <div className="v2-topbar__actions">
          <button type="button" onClick={() => setMotion((value) => !value)}>
            {motion ? 'Движение: да' : 'Движение: нет'}
          </button>
          <button type="button" onClick={onOpenArchive}>Архив</button>
        </div>
      </header>

      <section className="v2-bird-stage" aria-label={`Состояние птицы: ${STAGE_LABELS[stage]}`}>
        <SignalBird stage={stage} />
        <div className="v2-bird-caption">
          <span>{String(['looking', 'thread', 'nest', 'connection'].indexOf(stage) + 1).padStart(2, '0')}</span>
          <strong>{STAGE_LABELS[stage]}</strong>
        </div>
      </section>

      <nav className="v2-path" aria-label="Путь первой недели">
        {(['looking', 'thread', 'nest', 'connection'] as ParticipationStage[]).map((item, index) => {
          const active = index <= ['looking', 'thread', 'nest', 'connection'].indexOf(stage);
          return <span key={item} className={active ? 'is-on' : ''}><i />{STAGE_LABELS[item]}</span>;
        })}
      </nav>

      {error && <div className="v2-error" role="alert">{error}</div>}

      <main className="v2-panel">
        {!state.activeJourney && (
          <IntentScreen
            state={state}
            selectedChat={selectedChat}
            onChat={setSelectedChat}
            busy={busy === 'start'}
            onStart={(intent) => run('start', (id) =>
              api.startJourney(intent, selectedChat || undefined, id))}
          />
        )}

        {state.activeJourney?.intent === 'ask' && (
          <AskJourney
            state={state}
            draft={draft}
            question={question}
            busy={busy}
            onDraft={changeDraft}
            onPrepared={() => run('prepared', (id) => api.markPrepared(id))}
            onShare={() => shareToChat(question)}
            onPublished={() => run('published', (id) =>
              api.markPublished(state.activeJourney!.chatCode ?? selectedChat, id))}
            onOutcome={(outcome) => run(`outcome-${outcome}`, (id) => api.markOutcome(outcome, id))}
            onRefresh={() => run('refresh', () => api.experienceState())}
            onSave={(label, nextStep) => run('nest-save', (id) => api.saveNestItem({
              journeyId: state.activeJourney!.id,
              label,
              status: state.activeJourney!.status === 'clarify' ? 'clarify' : 'helped',
              nextStep: nextStep || undefined,
              clientRequestId: id,
            }))}
            onClose={() => run('close', (id) => api.closeJourney(id))}
          />
        )}

        {state.activeJourney && state.activeJourney.intent !== 'ask' && (
          <AuxiliaryJourney
            state={state}
            busy={busy === 'close'}
            onClose={() => run('close', (id) => api.closeJourney(id))}
          />
        )}
      </main>

      {state.nest.length > 0 && (
        <section className="v2-nest-list" aria-label="Личное гнездо">
          <div className="v2-section-title"><span>Личное гнездо</span><b>{state.nest.length}</b></div>
          {state.nest.map((item) => (
            <NestCard
              key={item.id}
              item={item}
              busy={busy}
              onNextStep={(value) => run(`next-${item.id}`, (id) =>
                api.updateNestNextStep(item.id, value, id))}
              onDelete={() => run(`delete-${item.id}`, (id) => api.deleteNestItem(item.id, id))}
              onReminder={(enabled) => run(`reminder-${item.id}-${enabled}`, (id) =>
                api.updateJourneyReminder(item.id, enabled, id))}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function IntentScreen({
  state,
  selectedChat,
  onChat,
  busy,
  onStart,
}: {
  state: ExperienceV2State;
  selectedChat: string;
  onChat(value: string): void;
  busy: boolean;
  onStart(intent: ParticipationIntent): void;
}) {
  return (
    <div className="v2-stack">
      <div>
        <span className="v2-eyebrow">Первый ориентир</span>
        <h1>Зачем вы пришли сейчас?</h1>
        <p className="v2-lead">Это не роль и не тест личности. Выбор можно закончить и сменить.</p>
      </div>

      {state.chats.length > 0 && (
        <label className="v2-field">
          <span>Текущий чат</span>
          <select value={selectedChat} onChange={(event) => onChat(event.target.value)}>
            {state.chats.map((chat) => <option value={chat.code} key={chat.code}>{chat.title}</option>)}
          </select>
        </label>
      )}

      <div className="v2-intents">
        {INTENTS.map((intent) => (
          <button
            type="button"
            key={intent.key}
            disabled={busy || (intent.key === 'ask' && !selectedChat)}
            onClick={() => onStart(intent.key)}
          >
            <strong>{intent.title}</strong>
            <span>{intent.note}</span>
          </button>
        ))}
      </div>
      {!selectedChat && <p className="v2-fine">Чтобы задать вопрос, сначала нужно подключить сообщество.</p>}
      <p className="v2-fine">Ничего не отправится в Telegram без вашего действия.</p>
    </div>
  );
}

function AskJourney({
  state,
  draft,
  question,
  busy,
  onDraft,
  onPrepared,
  onShare,
  onPublished,
  onOutcome,
  onRefresh,
  onSave,
  onClose,
}: {
  state: ExperienceV2State;
  draft: QuestionDraft;
  question: string;
  busy: string | null;
  onDraft(field: keyof QuestionDraft, value: string): void;
  onPrepared(): void;
  onShare(): void;
  onPublished(): void;
  onOutcome(outcome: 'clarify'): void;
  onRefresh(): void;
  onSave(label: string, nextStep: string): void;
  onClose(): void;
}) {
  const journey = state.activeJourney!;
  const view = viewForJourney(journey.status);
  const [label, setLabel] = useState(draft.goal.slice(0, 120));
  const [nextStep, setNextStep] = useState('');

  useEffect(() => {
    if (!label && draft.goal.trim()) setLabel(draft.goal.trim().slice(0, 120));
  }, [draft.goal, label]);

  if (view === 'compose') return (
    <form className="v2-stack" onSubmit={(event) => { event.preventDefault(); if (question) onPrepared(); }}>
      <div><span className="v2-eyebrow">Нашла нить</span><h1>Добавьте три детали</h1></div>
      <TextField label="Что хотите понять?" value={draft.goal} onChange={(value) => onDraft('goal', value)} />
      <TextField label="Что уже проверили?" value={draft.checked} onChange={(value) => onDraft('checked', value)} />
      <TextField label="Какой ответ поможет?" value={draft.needed} onChange={(value) => onDraft('needed', value)} />
      <button className="v2-primary" type="submit" disabled={!question || Boolean(busy)}>Собрать вопрос</button>
      <button className="v2-quiet" type="button" disabled={Boolean(busy)} onClick={onClose}>Закончить этот путь</button>
    </form>
  );

  if (view === 'preview') return (
    <div className="v2-stack">
      <div><span className="v2-eyebrow">Вопрос готов</span><h1>Последнее действие — за вами</h1></div>
      <blockquote className="v2-preview">{question || 'Черновик не найден на этом устройстве.'}</blockquote>
      <div className="v2-notice">Сначала Telegram предложит выбрать чат. Отправка произойдёт только после вашего подтверждения.</div>
      <button className="v2-primary" type="button" disabled={!question} onClick={onShare}>Открыть отправку в Telegram</button>
      <button className="v2-secondary" type="button" disabled={Boolean(busy)} onClick={onPublished}>Я отправил вопрос</button>
      <button className="v2-quiet" type="button" disabled={Boolean(busy)} onClick={onClose}>Закончить этот путь</button>
    </div>
  );

  if (view === 'waiting') return (
    <div className="v2-stack">
      <div><span className="v2-eyebrow">Разговор начат</span><h1>Отметьте конкретный полезный ответ</h1></div>
      <p className="v2-lead">Ответьте командой <code>/worm</code> именно на ответ помощника. Сам ответ должен быть ответом на ваш вопрос.</p>
      <div className="v2-notice">«Контур» сохранит только связь между сообщениями, но не их текст. Старые червяки и рейтинг здесь не начисляются.</div>
      <button className="v2-primary" type="button" disabled={Boolean(busy)} onClick={onRefresh}>Я уже отметил ответ</button>
      <button className="v2-secondary" type="button" disabled={Boolean(busy)} onClick={() => onOutcome('clarify')}>Нужно уточнить</button>
      <button className="v2-quiet" type="button" disabled={Boolean(busy)} onClick={onClose}>Закончить без результата</button>
    </div>
  );

  if (view === 'outcome' || journey.status === 'clarify') return (
    <form className="v2-stack" onSubmit={(event) => { event.preventDefault(); if (label.trim()) onSave(label.trim(), nextStep.trim()); }}>
      <div><span className="v2-eyebrow">Устроила гнездо</span><h1>Сохраните только нужное</h1></div>
      <label className="v2-field"><span>Короткая подпись</span><input maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label className="v2-field"><span>Один следующий шаг</span><input maxLength={240} value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label>
      <button className="v2-primary" type="submit" disabled={!label.trim() || Boolean(busy)}>Сохранить результат</button>
      <p className="v2-fine">Полный текст ответа в «Контур» не копируется.</p>
    </form>
  );

  return (
    <div className="v2-stack">
      <div><span className="v2-eyebrow">Результат сохранён</span><h1>Нить осталась у вас</h1></div>
      <p className="v2-lead">Можно вернуться к следующему шагу или выбрать другую текущую задачу.</p>
      <button className="v2-secondary" type="button" disabled={Boolean(busy)} onClick={onClose}>Выбрать другую задачу</button>
    </div>
  );
}

function AuxiliaryJourney({
  state,
  busy,
  onClose,
}: {
  state: ExperienceV2State;
  busy: boolean;
  onClose(): void;
}) {
  const intent = state.activeJourney!.intent;
  const copy = intent === 'orient'
    ? { eyebrow: 'Карта чатов', title: 'Где искать нужный разговор', note: 'Карта ограничена подключёнными чатами и не обещает знать всю историю.' }
    : intent === 'help'
      ? { eyebrow: 'Разговор помощи', title: 'Сейчас нет доступной нити', note: '«Контур» не создаёт искусственную активность. Разговор появится только после явного сохранения или доступного события Telegram.' }
      : { eyebrow: 'Возвращение', title: state.nest.length ? 'Сохранённые результаты ниже' : 'Пока возвращаться не к чему', note: 'Личное гнездо появляется после первого явно сохранённого результата.' };
  return (
    <div className="v2-stack">
      <div><span className="v2-eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p className="v2-lead">{copy.note}</p></div>
      {intent === 'orient' && state.chats.map((chat) => (
        <div className="v2-chat" key={chat.code}><i /><div><strong>{chat.title}</strong><p>{chat.purpose}</p></div></div>
      ))}
      <button className="v2-secondary" type="button" disabled={busy} onClick={onClose}>Выбрать другую задачу</button>
    </div>
  );
}

function NestCard({
  item,
  busy,
  onNextStep,
  onDelete,
  onReminder,
}: {
  item: NestItemDto;
  busy: string | null;
  onNextStep(value: string | null): void;
  onDelete(): void;
  onReminder(enabled: boolean): void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.nextStep ?? '');
  return (
    <article className="v2-nest-card">
      <div className="v2-nest-card__head"><span>{item.status === 'helped' ? 'Помогло' : item.status === 'clarify' ? 'Нужно уточнить' : item.status === 'done' ? 'Сделано' : 'Жду ответ'}</span></div>
      <strong>{item.label}</strong>
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); onNextStep(value.trim() || null); setEditing(false); }}>
          <input maxLength={240} value={value} onChange={(event) => setValue(event.target.value)} />
          <button type="submit" disabled={Boolean(busy)}>Сохранить шаг</button>
        </form>
      ) : <p>{item.nextStep ? `Дальше: ${item.nextStep}` : 'Следующий шаг не выбран'}</p>}
      <div className="v2-nest-card__actions">
        <button type="button" onClick={() => setEditing(true)}>Изменить шаг</button>
        {item.nextStep && item.reminderStatus !== 'sent' && (
          <button type="button" disabled={Boolean(busy)} onClick={() => onReminder(item.reminderStatus !== 'pending')}>
            {item.reminderStatus === 'pending' ? 'Не напоминать' : 'Напомнить один раз'}
          </button>
        )}
        {item.reminderStatus === 'sent' && <span className="v2-fine">Одно напоминание отправлено</span>}
        <button type="button" disabled={Boolean(busy)} onClick={onDelete}>Удалить из «Контура»</button>
      </div>
    </article>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="v2-field"><span>{label}</span><textarea rows={3} maxLength={500} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SignalBird({ stage }: { stage: ParticipationStage }) {
  const index = ['looking', 'thread', 'nest', 'connection'].indexOf(stage);
  return (
    <svg className={`v2-bird v2-bird--${stage}`} viewBox="0 0 280 220" role="img" aria-hidden="true">
      <g className="v2-signal-lines">
        <path d="M28 42 L88 68 L48 126 L112 160" />
        <path d="M208 38 L178 72 L238 112 L196 166" />
        {[0, 1, 2, 3].map((node) => <circle key={node} className={node <= index ? 'is-on' : ''} cx={[28, 88, 238, 196][node]} cy={[42, 68, 112, 166][node]} r="5" />)}
      </g>
      <g className="v2-bird-body">
        <path className="v2-bird__tail" d="M188 145 L238 161 L201 123 Z" />
        <path className="v2-bird__body" d="M117 75 C151 53 197 67 214 105 C229 140 203 177 163 180 C125 184 94 158 98 124 C100 101 106 84 117 75 Z" />
        <path className="v2-bird__chest" d="M119 77 C137 72 151 84 155 101 L147 164 C120 158 105 143 105 121 C105 99 110 85 119 77 Z" />
        <path className="v2-bird__face" d="M119 75 L163 65 L184 86 L155 104 L122 96 Z" />
        <path className="v2-bird__crest" d="M116 76 L153 55 L166 64 L138 84 Z" />
        <path className="v2-bird__beak" d="M178 83 L215 94 L181 103 Z" />
        <path className="v2-bird__wing" d="M157 101 L210 97 L202 150 L171 164 L141 141 Z" />
        <circle className="v2-bird__eye" cx="157" cy="81" r="5" />
        <circle className="v2-bird__pupil" cx="158" cy="81" r="2" />
        <path className="v2-bird__leg" d="M141 176 L136 202 M177 176 L181 202" />
      </g>
    </svg>
  );
}
