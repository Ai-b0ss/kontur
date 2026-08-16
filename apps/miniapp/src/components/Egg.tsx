interface EggProps {
  /** Сколько трещин показать, 0…8 — растёт с каждым ответом */
  cracks: number;
  /** Как ведёт себя яйцо прямо сейчас */
  mood: 'idle' | 'nudge' | 'smashing' | 'broken';
  size?: number;
}

/**
 * Яйцо онбординга.
 *
 * Трещины прибавляются с каждым ответом: человек видит, что осталось
 * недолго, и это единственное, что удерживает его на восьми вопросах.
 */
export function Egg({ cracks, mood, size = 200 }: EggProps) {
  const shown = Math.max(0, Math.min(CRACKS.length, cracks));

  return (
    <svg
      width={size}
      height={size * 1.24}
      viewBox="-60 -76 120 148"
      className={`egg egg--${mood}`}
      role="img"
      aria-label="Яйцо"
    >
      <defs>
        <linearGradient id="eggShell" x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#fdf6e6" />
          <stop offset="55%" stopColor="#f0e2c4" />
          <stop offset="100%" stopColor="#d9c49c" />
        </linearGradient>
        <radialGradient id="eggGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffca7a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffca7a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="eggClip">
          <path d={EGG_PATH} />
        </clipPath>
      </defs>

      {/* свечение изнутри крепнет вместе с трещинами */}
      <ellipse
        cx="0"
        cy="4"
        rx={62 + shown * 2}
        ry={74 + shown * 2}
        fill="url(#eggGlow)"
        opacity={0.15 + shown * 0.09}
      />

      <g className="egg__shell">
        <path d={EGG_PATH} fill="url(#eggShell)" />

        {/* крапинки */}
        <g clipPath="url(#eggClip)" opacity="0.5">
          {SPECKS.map((s, i) => (
            <ellipse key={i} cx={s[0]} cy={s[1]} rx={s[2]} ry={s[2] * 0.78} fill="#c2a678" />
          ))}
        </g>

        {/* трещины: показываем первые `shown` */}
        <g
          clipPath="url(#eggClip)"
          fill="none"
          stroke="#7a5f38"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {CRACKS.slice(0, shown).map((d, i) => (
            <path
              key={i}
              d={d}
              className="egg__crack"
              style={{ animationDelay: `${i * 0.04}s` }}
            />
          ))}
        </g>

        {/* блик */}
        <ellipse cx="-19" cy="-34" rx="12" ry="18" fill="#fff" opacity="0.35" transform="rotate(-18 -19 -34)" />
      </g>

      {/* осколки — появляются только на финальном ударе */}
      {mood === 'broken' && (
        <g className="egg__shards">
          {SHARDS.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="#f0e2c4"
              stroke="#c2a678"
              strokeWidth="1.2"
              style={
                {
                  '--dx': `${s.dx}px`,
                  '--dy': `${s.dy}px`,
                  '--rot': `${s.rot}deg`,
                  animationDelay: `${i * 0.02}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      )}
    </svg>
  );
}

const EGG_PATH =
  'M 0 -70 C 30 -70, 48 -34, 48 -4 C 48 32, 26 62, 0 62 C -26 62, -48 32, -48 -4 C -48 -34, -30 -70, 0 -70 Z';

const SPECKS: [number, number, number][] = [
  [-24, -40, 2.6], [12, -52, 2], [28, -18, 2.8], [-32, -2, 2.2],
  [18, 16, 2.4], [-14, 34, 3], [30, 34, 2], [-30, 22, 1.8],
  [4, -30, 1.6], [-6, 50, 2.2],
];

/** Восемь трещин — по одной на каждый вопрос теста. */
const CRACKS: string[] = [
  'M 2 -68 L -6 -54 L 4 -44',
  'M 4 -44 L -8 -34 L 6 -22',
  'M 6 -22 L -6 -12 L 8 0',
  'M -46 -6 L -30 -2 L -38 10',
  'M 8 0 L -4 10 L 10 22',
  'M 46 -4 L 30 4 L 40 16',
  'M 10 22 L -2 32 L 8 44',
  'M 8 44 L -12 52 L 2 62',
];

const SHARDS = [
  { d: 'M 0 -70 C 24 -68, 40 -40, 42 -14 L 6 -22 Z', dx: 46, dy: -56, rot: 38 },
  { d: 'M 0 -70 C -26 -68, -44 -38, -46 -10 L 4 -44 Z', dx: -50, dy: -46, rot: -42 },
  { d: 'M 42 -14 C 44 16, 28 44, 10 22 Z', dx: 62, dy: 10, rot: 66 },
  { d: 'M -46 -10 C -46 20, -28 46, -4 10 Z', dx: -64, dy: 16, rot: -70 },
  { d: 'M 10 22 C 22 44, 8 62, 0 62 C -10 62, -18 46, -4 10 Z', dx: 8, dy: 64, rot: 18 },
];
