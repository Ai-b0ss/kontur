import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColoringDto, EggOpenResponse, GameState, QuestionDto } from '@kontur/contracts';
import { resolveRole, type Role } from '@kontur/core';
import { ApiError, OfflineError, api, authenticate } from '../api.js';
import { LocalBirdVisual } from '../components/LocalBirdVisual.js';
import { QuizEgg } from '../components/QuizEgg.js';
import { ResultBird } from '../components/ResultBird.js';
import { initialLocalStage, needsLocalQuestions, reconcileColoring, shouldReduceMotion, wormWord } from '../local-kontur-model.js';
import { shouldBlockQuizAnswer, shouldEnterQ8Hatching } from '../q8-hatch-timeline.js';
import {
  personalizedBirdNote,
  selectBirdResult,
  parseStoredVibeVariant,
  vibeVariantStorageKey,
  type BirdResultId,
} from '../result-taxonomy.js';
import { haptic, initTelegram } from '../telegram.js';
import '../local-kontur.css';

type Stage = 'community' | 'hook' | 'questions' | 'hatching' | 'reveal' | 'worm' | 'home';

type BirdPresentation = {
  resultId: BirdResultId;
  name: string;
  note: string;
};

const BIRD_PRESENTATION: Record<BirdResultId, Omit<BirdPresentation, 'resultId'>> = {
  magpie: { name: 'сорока', note: 'быстро замечает, что можно сделать понятнее' },
  woodpecker: { name: 'дятел', note: 'любит докапываться до того, как всё устроено' },
  jay: { name: 'сойка', note: 'часто видит вариант, который другие не заметили' },
  crane: { name: 'журавль', note: 'собирает людей и доводит дело до конца' },
  owl: { name: 'сова', note: 'сначала смотрит, что происходит вокруг' },
  kotosov: { name: 'котосов', note: 'ловит вайб задачи и уже собирает рабочий прототип' },
};

const COMMUNITY_INTRO = [
  {
    number: '01',
    kicker: 'что это за чат',
    title: 'чат «чувачки»',
    body: 'он появился вокруг поступления в цу, но давно им не ограничивается. здесь обсуждают учёбу, свои проекты, мероприятия, технологии и обычные вещи из жизни.',
    meta: 'одной обязательной темы нет',
  },
  {
    number: '02',
    kicker: 'как здесь общаются',
    title: 'в основном, по ходу разговора',
    body: 'люди заходят с вопросом, ответом, проектом или идеей и постепенно узнают друг друга. можно просто подключиться к теме, которая уже идёт.',
    meta: 'читать весь чат с начала не нужно',
  },
  {
    number: '03',
    kicker: 'что полезно знать',
    title: 'многое здесь из личного опыта',
    body: 'особенно про поступление, учёбу и цу. такие ответы полезны как ориентир, но важные сроки и официальные условия лучше проверять в первоисточнике.',
    meta: 'остальное станет понятно по ходу',
  },
] as const;

const RARITY: Record<string, string> = {
  common: 'обычный',
  rare: 'редкий',
  legendary: 'легендарный',
};

function message(error: unknown, fallback: string) {
  if (error instanceof OfflineError) return 'Нет связи';
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function birdPresentation(role: Role | null | undefined, fallback: string, userId?: number): BirdPresentation {
  if (!role) return { resultId: 'owl', name: fallback.toLowerCase(), note: '' };
  let resultId = selectBirdResult({ resolvedRole: role }).resultId;
  if (role === 'vibe' && userId !== undefined) {
    try {
      resultId = parseStoredVibeVariant(window.localStorage.getItem(vibeVariantStorageKey(userId))) ?? 'owl';
    } catch {
      resultId = 'owl';
    }
  }
  return { resultId, ...BIRD_PRESENTATION[resultId] };
}

function WormMark({ big = false }: { big?: boolean }) {
  return (
    <span className={`lk-worm-icon ${big ? 'lk-worm-icon--big' : ''}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

function ContourMotif({ step = 0 }: { step?: number }) {
  return (
    <svg className="lk-contour" viewBox="0 0 360 210" aria-hidden="true">
      <path className="lk-contour__ghost" d="M18 159C73 156 80 99 132 106C181 113 187 52 236 59C283 66 283 119 342 111" />
      <path className="lk-contour__line" d="M18 159C73 156 80 99 132 106C181 113 187 52 236 59C283 66 283 119 342 111" pathLength="100" style={{ strokeDashoffset: `${Math.max(0, 74 - step * 25)}` }} />
      <circle cx="18" cy="159" r="5" className="lk-contour__node lk-contour__node--cyan" />
      <circle cx="132" cy="106" r="5" className={step >= 1 ? 'lk-contour__node lk-contour__node--worm' : 'lk-contour__node'} />
      <circle cx="236" cy="59" r="5" className={step >= 2 ? 'lk-contour__node lk-contour__node--egg' : 'lk-contour__node'} />
      <circle cx="342" cy="111" r="5" className={step >= 3 ? 'lk-contour__node lk-contour__node--cyan' : 'lk-contour__node'} />
    </svg>
  );
}

export function LocalKontur() {
  const reducedMotion = shouldReduceMotion(
    window.location.search,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [state, setState] = useState<GameState | null>(null);
  const [colorings, setColorings] = useState<ColoringDto[]>([]);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [stage, setStage] = useState<Stage>('hook');
  const [communityStep, setCommunityStep] = useState(0);
  const [index, setIndex] = useState(0);
  const [visualQuestionIndex, setVisualQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [reveal, setReveal] = useState<{ state: GameState } | null>(null);
  const [replayMode, setReplayMode] = useState(false);
  const [revealResultId, setRevealResultId] = useState<BirdResultId>('owl');
  const [revealNote, setRevealNote] = useState('');
  const [eggReveal, setEggReveal] = useState<EggOpenResponse | null>(null);
  const [eggOpening, setEggOpening] = useState(false);
  const [birdPulse, setBirdPulse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [eggResponding, setEggResponding] = useState(false);
  const [hatchReady, setHatchReady] = useState(false);
  const booting = useRef(false);
  const actionLock = useRef(false);
  const refreshLock = useRef(false);
  const coloringSyncGeneration = useRef(0);
  const pendingEggRequestId = useRef<string | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const answerTimer = useRef<number | null>(null);
  const hatchTimer = useRef<number | null>(null);
  const answerLock = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshLock.current || actionLock.current) return null;
    refreshLock.current = true;
    setRefreshing(true);
    const generation = ++coloringSyncGeneration.current;
    try {
      const payload = await api.localState();
      setState(payload.state);
      if (generation === coloringSyncGeneration.current) setColorings(payload.colorings);
      return payload;
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }, []);

  const syncColorings = useCallback(() => {
    const generation = ++coloringSyncGeneration.current;
    void api.localColorings()
      .then((payload) => {
        if (generation === coloringSyncGeneration.current) setColorings(payload.colorings);
      })
      .catch(() => {});
  }, []);

  const boot = useCallback(async () => {
    if (booting.current) return;
    booting.current = true;
    setError(null);
    try {
      initTelegram();
      const authenticated = await authenticate('local-kontur');
      const search = window.location.search;
      const [payload, firstQuestions] = await Promise.all([
        api.localState(),
        needsLocalQuestions(authenticated, search) ? api.localQuestions() : Promise.resolve(null),
      ]);
      const q = needsLocalQuestions(payload.state, search) && !firstQuestions
        ? await api.localQuestions()
        : firstQuestions;
      setState(payload.state);
      setColorings(payload.colorings);
      setQuestions(q?.questions ?? []);
      const initialStage = initialLocalStage(payload.state, search);
      setReplayMode(payload.state.hatched && initialStage === 'hook');
      setStage(initialStage);
    } catch (e) {
      setError(message(e, 'Контур не открылся'));
    } finally {
      booting.current = false;
    }
  }, []);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => () => {
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    if (answerTimer.current) window.clearTimeout(answerTimer.current);
    if (hatchTimer.current) window.clearTimeout(hatchTimer.current);
  }, []);

  useEffect(() => {
    if (shouldEnterQ8Hatching(stage, eggResponding, hatchReady)) {
      if (!eggResponding && hatchReady) setStage('hatching');
    }
  }, [stage, eggResponding, hatchReady]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && state?.hatched && !busy) {
        void refresh().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [state?.hatched, busy, refresh]);

  const advanceCommunity = () => {
    haptic('tap');
    if (communityStep + 1 < COMMUNITY_INTRO.length) {
      setCommunityStep((value) => value + 1);
      return;
    }
    setStage('hook');
  };

  const finishHatchReveal = () => {
    if (hatchTimer.current) window.clearTimeout(hatchTimer.current);
    hatchTimer.current = null;
    setStage('reveal');
  };

  useEffect(() => {
    if (stage !== 'hatching' || !hatchReady) return;
    if (hatchTimer.current) window.clearTimeout(hatchTimer.current);
    hatchTimer.current = window.setTimeout(finishHatchReveal, reducedMotion ? 20 : 2340);
    return () => {
      if (hatchTimer.current) window.clearTimeout(hatchTimer.current);
      hatchTimer.current = null;
    };
  }, [stage, hatchReady, reducedMotion]);

  const pick = (answer: number) => {
    if (shouldBlockQuizAnswer(answerLock.current, actionLock.current, busy)) return;
    answerLock.current = true;
    haptic('tap');
    const next = answers.slice();
    next[index] = answer;
    setAnswers(next);
    setVisualQuestionIndex(Math.min(questions.length - 1, index + 1));
    setEggResponding(true);
    if (answerTimer.current) window.clearTimeout(answerTimer.current);
    answerTimer.current = window.setTimeout(() => {
      setEggResponding(false);
      answerLock.current = false;
      if (index + 1 < questions.length) setIndex(index + 1);
    }, reducedMotion ? 0 : 260);
    if (index + 1 >= questions.length) {
      setHatchReady(false);
      void hatch(next);
    }
  };

  const beginAction = () => {
    if (actionLock.current || refreshLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    return true;
  };

  const endAction = () => {
    actionLock.current = false;
    setBusy(false);
  };

  const hatch = async (finalAnswers: number[]) => {
    if (!beginAction()) return;
    setError(null);
    try {
      if (replayMode && state) {
        const localResult = resolveRole(finalAnswers);
        const visualResult = selectBirdResult({
          resolvedRole: localResult.role,
          scores: localResult.scores,
        });
        setReveal({ state });
        setRevealResultId(visualResult.resultId);
        setRevealNote(personalizedBirdNote(visualResult.resultId, finalAnswers));
        setHatchReady(true);
        haptic('ok');
        return;
      }
      const result = await api.localHatch(finalAnswers);
      const localResult = resolveRole(finalAnswers);
      const visualResult = selectBirdResult({
        resolvedRole: result.role,
        scores: localResult.role === result.role ? localResult.scores : null,
      });
      setReveal(result);
      setRevealResultId(visualResult.resultId);
      setRevealNote(personalizedBirdNote(visualResult.resultId, finalAnswers));
      setState(result.state);
      setColorings((current) => reconcileColoring(current, {
        code: result.coloring,
        title: result.coloringTitle,
        rarity: 'common',
        palette: result.palette,
        equipped: true,
      }));
      if (result.role === 'vibe') {
        try {
          window.localStorage.setItem(vibeVariantStorageKey(result.state.player.userId), visualResult.resultId === 'kotosov' ? 'kotosov' : 'owl');
        } catch {
          // The safe presentation fallback after reload is owl.
        }
      }
      setHatchReady(true);
      syncColorings();
      haptic('ok');
    } catch (e) {
      setHatchReady(false);
      setError(message(e, 'Не получилось определить птицу'));
      haptic('fail');
    } finally {
      endAction();
    }
  };

  const openEgg = async () => {
    if (!state?.egg?.affordable || !beginAction()) return;
    setEggOpening(true);
    setError(null);
    const requestId = pendingEggRequestId.current ?? crypto.randomUUID();
    pendingEggRequestId.current = requestId;
    try {
      const [result] = await Promise.all([
        api.localOpenEgg(requestId),
        new Promise((resolve) => window.setTimeout(resolve, 920)),
      ]);
      pendingEggRequestId.current = null;
      setEggReveal(result);
      setState(result.state);
      setColorings((current) => reconcileColoring(current, {
        code: result.coloring,
        title: result.coloringTitle,
        rarity: result.rarity,
        palette: result.palette,
        equipped: result.state.player.coloring === result.coloring,
      }));
      syncColorings();
      haptic('ok');
    } catch (e) {
      setError(message(e, 'Яйцо не открылось'));
      haptic('fail');
    } finally {
      setEggOpening(false);
      endAction();
    }
  };

  const equip = async (code: string) => {
    if (!beginAction()) return;
    setError(null);
    try {
      const result = await api.localEquip(code);
      setState(result.state);
      setColorings((current) => current.map((item) => ({ ...item, equipped: item.code === code })));
      setEggReveal(null);
      setBirdPulse(false);
      window.requestAnimationFrame(() => {
        setBirdPulse(true);
        if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
        pulseTimer.current = window.setTimeout(() => setBirdPulse(false), 760);
      });
      syncColorings();
      haptic('ok');
    } catch (e) {
      setError(message(e, 'Не получилось надеть окрас'));
      haptic('fail');
    } finally {
      endAction();
    }
  };

  const manualRefresh = async () => {
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError(message(e, 'Не получилось обновить'));
    }
  };

  const startReplay = async () => {
    if (!beginAction()) return;
    setError(null);
    try {
      const payload = await api.localQuestions();
      setQuestions(payload.questions);
      setAnswers([]);
      setIndex(0);
      setVisualQuestionIndex(0);
      setReveal(null);
      setHatchReady(false);
      setReplayMode(true);
      setStage('hook');
    } catch (e) {
      setError(message(e, 'Не получилось открыть тест заново'));
    } finally {
      endAction();
    }
  };

  if (error && !state) {
    return (
      <main className={`lk lk-center${reducedMotion ? ' lk-reduced-motion' : ''}`}>
        <div className="lk-mark">КОНТУР</div>
        <h1>Не открылось</h1>
        <p className="lk-muted">{error}</p>
        <button className="lk-button" onClick={() => void boot()}>Попробовать ещё раз</button>
      </main>
    );
  }

  if (!state || (needsLocalQuestions(state, window.location.search) && !questions.length)) {
    return (
      <main className={`lk lk-center${reducedMotion ? ' lk-reduced-motion' : ''}`}>
        <div className="lk-mark">КОНТУР</div>
        <div className="lk-loader" aria-label="Загрузка" />
        <p className="lk-muted">загружаем</p>
      </main>
    );
  }

  if (!state.hatched && stage === 'community') {
    const slide = COMMUNITY_INTRO[communityStep]!;
    return (
      <main className={`lk lk-onboarding lk-community${reducedMotion ? ' lk-reduced-motion' : ''}`}>
        <header className="lk-top">
          <span className="lk-mark">КОНТУР · ЧУВАЧКИ</span>
          <span>{communityStep + 1} / {COMMUNITY_INTRO.length}</span>
        </header>
        <section className="lk-community-slide" key={slide.number}>
          <ContourMotif step={communityStep + 1} />
          <span className="lk-editorial-number">{slide.number}</span>
          <div className="lk-community-copy">
            <p className="lk-kicker">{slide.kicker}</p>
            <h1>{slide.title}</h1>
            <p className="lk-lead">{slide.body}</p>
            <p className="lk-meta-line">{slide.meta}</p>
          </div>
          <button className="lk-button lk-button--arrow" onClick={advanceCommunity}>
            {communityStep + 1 < COMMUNITY_INTRO.length ? 'дальше' : 'к птице'}
            <span aria-hidden="true">↗</span>
          </button>
        </section>
      </main>
    );
  }

  if (((!state.hatched || replayMode) && (stage === 'hook' || stage === 'questions')) || stage === 'hatching' || stage === 'reveal') {
    const question = questions[index];
    const eggStage = stage === 'hook' ? 1 : Math.min(8, visualQuestionIndex + 1);
    const bird = BIRD_PRESENTATION[revealResultId];
    const showingReveal = stage === 'reveal' && Boolean(reveal);
    return (
      <main className={`lk lk-onboarding lk-first-time lk-first-time--${stage}${eggResponding ? ' is-egg-responding' : ''}${reducedMotion ? ' lk-reduced-motion' : ''}`}>
        <header className="lk-top">
          <span className="lk-mark">КОНТУР</span>
          <span>{showingReveal ? 'готово' : stage === 'hook' ? '01' : `${String(index + 1).padStart(2, '0')} / 08`}</span>
        </header>
        <div className="lk-progress" aria-hidden="true">
          <span style={{ width: stage === 'hook' ? '0%' : `${((visualQuestionIndex + 1) / questions.length) * 100}%` }} />
        </div>

        <section className="lk-hook-copy" aria-hidden={stage !== 'hook'}>
          <p className="lk-kicker">8 коротких вопросов</p>
          <h1>Какая ты<br />птица <em>в IT?</em></h1>
        </section>

        <div className="lk-quiz-egg-stage">
          <QuizEgg
            stage={eggStage}
            hatching={stage === 'hatching' || stage === 'reveal'}
            resultId={revealResultId}
          />
        </div>

        <section className="lk-hook-action" aria-hidden={stage !== 'hook'}>
          <p>8 вопросов. Пара минут —<br />и узнаешь свою птицу.</p>
          <button className="lk-button lk-button--arrow" onClick={() => { haptic('tap'); setStage('questions'); }}>
            начать
          </button>
        </section>

        {question && (
          <section className="lk-question lk-question--egg" key={index} aria-hidden={stage !== 'questions'}>
            <span className="lk-question-number">{String(index + 1).padStart(2, '0')}</span>
            <p className="lk-kicker">выбирай первое, что ближе</p>
            <h1>{question.text}</h1>
            <div className="lk-options">
              {question.options.map((option, optionIndex) => (
                <button key={option} onClick={() => pick(optionIndex)} disabled={busy || answerLock.current} style={{ animationDelay: `${optionIndex * 34}ms` }}>
                  <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                </button>
              ))}
            </div>
            {index > 0 && !busy && (
              <button className="lk-text-button" onClick={() => { const previous = Math.max(0, index - 1); setIndex(previous); setVisualQuestionIndex(previous); }}>← назад</button>
            )}
            {error && <p className="lk-error">{error}</p>}
          </section>
        )}

        <p className="lk-hatching-label" aria-live="polite">{stage === 'hatching' ? 'внутри уже светло' : ''}</p>
        {stage === 'hatching' && <button className="lk-skip-motion" onClick={finishHatchReveal}>пропустить анимацию</button>}

        {showingReveal && (
          <section className="lk-reveal lk-reveal--inline">
            <div className="lk-reveal-signal" aria-hidden="true"><span /><span /><span /></div>
            <p className="lk-kicker">это твоя птица</p>
            <h1>{bird.name}</h1>
            <p className="lk-lead">{revealNote || bird.note}</p>
            <button className="lk-button" onClick={() => setStage('worm')}>что дальше</button>
          </section>
        )}
      </main>
    );
  }

  if (stage === 'worm' && reveal) {
    return (
      <main className={`lk lk-onboarding lk-worm-screen${reducedMotion ? ' lk-reduced-motion' : ''}`}>
        <header className="lk-top"><span className="lk-mark">КОНТУР</span><span>после теста</span></header>
        <section className="lk-worm-intro">
          <p className="lk-worm-command">/worm</p>
          <h1>так здесь говорят<br />«это было полезно»</h1>
          <p className="lk-lead">Если чьё-то сообщение реально помогло, ответь на него командой <code>/worm</code>. Автор получит червяка.</p>
          <div className="lk-worm-equation"><strong>{reveal.state.egg?.cost ?? 5} червяков</strong> = яйцо<br />с новым окрасом</div>
          <button className="lk-button" onClick={() => { setReplayMode(false); setStage('home'); }}>к моей птице</button>
        </section>
      </main>
    );
  }

  const egg = state.egg;
  const remaining = egg ? Math.max(0, egg.cost - state.player.wallet) : 0;
  const progress = egg ? Math.min(100, Math.round((state.player.wallet / egg.cost) * 100)) : 0;
  const owned = colorings.filter((item) => item.owned);
  const currentBird = birdPresentation(state.player.role, state.player.roleTitle ?? 'птица', state.player.userId);

  return (
    <main className={`lk lk-home${reducedMotion ? ' lk-reduced-motion' : ''}`}>
      {eggOpening && (
        <div className="lk-hatch-overlay" role="status" aria-live="polite">
          <div className="lk-hatch-pulse" />
          <div className="lk-hatch-egg" aria-hidden="true"><span className="lk-crack lk-crack--one" /><span className="lk-crack lk-crack--two" /></div>
          <p className="lk-kicker">открываем яйцо</p>
          <strong>сейчас посмотрим</strong>
        </div>
      )}

      <header className="lk-top">
        <span className="lk-mark">КОНТУР</span>
        <button
          className={`lk-refresh ${refreshing ? 'is-refreshing' : ''}`}
          onClick={() => void manualRefresh()}
          disabled={busy || refreshing}
          aria-label={refreshing ? 'Обновляется' : 'Обновить'}
          aria-busy={refreshing}
        >↻</button>
      </header>

      <section className="lk-hero">
        <span className="lk-hero-index" aria-hidden="true">01</span>
        <div className={`lk-bird-stage lk-bird-stage--home ${birdPulse ? 'is-pulsing' : ''}`}>
          <ResultBird resultId={currentBird.resultId} />
        </div>
        <div className="lk-identity">
          <p className="lk-kicker">твоя птица</p>
          <h1>{currentBird.name}</h1>
          <p>{currentBird.note}</p>
        </div>
        <div className="lk-balance" aria-label={`${state.player.wallet} ${wormWord(state.player.wallet)}`}>
          <WormMark big />
          <strong>{state.player.wallet}</strong>
          <span>{wormWord(state.player.wallet)}</span>
        </div>
        <p className="lk-balance-note">их получают через <code>/worm</code> в чате</p>
      </section>

      <section className="lk-section lk-egg-section">
        <span className="lk-section-index" aria-hidden="true">02</span>
        <div className="lk-section-head">
          <div>
            <p className="lk-kicker">следующий окрас</p>
            <h2>яйцо</h2>
          </div>
          <span className="lk-price">{egg?.cost ?? 0} <WormMark /></span>
        </div>
        <div className="lk-egg-editorial">
          <div className={`lk-egg ${busy ? 'is-busy' : ''}`} aria-hidden="true"><span /></div>
          <div className="lk-egg-copy">
            {egg?.affordable ? (
              <><strong>можно открывать</strong><span>внутри будет новый окрас</span></>
            ) : (
              <><strong>ещё {remaining} {wormWord(remaining)} до яйца</strong></>
            )}
          </div>
        </div>
        <div className="lk-meter" aria-label={`Прогресс до яйца ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
        {egg?.affordable && <button className="lk-button lk-button--egg" onClick={() => void openEgg()} disabled={busy || refreshing}>{busy ? 'открываем…' : 'открыть яйцо'}</button>}
      </section>

      {eggReveal && (
        <section className={`lk-drop lk-drop--${eggReveal.rarity}`}>
          <p className="lk-kicker">новый окрас</p>
          <div className="lk-bird-stage lk-bird-stage--drop">
            <LocalBirdVisual role={state.player.role} userId={state.player.userId} palette={eggReveal.palette} size={252} mood="achieved" />
          </div>
          <h2>{eggReveal.coloringTitle}</h2>
          <p>{RARITY[eggReveal.rarity] ?? eggReveal.rarity}. теперь он в коллекции</p>
          <button className="lk-button" onClick={() => void equip(eggReveal.coloring)} disabled={busy || refreshing}>надеть окрас</button>
        </section>
      )}

      <section className="lk-section lk-collection-section">
        <span className="lk-section-index" aria-hidden="true">03</span>
        <div className="lk-section-head">
          <div><p className="lk-kicker">твоя коллекция</p><h2>окрасы</h2></div>
          <span className="lk-counter">{owned.length}/{colorings.length}</span>
        </div>
        <div className="lk-colors">
          {colorings.map((item) => (
            <button
              key={item.code}
              className={`lk-color ${item.equipped ? 'is-equipped' : ''} ${!item.owned ? 'is-locked' : ''}`}
              disabled={!item.owned || item.equipped || busy || refreshing}
              onClick={() => void equip(item.code)}
              aria-label={item.owned ? `${item.title}${item.equipped ? ', надет' : ''}` : 'Закрытый окрас'}
            >
              <span className="lk-color-visual" aria-hidden="true">
                {item.owned ? <LocalBirdVisual role={state.player.role} userId={state.player.userId} palette={item.palette} size={88} /> : <span className="lk-color-locked">?</span>}
              </span>
              <span className="lk-color-copy">
                <span className="lk-color-name">{item.owned ? item.title.toLowerCase() : 'ещё не открыт'}</span>
                <span className="lk-color-hint">{item.equipped ? 'сейчас выбран' : item.owned ? 'можно надеть' : 'выпадает из яйца'}</span>
              </span>
              {item.equipped && <span className="lk-color-state">активен</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="lk-help">
        <button className="lk-help-toggle" onClick={() => setHelpOpen((value) => !value)}>
          как работает /worm <span>{helpOpen ? '−' : '+'}</span>
        </button>
        {helpOpen && (
          <div className="lk-help-body">
            <p>Ответь <code>/worm</code> на сообщение, которое хочется отдельно отметить. Автор получит 1 червяка.</p>
            <p>5 червяков открывают яйцо с новым окрасом.</p>
            <p>Себе отправить нельзя. Для повторных <code>/worm</code> одному человеку есть лимиты.</p>
          </div>
        )}
      </section>

      <button className="lk-replay" onClick={() => void startReplay()} disabled={busy || refreshing}>
        посмотреть тест заново
        <span>профиль и птица не изменятся</span>
      </button>

      {error && <div className="lk-toast" role="status">{error}</div>}
    </main>
  );
}
