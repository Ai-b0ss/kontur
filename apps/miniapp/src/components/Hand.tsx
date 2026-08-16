interface HandProps {
  /**
   * `card` — выставляет карточку вопроса из-за кадра,
   * `fist` — сжатый кулак для финального удара.
   */
  pose: 'card' | 'fist';
  className?: string;
}

/**
 * Закадровая рука в белой перчатке.
 *
 * Она и выставляет вопросы, и в конце разбивает яйцо — это один и тот же
 * персонаж, поэтому финал читается как продолжение, а не как новый экран.
 */
export function Hand({ pose, className = '' }: HandProps) {
  return (
    <svg
      viewBox="0 0 120 160"
      className={`hand hand--${pose} ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="glove" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#ece9f2" />
          <stop offset="100%" stopColor="#cfcada" />
        </linearGradient>
      </defs>

      {/* манжета уходит за кадр */}
      <path
        fill="#d8d3e4"
        stroke="#b7b1c8"
        strokeWidth="1.4"
        d="M 30 132 L 90 132 L 96 168 L 24 168 Z"
      />
      <path fill="#f2eff7" d="M 33 132 L 87 132 L 89 142 L 31 142 Z" />

      {pose === 'card' ? (
        <>
          {/* ладонь, держащая карточку снизу */}
          <path
            fill="url(#glove)"
            stroke="#b7b1c8"
            strokeWidth="1.4"
            d="M 28 84
               C 24 66, 30 58, 38 60
               C 40 46, 50 44, 54 54
               C 58 42, 68 43, 70 54
               C 74 46, 84 49, 84 60
               L 86 96
               C 88 118, 74 134, 58 134
               C 40 134, 28 118, 28 100 Z"
          />
          {/* большой палец */}
          <path
            fill="url(#glove)"
            stroke="#b7b1c8"
            strokeWidth="1.4"
            d="M 28 88 C 18 82, 10 88, 14 98 C 18 108, 26 112, 32 108 Z"
          />
        </>
      ) : (
        <>
          {/* кулак */}
          <path
            fill="url(#glove)"
            stroke="#b7b1c8"
            strokeWidth="1.5"
            d="M 26 92
               C 22 72, 34 60, 56 60
               C 80 60, 92 72, 92 92
               L 92 104
               C 92 124, 78 136, 58 136
               C 38 136, 26 124, 26 106 Z"
          />
          {/* костяшки */}
          <g fill="none" stroke="#b7b1c8" strokeWidth="1.6" strokeLinecap="round">
            <path d="M 36 82 C 42 76, 50 76, 54 82" />
            <path d="M 56 80 C 62 74, 70 74, 74 80" />
            <path d="M 76 84 C 81 79, 87 80, 89 85" />
          </g>
          <path
            fill="url(#glove)"
            stroke="#b7b1c8"
            strokeWidth="1.4"
            d="M 26 96 C 16 92, 10 100, 16 110 C 22 118, 30 118, 34 112 Z"
          />
        </>
      )}
    </svg>
  );
}
