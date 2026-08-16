import { useEffect, useRef, useState } from 'react';
import type { HatchResponse, QuestionDto } from '@kontur/contracts';
import { Egg } from '../components/Egg.js';
import { Hand } from '../components/Hand.js';
import { Bird } from '../components/Bird.js';
import { api, ApiError, OfflineError } from '../api.js';
import { haptic, shareToChat } from '../telegram.js';
import { Failed, Loading } from '../components/ui.js';

type Stage = 'intro' | 'questions' | 'name' | 'smash' | 'drop';

interface Props {
  onHatched(r: HatchResponse): void;
  variant?: 'legacy' | 'restored';
}

/**
 * Онбординг: яйцо → восемь вопросов → удар → птица.
 *
 * Это единственный экран, который человек видит первым и по которому решает,
 * остаться или закрыть. Поэтому здесь анимации, а не форма из восьми полей.
 */
export function Onboarding({ onHatched, variant = 'legacy' }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [questions, setQuestions] = useState<QuestionDto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [birdName, setBirdName] = useState('');
  const [result, setResult] = useState<HatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hatching = useRef(false);

  useEffect(() => {
    api
      .questions()
      .then((r) => setQuestions(r.questions))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить вопросы'),
      );
  }, []);

  const pick = (option: number) => {
    haptic('tap');
    const next = [...answers];
    next[index] = option;
    setAnswers(next);

    if (index + 1 < (questions?.length ?? 8)) {
      setIndex(index + 1);
    } else {
      setStage('name');
    }
  };

  const backQuestion = () => {
    haptic('tap');
    setError(null);
    if (index > 0) setIndex(index - 1);
    else setStage('intro');
  };

  /** Финал: рука бьёт, и только потом приходит результат с сервера. */
  const smash = async () => {
    if (hatching.current) return;
    hatching.current = true;
    haptic('ok');
    setStage('smash');

    try {
      // Ответ ждём параллельно с анимацией, но показываем не раньше,
      // чем удар отыграет — иначе дроп проскакивает незамеченным
      const [r] = await Promise.all([
        api.hatch(answers, birdName.trim() || undefined),
        new Promise((res) => setTimeout(res, 1900)),
      ]);
      setResult(r);
      setStage('drop');
      haptic('ok');
    } catch (e) {
      hatching.current = false;
      setStage('name');
      if (e instanceof OfflineError) setError('Нет связи');
      else setError(e instanceof ApiError ? e.message : 'Не удалось вылупиться');
    }
  };

  if (error && !questions) return <Failed text={error} />;
  if (!questions) return <Loading what="Готовим яйцо" />;

  const cracks =
    stage === 'intro' ? 0 : stage === 'questions' ? index : questions.length;

  return (
    <div className={`ob${variant === 'restored' ? ' ob--restored' : ''}`}>
      {/* ── сцена с яйцом: живёт на всех экранах, кроме дропа ── */}
      {stage !== 'drop' && (
        <div className="ob__stage">
          <div className="ob__glow" />
          <Egg
            cracks={cracks}
            mood={
              stage === 'smash'
                ? 'broken'
                : stage === 'intro'
                  ? 'nudge'
                  : cracks >= questions.length
                    ? 'nudge'
                    : 'idle'
            }
            size={stage === 'questions' ? 132 : 190}
          />
          {stage === 'smash' && <Hand pose="fist" className="hand--punch" />}
        </div>
      )}

      {/* ── экран 1: приглашение ── */}
      {stage === 'intro' && (
        <div className="ob__panel">
          <h1 className="ob__title">Восемь выборов. Одна птица.</h1>
          <p className="ob__sub">
            Роль остаётся с тобой, а окрас и путь будут развиваться через полезные действия.
          </p>
          <button className="btn btn--primary" onClick={() => { haptic('tap'); setStage('questions'); }}>
            Начать
          </button>
        </div>
      )}

      {/* ── экран 2: вопросы, которые выставляет рука ── */}
      {stage === 'questions' && (
        <div className="ob__cards">
          <div className="ob__progress">
            {questions.map((_, i) => (
              <span key={i} className={`ob__pip ${i <= index ? 'ob__pip--on' : ''}`} />
            ))}
          </div>

          <div className="ob__cardwrap" key={index}>
            <Hand pose="card" className="hand--deal" />
            <div className="ob__card">
              <div className="ob__num">
                {index + 1} / {questions.length}
              </div>
              <div className="ob__q">{questions[index]!.text}</div>
              <div className="ob__opts">
                {questions[index]!.options.map((text, i) => (
                  <button key={i} className="ob__opt" onClick={() => pick(i)}>
                    {text}
                  </button>
                ))}
              </div>
              <button className="ob__back" type="button" onClick={backQuestion}>
                Назад
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── имя перед ударом ── */}
      {stage === 'name' && (
        <div className="ob__panel">
          <h1 className="ob__title">Дай птице имя</h1>
          <p className="ob__sub">Можно оставить без имени — роль от этого не изменится.</p>
          <input
            className="input"
            placeholder="Имя птицы"
            maxLength={24}
            value={birdName}
            onChange={(e) => setBirdName(e.target.value)}
          />
          {error && <p className="ob__err small">{error}</p>}
          <button className="btn btn--primary" onClick={smash}>
            Разбить яйцо
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              haptic('tap');
              setError(null);
              setIndex(questions.length - 1);
              setStage('questions');
            }}
          >
            Проверить ответы
          </button>
        </div>
      )}

      {/* ── экран 3: дроп ── */}
      {stage === 'drop' && result && (
        <div className="ob__drop">
          <div className="ob__burst" />
          <div className="ob__bird">
            <Bird role={result.role} palette={result.palette} size={224} />
          </div>
          <div className="ob__reveal">
            <div className="ob__role">{result.roleTitle}</div>
            <div className="ob__tagline">{result.roleTagline}</div>
            {result.state.player.birdName && (
              <div className="ob__name">{result.state.player.birdName}</div>
            )}
            <div className="ob__coloring">окрас · {result.coloringTitle}</div>
          </div>

          <div className="ob__actions">
            <button
              className="btn btn--primary"
              onClick={() => {
                haptic('tap');
                shareToChat(result.shareText);
              }}
            >
              Похвастаться в чат
            </button>
            <button className="btn btn--ghost" onClick={() => onHatched(result)}>
              Потом
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
