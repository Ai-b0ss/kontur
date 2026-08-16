import { useEffect, useMemo, useState } from 'react';
import {
  resolveZeroSeasonAction,
  zeroSeasonEffect,
  zeroSeasonLeader,
  type ZeroSeasonBird,
  type ZeroSeasonBoard,
  type ZeroSeasonIntent,
} from '@kontur/core';
import type { Palette } from '@kontur/contracts';
import { api, authenticate, type ZeroSeasonCore, type ZeroSeasonFlight, type ZeroSeasonLastRound, type ZeroSeasonState } from '../api';
import { ZeroSeasonBirdIllustration } from '../components/ZeroSeasonBird.js';
import { ZeroSeasonTree } from '../components/ZeroSeasonTree.js';
import { initTelegram } from '../telegram.js';
import '../zero-season.css';

type Stage = 'intro' | 'pretest' | 'profile' | 'bird' | 'lesson' | 'board' | 'quiz' | 'result';
type Profile = Record<ZeroSeasonBird, number>;

const LESSON_KEY = 'kontur.zero.lesson.v2';
const INTRO_ROTATION: ZeroSeasonBird[] = ['woodpecker', 'magpie', 'owl', 'crane'];

const CLASSIC_PALETTE: Palette = {
  body: '#edd9b6',
  belly: '#faeed6',
  wing: '#d3ae74',
  tail: '#c09a68',
  crest: '#c8a26c',
  beak: '#ef8a52',
};

const BIRDS: Array<{ id: ZeroSeasonBird; title: string; mark: string; description: string }> = [
  { id: 'woodpecker', title: 'Дятел', mark: '⌁', description: 'Техника · ищет точный сбой в системе' },
  { id: 'magpie', title: 'Сорока', mark: '◈', description: 'Дизайн · замечает лишний шаг и ловушку' },
  { id: 'owl', title: 'Сова', mark: '◉', description: 'Аналитика · отделяет факт от вывода' },
  { id: 'crane', title: 'Журавль', mark: '⌂', description: 'Координация · собирает порядок из ограничений' },
];

const PRETEST: Array<{ text: string; options: Array<{ text: string; bird: ZeroSeasonBird }> }> = [
  { text: 'В инструкции есть пять шагов. Что сначала проверишь?', options: [{ text: 'Где условие не покрывает крайний случай', bird: 'woodpecker' }, { text: 'На каком шаге человек потеряется', bird: 'magpie' }, { text: 'Какой вывод реально следует из данных', bird: 'owl' }, { text: 'Что блокирует остальные шаги', bird: 'crane' }] },
  { text: 'Три задачи не помещаются в срок. Твой первый ход?', options: [{ text: 'Разбить работу на минимальные части', bird: 'woodpecker' }, { text: 'Убрать действие, не дающее ценности', bird: 'magpie' }, { text: 'Сравнить риск и ожидаемый эффект', bird: 'owl' }, { text: 'Поставить зависимости в порядок', bird: 'crane' }] },
  { text: 'Таблица показывает рост. Как не ошибиться с выводом?', options: [{ text: 'Проверить формулу расчёта', bird: 'woodpecker' }, { text: 'Посмотреть, не скрыт ли важный сценарий', bird: 'magpie' }, { text: 'Сравнить с базой и размером выборки', bird: 'owl' }, { text: 'Уточнить, кто принимает решение по данным', bird: 'crane' }] },
  { text: 'Пользователь бросает форму на втором поле. Что делать?', options: [{ text: 'Проверить валидацию и состояние', bird: 'woodpecker' }, { text: 'Убрать или объяснить лишнее поле', bird: 'magpie' }, { text: 'Сначала измерить, где именно уходят', bird: 'owl' }, { text: 'Согласовать владельца исправления', bird: 'crane' }] },
  { text: 'Новое условие ломает старый план. Что ценнее?', options: [{ text: 'Пересчитать все ветви условия', bird: 'woodpecker' }, { text: 'Сохранить понятный путь для человека', bird: 'magpie' }, { text: 'Проверить, меняет ли условие вывод', bird: 'owl' }, { text: 'Перестроить порядок и договорённости', bird: 'crane' }] },
  { text: 'В решении есть один неверный переход. Как найдёшь?', options: [{ text: 'Пройду входные данные по шагам', bird: 'woodpecker' }, { text: 'Найду место, где ожидание расходится с действием', bird: 'magpie' }, { text: 'Отделю факт от допущения', bird: 'owl' }, { text: 'Проверю зависимость следующих задач', bird: 'crane' }] },
  { text: 'Нужно объяснить сложное решение за минуту.', options: [{ text: 'Покажу минимальный рабочий пример', bird: 'woodpecker' }, { text: 'Уберу термины и лишние развилки', bird: 'magpie' }, { text: 'Начну с доказательства главного вывода', bird: 'owl' }, { text: 'Скажу, кто и что делает дальше', bird: 'crane' }] },
  { text: 'У двух гипотез одинаковый первый результат.', options: [{ text: 'Найду вход, который их различит', bird: 'woodpecker' }, { text: 'Проверю разницу в опыте пользователя', bird: 'magpie' }, { text: 'Соберу недостающий критерий сравнения', bird: 'owl' }, { text: 'Выберу обратимое решение на сейчас', bird: 'crane' }] },
  { text: 'Команда спорит о первом шаге.', options: [{ text: 'Зафиксирую ограничения задачи', bird: 'woodpecker' }, { text: 'Сделаю вариант, который проще проверить руками', bird: 'magpie' }, { text: 'Назову данные, которых не хватает', bird: 'owl' }, { text: 'Разложу решение по владельцам и срокам', bird: 'crane' }] },
  { text: 'После ошибки нужно выбрать следующий эксперимент.', options: [{ text: 'Изменю один параметр, а не всё сразу', bird: 'woodpecker' }, { text: 'Проверю самый болезненный сценарий', bird: 'magpie' }, { text: 'Сформулирую, что результат сможет доказать', bird: 'owl' }, { text: 'Сделаю эксперимент коротким и согласованным', bird: 'crane' }] },
];

type QuizQuestion = { id: string; text: string; options: string[]; answer?: number };
const SERIES: QuizQuestion[] = [
  { id: 'local-1', text: 'Правило: скидка 20% применяется один раз. Цена 500. Итог?', options: ['400', '480', '300', '520'], answer: 0 },
  { id: 'local-2', text: 'После скидки 20% цену подняли на 20%. Сравни с исходной.', options: ['Та же', 'Ниже исходной', 'Выше исходной', 'Нельзя узнать'], answer: 1 },
  { id: 'local-3', text: 'Где ошибка: 500 − 20% = 480?', options: ['Вычли 20 единиц вместо 20%', 'Сначала нужно прибавить', 'Проценты нельзя вычитать', 'Ошибки нет'], answer: 0 },
  { id: 'local-4', text: 'Бюджет 1 200, на задачу ушло 25%. Сколько осталось?', options: ['300', '900', '1 100', '975'], answer: 1 },
  { id: 'local-5', text: 'Конверсия выросла с 10% до 15%. Это рост на…', options: ['5%', '50%', '15 п.п.', '5 п.п. и 50%'], answer: 3 },
];

const EMPTY_BOARD: ZeroSeasonBoard = { nests: Array(7).fill(null), shields: [], marks: [] };
const INITIAL_PROFILE: Profile = { woodpecker: 0, magpie: 0, owl: 0, crane: 0 };
const RANK_LABEL = { rookie: 'старт', field: 'полевой', crown: 'корона' } as const;
const INTENT_LABEL = { attack: 'Забрать', shield: 'Защитить', scout: 'Разведать' } as const;
const INTENT_HINT = {
  attack: 'место станет твоим',
  shield: 'защитит место от чужого захвата',
  scout: 'подсветит место на карте',
} as const;
const birdMeta = (bird: ZeroSeasonBird) => BIRDS.find((item) => item.id === bird)!;

function SeasonBird({
  bird,
  size,
  mood = 'ready',
}: {
  bird: ZeroSeasonBird;
  size: number;
  mood?: 'calm' | 'ready' | 'active' | 'achieved';
}) {
  return <ZeroSeasonBirdIllustration bird={bird} palette={CLASSIC_PALETTE} size={size} mood={mood} />;
}

function hasSeenLesson(): boolean {
  try {
    return window.localStorage.getItem(LESSON_KEY) === '1';
  } catch {
    return false;
  }
}

function markLessonSeen(): void {
  try {
    window.localStorage.setItem(LESSON_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function ZeroSeason() {
  const query = new URLSearchParams(window.location.search);
  // Telegram menu URLs use a single stable season parameter; shared links may
  // additionally carry online=1. Both must enter the real, authenticated game.
  const online = query.get('season') === 'zero' || query.get('online') === '1';
  const [stage, setStage] = useState<Stage>('intro');
  const [pretestIndex, setPretestIndex] = useState(0);
  const [profile, setProfile] = useState<Profile>(INITIAL_PROFILE);
  const [bird, setBird] = useState<ZeroSeasonBird | null>(null);
  const [hasBaseProfile, setHasBaseProfile] = useState(false);
  const [board, setBoard] = useState<ZeroSeasonBoard>(EMPTY_BOARD);
  const [intent, setIntent] = useState<ZeroSeasonIntent>('scout');
  const [nest, setNest] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [series, setSeries] = useState<QuizQuestion[]>(SERIES);
  const [settled, setSettled] = useState<{ correct: number; effect: ReturnType<typeof zeroSeasonEffect>; review: Array<{ correct: boolean; answer: number }> } | null>(null);
  const [difficulty, setDifficulty] = useState<'base' | 'applied' | 'advanced'>('base');
  const [seconds, setSeconds] = useState(75);
  const [seasonDay, setSeasonDay] = useState(1);
  const [, setSeasonLeft] = useState(34);
  const [eggs, setEggs] = useState(0);
  const [mastery, setMastery] = useState(0);
  const [rank, setRank] = useState<'rookie' | 'field' | 'crown'>('rookie');
  const [forecast, setForecast] = useState<{ bird: ZeroSeasonBird; status: string } | null>(null);
  const [flight, setFlight] = useState<ZeroSeasonFlight | null>(null);
  const [lastRound, setLastRound] = useState<ZeroSeasonLastRound | null>(null);
  const [core, setCore] = useState<ZeroSeasonCore | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [actionRecorded, setActionRecorded] = useState(false);
  const [launchCopied, setLaunchCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lessonStep, setLessonStep] = useState(0);
  const [introBirdIndex, setIntroBirdIndex] = useState(0);

  const recommended = useMemo(() => BIRDS.map((item) => item.id).sort((a, b) => profile[b] - profile[a])[0], [profile]);
  const leader = zeroSeasonLeader(board);
  const introBird = INTRO_ROTATION[introBirdIndex] ?? 'woodpecker';

  useEffect(() => {
    initTelegram();
    document.body.classList.add('zero-surface');
    return () => document.body.classList.remove('zero-surface');
  }, []);

  const openLesson = () => {
    setLessonStep(0);
    setStage('lesson');
  };

  const finishLesson = () => {
    markLessonSeen();
    setStage('board');
  };

  const applyServerState = (state: ZeroSeasonState) => {
    setBoard(state.board);
    setSeasonDay(state.season.day);
    setSeasonLeft(state.season.daysLeft);
    setEggs(state.eggs);
    setForecast(state.forecast);
    setFlight(state.flight);
    setLastRound(state.lastRound);
    setCore(state.core ?? null);
    setActionRecorded(Boolean(state.actionTaken));
    if (state.actionTaken) setOnlineError(null);
    if (state.flight) {
      setIntent(state.flight.intent);
      setNest(state.flight.nest);
    }
    const activePath = state.paths.find((path) => path.bird === (state.activeBird ?? state.profile?.bird));
    setMastery(activePath?.mastery ?? 0);
    setRank(activePath?.rank ?? 'rookie');
  };

  useEffect(() => {
    if (stage !== 'intro') return;
    const timer = window.setInterval(() => {
      setIntroBirdIndex((index) => (index + 1) % INTRO_ROTATION.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'quiz') return;
    if (seconds <= 0) {
      setAnswers((current) => [...current, ...Array(Math.max(0, series.length - current.length)).fill(-1)]);
      setStage('result');
      return;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [stage, seconds, series.length]);

  useEffect(() => {
    if (!online) return;
    let active = true;
    void authenticate('zero-season').then(() => api.zeroSeasonState()).then((state) => {
      if (!active) return;
      applyServerState(state);
      if (state.profile) {
        setProfile(state.profile.scores);
        setHasBaseProfile(true);
        setBird(state.activeBird);
        if (state.activeBird) {
          if (hasSeenLesson()) setStage('board');
          else {
            setLessonStep(0);
            setStage('lesson');
          }
        } else {
          setStage('bird');
        }
      }
    }).catch(() => {
      if (active) setOnlineError('Не удалось войти. Открой Контур через Telegram и убедись, что состоишь в основном чате.');
    });
    return () => { active = false; };
  }, [online]);

  const answerPretest = (nextBird: ZeroSeasonBird) => {
    setProfile((current) => ({ ...current, [nextBird]: current[nextBird] + 1 }));
    if (pretestIndex === PRETEST.length - 1) setStage('profile');
    else setPretestIndex((index) => index + 1);
  };

  const startQuiz = async () => {
    if (actionRecorded) return;
    setAnswers([]); setSettled(null); setQuizIndex(0);
    if (online) {
      try {
        const payload = await api.startZeroSeasonSeries(intent, nest);
        setSeries(payload.questions.map((question) => ({ id: question.id, text: question.prompt, options: question.options })));
        setSeconds(payload.seconds);
        setDifficulty(payload.difficulty);
        setIntent(payload.intent);
        setNest(payload.nest);
        setFlight(payload.flight);
        setOnlineError(null);
      } catch {
        try {
          const state = await api.zeroSeasonState();
          applyServerState(state);
          if (state.actionTaken) return;
        } catch {
          /* keep fallback message below */
        }
        setOnlineError('Серию не удалось открыть. Проверь доступ к сезону и попробуй позже.');
        return;
      }
    } else {
      setSeries(SERIES);
      setSeconds(75);
      setDifficulty('base');
    }
    setStage('quiz');
  };

  const answerQuiz = (answer: number) => {
    const next = [...answers, answer];
    setAnswers(next);
    if (quizIndex === series.length - 1) setStage('result');
    else setQuizIndex((index) => index + 1);
  };

  const applyResult = async () => {
    if (!bird) return;
    const localCorrect = answers.filter((answer, index) => answer === series[index]!.answer).length;
    const localEffect = zeroSeasonEffect(localCorrect, intent);
    if (online) {
      try {
        const result = await api.saveZeroSeasonSeries(answers);
        setSettled({ correct: result.correct, effect: result.effect, review: result.review });
        const activePath = result.paths.find((path) => path.bird === bird);
        setMastery(activePath?.mastery ?? 0);
        setRank(activePath?.rank ?? 'rookie');
        applyServerState(await api.zeroSeasonState());
        setActionRecorded(true);
      } catch {
        setOnlineError('Ход не записан. Проверь доступ к сезону и попробуй позже.');
      }
    } else {
      setSettled({ correct: localCorrect, effect: localEffect, review: series.map((question, index) => ({ correct: answers[index] === question.answer, answer: question.answer ?? -1 })) });
      if (localEffect !== 'none') setBoard((current) => resolveZeroSeasonAction(current, bird, localEffect, nest).board);
    }
    setStage('board');
  };

  const confirmBird = async () => {
    if (!bird) return;
    if (online) {
      try {
        if (hasBaseProfile) await api.chooseZeroSeasonBird(bird);
        else await api.saveZeroSeasonProfile(bird, profile);
        const state = await api.zeroSeasonState();
        applyServerState(state);
        setHasBaseProfile(true);
        setBird(state.activeBird);
      } catch {
        setOnlineError('Профиль не записан. Проверь вход через Telegram и повтори попытку.');
        return;
      }
    }
    openLesson();
  };

  const placeForecast = async (target: ZeroSeasonBird) => {
    try {
      const saved = await api.saveZeroSeasonForecast(target);
      setForecast(saved.forecast);
      setEggs(saved.eggs);
    } catch {
      setOnlineError('Прогноз не поставлен: нужен один жетон, другая птица и ход ещё не сделан.');
    }
  };

  const joinFlight = async () => {
    try {
      const result = await api.joinZeroSeasonFlight(intent, nest);
      setFlight(result.flight);
      setIntent(result.flight.intent);
      setNest(result.flight.nest);
    } catch {
      setOnlineError('В команду уже нельзя войти: ход сделан, ожидание отменено или сезон закрыт.');
    }
  };

  const leaveFlight = async () => {
    try {
      await api.leaveZeroSeasonFlight();
      setFlight(null);
    } catch {
      setOnlineError('Собранную команду уже нельзя отменить: цель зафиксирована.');
    }
  };

  const copyLaunch = async () => {
    const link = `${window.location.origin}${window.location.pathname}?season=zero`;
    const text = [
      'КОНТУР · живой чат',
      'Реплаем /worm отмечаем пользу.',
      'В мини-приложении — птица, яйца и один короткий ход в день.',
      '',
      link,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setLaunchCopied(true);
    } catch {
      setOnlineError('Не удалось скопировать текст. Открой игру по ссылке из адресной строки.');
    }
  };

  const correct = settled?.correct ?? answers.filter((answer, index) => answer === series[index]!.answer).length;
  const effect = settled?.effect ?? zeroSeasonEffect(correct, intent);
  const primarySeriesLabel = flight?.status === 'open'
    ? 'Ждём команду 4–6'
    : 'Сделать ход · ~75 сек';

  if (stage === 'intro') {
    return (
      <main className="zero">
        <section className="zero-stage zero-intro">
          <div className="zero-bird-stage zero-bird-stage--intro" aria-hidden="true">
            <SeasonBird bird={introBird} size={148} mood="calm" />
          </div>
          <p className="zero-brand">КОНТУР</p>
          <h1>Твоя птица в живом чате</h1>
          <p className="zero-lead">Отмечай полезные сообщения через /worm и делай один короткий ход на общем дереве каждый день.</p>
          {onlineError && <p className="zero-hint">{onlineError}</p>}
          <button className="zero-primary" onClick={() => setStage('pretest')}>Начать</button>
        </section>
      </main>
    );
  }

  if (stage === 'pretest') {
    const question = PRETEST[pretestIndex]!;
    const number = pretestIndex + 1;
    return (
      <main className="zero">
        <SeasonHeader subtitle={`Тест · ${number}/10`} />
        <section className="zero-stage">
          <div className="zero-progress"><i style={{ width: `${(number / PRETEST.length) * 100}%` }} /></div>
          <h2>{question.text}</h2>
          <p className="zero-soft">~2 минуты · выбирай как обычно решаешь</p>
          <div className="zero-options">
            {question.options.map((option) => (
              <button key={option.text} onClick={() => answerPretest(option.bird)}>{option.text}</button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (stage === 'profile') {
    const meta = birdMeta(recommended);
    return (
      <main className="zero">
        <SeasonHeader subtitle="профиль" />
        <section className="zero-stage">
          <p className="zero-kicker">Гипотеза по ответам</p>
          <div className="zero-reveal">
            <div className={`zero-bird-stage zero-bird-stage--reveal tone-${recommended}`}>
              <SeasonBird bird={recommended} size={156} />
            </div>
            <h1>{meta.title}</h1>
            <p>Заметнее всего по твоим решениям. Сезон может подтвердить или опровергнуть.</p>
          </div>
          <div className="zero-bars">
            {BIRDS.map((item) => (
              <div key={item.id}>
                <span>{item.title}</span>
                <i><b style={{ width: `${profile[item.id] * 10}%` }} /></i>
              </div>
            ))}
          </div>
          <button className="zero-primary" onClick={() => setStage('bird')}>Выбрать птицу сезона</button>
        </section>
      </main>
    );
  }

  if (stage === 'bird') {
    return (
      <main className="zero">
        <SeasonHeader subtitle="выбор птицы" />
        <section className="zero-stage">
          <div className="zero-reveal">
            {bird ? (
              <div className={`zero-bird-stage zero-bird-stage--reveal tone-${bird}`}>
                <SeasonBird bird={bird} size={156} />
              </div>
            ) : (
              <div className="zero-bird-stage zero-bird-stage--reveal zero-bird-stage--empty" aria-hidden="true" />
            )}
            <h1>{bird ? birdMeta(bird).title : 'Кто полетит с тобой'}</h1>
            <p>Одна активная птица на сезон. Другие пути не закрываются.</p>
          </div>
          <div className="zero-birds">
            {BIRDS.map((item) => (
              <button className={bird === item.id ? 'is-selected' : ''} key={item.id} onClick={() => setBird(item.id)}>
                <strong>
                  <span className="zero-bird-chip" aria-hidden="true">
                    <SeasonBird bird={item.id} size={36} mood={bird === item.id ? 'ready' : 'calm'} />
                  </span>
                  {' '}{item.title}{item.id === recommended ? ' · совет' : ''}
                </strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
          {onlineError && <p className="zero-hint">{onlineError}</p>}
          <button className="zero-primary" disabled={!bird} onClick={() => void confirmBird()}>Дальше · как это работает</button>
        </section>
      </main>
    );
  }

  if (stage === 'lesson') {
    const active = bird ?? recommended;
    const meta = birdMeta(active);
    const stepLabel = `обучение · ${lessonStep + 1}/3`;

    if (lessonStep === 0) {
      return (
        <main className="zero">
          <SeasonHeader subtitle={stepLabel} />
          <section className="zero-stage zero-lesson">
            <div className={`zero-bird-stage zero-bird-stage--lesson tone-${active}`}>
              <SeasonBird bird={active} size={180} />
            </div>
            <h1>Ты — {meta.title}</h1>
            <p className="zero-lead">{meta.description}</p>
            <button className="zero-primary" onClick={() => setLessonStep(1)}>Дальше</button>
          </section>
        </main>
      );
    }

    if (lessonStep === 1) {
      return (
        <main className="zero">
          <SeasonHeader subtitle={stepLabel} />
          <section className="zero-stage zero-lesson">
            <div className="zero-lesson-worm" aria-hidden="true">
              <span className="zero-worm-glyph">∿</span>
              <div className="zero-worm-flow">
                <span>реплай</span>
                <strong>/worm</strong>
                <span>→ уважение + червяк</span>
              </div>
            </div>
            <p className="zero-kicker">В группе</p>
            <h1>Отмечай пользу через /worm</h1>
            <p className="zero-lead">
              Ответь реплаем <code>/worm</code> на полезное сообщение. Автор получает уважение и червяка в кошелёк.
            </p>
            <p className="zero-soft">Из уважения копятся жетоны («яйца») и окрасы птицы — твоя коллекция.</p>
            <button className="zero-primary" onClick={() => setLessonStep(2)}>Дальше</button>
          </section>
        </main>
      );
    }

    return (
      <main className="zero">
        <SeasonHeader subtitle={stepLabel} />
        <section className="zero-stage zero-lesson">
          <div className="zero-lesson-day" aria-hidden="true">
            <span>5</span>
            <small>вопросов</small>
          </div>
          <p className="zero-kicker">Сегодня</p>
          <h1>Один ход в день</h1>
          <p className="zero-lead">
            У чата одно общее дерево из 7 мест. Ты выбираешь место и действие
            (забрать / защитить / разведать), потом отвечаешь на 5 коротких вопросов.
            Хорошие ответы — действие реально меняет дерево.
          </p>
          <p className="zero-soft">
            В группе реплаем <code>/worm</code> отмечаешь пользу → растут уважение и червяки.
            «Яйца» — это жетоны: ими можно поставить прогноз, кто сегодня сильнее.
            Места всегда находятся прямо на ветвях общего дерева.
          </p>
          <button className="zero-primary" onClick={finishLesson}>К дереву</button>
        </section>
      </main>
    );
  }

  if (stage === 'quiz') {
    const question = series[quizIndex]!;
    const difficultyLabel = difficulty === 'base' ? 'база' : difficulty === 'applied' ? 'практика' : 'составное правило';
    return (
      <main className="zero">
        <SeasonHeader subtitle={`серия · ${difficultyLabel}`} />
        <section className="zero-stage">
          <div className="zero-quizhead">
            <span>{quizIndex + 1} из 5</span>
            <strong>{seconds} с</strong>
          </div>
          <div className="zero-progress"><i style={{ width: `${((quizIndex + 1) / series.length) * 100}%` }} /></div>
          <h2>{question.text}</h2>
          <div className="zero-options">
            {question.options.map((option, index) => (
              <button key={option} onClick={() => answerQuiz(index)}>{option}</button>
            ))}
          </div>
          <p className="zero-soft">Назад нельзя — это снижает угадывание, а не устраивает гонку.</p>
        </section>
      </main>
    );
  }

  if (stage === 'result') {
    return (
      <main className="zero">
        <SeasonHeader subtitle="итог" />
        <section className="zero-stage zero-result">
          <p className="zero-kicker">Серия закрыта</p>
          <h1>{correct}/5</h1>
          <p>
            {effect === 'none'
              ? 'Дерево не изменилось — ответов не хватило.'
              : effect === 'scout'
                ? `Место ${nest + 1} подсвечено на общем дереве.`
                : `На месте ${nest + 1}: ${INTENT_LABEL[intent].toLowerCase()}.`}
          </p>
          <div className="zero-review">
            {series.map((question, index) => {
              const review = settled?.review[index];
              const isCorrect = review?.correct ?? answers[index] === question.answer;
              const answer = review?.answer ?? question.answer;
              return (
                <div key={question.id} className={isCorrect ? 'ok' : 'bad'}>
                  {isCorrect ? '✓' : '—'} {index + 1}. {isCorrect ? 'Верно' : `Верно: ${question.options[answer ?? -1] ?? 'нет ответа'}`}
                </div>
              );
            })}
          </div>
          <button className="zero-primary" onClick={() => void applyResult()}>К дереву</button>
        </section>
      </main>
    );
  }

  const moveHeadline = actionRecorded ? 'Сегодня всё' : 'Один ход на дереве';

  return (
    <main className="zero">
      <header className="zero-header">
        <span className="zero-brand">КОНТУР</span>
        <b>день {seasonDay}/35</b>
      </header>

      <section className="zero-home">
        <div className="zero-home-hero">
          {bird ? (
            <div className="zero-bird-stage zero-bird-stage--home">
              <SeasonBird bird={bird} size={190} mood={actionRecorded ? 'calm' : 'ready'} />
            </div>
          ) : (
            <div className="zero-bird-stage zero-bird-stage--home zero-bird-stage--empty" aria-hidden="true" />
          )}
          <p className="zero-home-caption">
            {bird ? birdMeta(bird).title : 'Выбери птицу'}
            {' · '}
            {RANK_LABEL[rank]}
            {leader ? ` · лидер: ${birdMeta(leader).title}` : ''}
          </p>
        </div>

        <div className="zero-home-move">
          <span className="zero-kicker">{actionRecorded ? 'ХОД ЗАВЕРШЁН' : 'СЕГОДНЯ'}</span>
          <h1>{moveHeadline}</h1>
          <p className="zero-home-summary">
            {actionRecorded
              ? 'Ход принят. Дерево обновится после конца игрового дня.'
              : 'Выбери место, действие и ответь на пять коротких вопросов.'}
          </p>
        </div>

        <div className="zero-branch">
          <div className="zero-branch-head">
            <strong>Общее дерево</strong>
            <span>{actionRecorded ? `день ${seasonDay}` : `место ${nest + 1} из 7`}</span>
          </div>
          <ZeroSeasonTree
            board={board}
            selected={nest}
            disabled={actionRecorded}
            onSelect={setNest}
          />
        </div>

        {!actionRecorded && (
          <div className="zero-home-cta">
            <div className="zero-intents" aria-label="Действие на выбранном месте">
              {(['attack', 'shield', 'scout'] as ZeroSeasonIntent[]).map((next) => (
                <button key={next} className={intent === next ? 'is-selected' : ''} onClick={() => setIntent(next)} type="button">
                  <strong>{INTENT_LABEL[next]}</strong>
                  <small>{INTENT_HINT[next]}</small>
                </button>
              ))}
            </div>

            {onlineError && <p className="zero-hint">{onlineError}</p>}

            <button
              className="zero-primary"
              disabled={flight?.status === 'open'}
              onClick={() => void startQuiz()}
              type="button"
            >
              {primarySeriesLabel}
            </button>

            <p className="zero-hint">
              {flight
                ? `Команда ${flight.members}/4–6 · ${INTENT_LABEL[flight.intent]} на месте ${flight.nest + 1}.`
                : `Место ${nest + 1} · ${INTENT_LABEL[intent]} · ~75 сек`}
            </p>
          </div>
        )}

        {actionRecorded && onlineError && <p className="zero-hint">{onlineError}</p>}

        <div className="zero-resources" aria-label="Ресурсы">
          <span className="zero-resource zero-resource--egg">
            <i aria-hidden="true" />
            <span><b>{eggs}</b><small>жетонов</small></span>
          </span>
          {core?.hatched && (
            <span className="zero-resource zero-resource--worm">
              <i aria-hidden="true">∿</i>
              <span><b>{core.wallet}</b><small>червяков</small></span>
            </span>
          )}
        </div>

        <button className="zero-link" onClick={openLesson} type="button">
          Как это работает
        </button>

        <details className="zero-details" open={detailsOpen} onToggle={(event) => setDetailsOpen((event.target as HTMLDetailsElement).open)}>
          <summary>Подробности</summary>
          <div className="zero-details-body">
            {core?.hatched && (
              <p className="zero-soft">
                Уважение {core.reputation}
                {core.roleTitle || core.birdName || core.coloringTitle
                  ? ` · ${core.roleTitle ?? core.birdName ?? core.coloringTitle}`
                  : ''}
                {mastery > 0 ? ` · сильных серий: ${mastery}` : ''}
              </p>
            )}
            {online && lastRound && BIRDS.some((item) => lastRound.actions[item.id]) && (
              <div className="zero-review zero-review--quiet">
                <span className="zero-kicker">Прошлая ночь · день {lastRound.gameDay}</span>
                {BIRDS.map((item) => {
                  const action = lastRound.actions[item.id];
                  if (!action) return null;
                  return (
                    <div className="ok" key={item.id}>
                      {item.title} · {INTENT_LABEL[action.intent]} · место {action.nest + 1} · голосов {action.votes}
                    </div>
                  );
                })}
              </div>
            )}
            {online && !actionRecorded && (
              <>
                {forecast ? (
                  <p className="zero-soft">Прогноз: {birdMeta(forecast.bird).title} · {forecast.status}</p>
                ) : (
                  <div className="zero-options zero-options--compact">
                    {BIRDS.filter((item) => item.id !== bird).map((item) => (
                      <button key={item.id} disabled={eggs < 1} onClick={() => void placeForecast(item.id)}>
                        Прогноз: {item.title} · 1 жетон
                      </button>
                    ))}
                  </div>
                )}
                {flight ? (
                  <div className="zero-today">
                    <span className="zero-kicker">Команда</span>
                    <p>{flight.members}/4–6 · {INTENT_LABEL[flight.intent]} · место {flight.nest + 1}</p>
                    {flight.status === 'open' && <button className="zero-secondary" onClick={() => void leaveFlight()}>Выйти из ожидания</button>}
                  </div>
                ) : (
                  <button className="zero-secondary" onClick={() => void joinFlight()}>
                    Собрать команду на этот ход
                  </button>
                )}
              </>
            )}
            <button className="zero-secondary zero-secondary--quiet" onClick={() => void copyLaunch()} type="button">
              {launchCopied ? 'Приглашение скопировано' : 'Скопировать приглашение'}
            </button>
          </div>
        </details>
      </section>
    </main>
  );
}

function SeasonHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="zero-header">
      <span className="zero-brand">КОНТУР</span>
      <b>{subtitle ?? 'дерево'}</b>
    </header>
  );
}
