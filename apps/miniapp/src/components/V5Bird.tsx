export type V5BirdKind = 'woodpecker' | 'magpie' | 'owl' | 'crane';
export type V5BirdForm = 'base' | 'advanced';
export type V5BirdState = 'idle' | 'ready' | 'active' | 'victory' | 'dimmed';

export interface V5BirdProps {
  /** Four campaign directions from V5_PRODUCT_SPEC.md. */
  bird: V5BirdKind;
  /** Form II adds a visual signature only; it is not a hidden numeric power-up. */
  form?: V5BirdForm;
  /** Render size in CSS pixels. The SVG keeps its own viewBox at every size. */
  size?: number;
  /** The screen chooses a state; this component never starts game state itself. */
  state?: V5BirdState;
  /** Optional outer hook for layout only. All visual state classes stay on the SVG. */
  className?: string;
  /** Override the Russian accessible name when surrounding copy gives more context. */
  label?: string;
}

const BIRD_LABEL: Record<V5BirdKind, string> = {
  woodpecker: 'Дятел',
  magpie: 'Сорока',
  owl: 'Сова',
  crane: 'Журавль',
};

/**
 * Original vector birds for the V5 campaign. They deliberately avoid bitmap
 * assets so all four forms remain crisp inside a narrow Telegram Mini App.
 * Palette and motion live in live-campaign.css under the .v5-* namespace.
 */
export function V5Bird({
  bird,
  form = 'base',
  size = 156,
  state = 'idle',
  className,
  label,
}: V5BirdProps) {
  const classes = [
    'v5-bird',
    `v5-bird--${bird}`,
    `v5-bird--${form}`,
    `v5-bird--${state}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 240 240"
      role="img"
      aria-label={label ?? `Птица кампании: ${BIRD_LABEL[bird]}`}
      focusable="false"
    >
      <g className="v5-bird__shadow" aria-hidden="true">
        <ellipse cx="121" cy="212" rx="64" ry="11" />
      </g>
      {bird === 'woodpecker' && <Woodpecker advanced={form === 'advanced'} />}
      {bird === 'magpie' && <Magpie advanced={form === 'advanced'} />}
      {bird === 'owl' && <Owl advanced={form === 'advanced'} />}
      {bird === 'crane' && <Crane advanced={form === 'advanced'} />}
    </svg>
  );
}

function Woodpecker({ advanced }: { advanced: boolean }) {
  return (
    <g className="v5-bird__figure v5-bird__figure--woodpecker">
      <path className="v5-bird__tail" d="M157 166 208 197 155 195 139 169Z" />
      <path className="v5-bird__tail-line" d="m161 175 35 17m-43-8 37 5" />
      <path className="v5-bird__body" d="M76 110c4-35 31-57 66-54 31 3 52 27 53 59l-5 64c-3 27-24 42-57 42-33 0-54-16-57-42Z" />
      <path className="v5-bird__belly" d="M87 132c15 12 31 17 49 16 22-1 39-8 51-20l-2 47c-2 21-20 33-49 33-28 0-46-12-48-33Z" />
      <path className="v5-bird__wing" d="M149 103c25 5 38 23 35 48-3 21-17 35-39 37l-39-28c1-26 16-48 43-57Z" />
      <path className="v5-bird__wing-line" d="m145 122 25 25m-36-8 29 31m-41-11 25 28" />
      <path className="v5-bird__crest" d="m96 70-7-36 22 25 6-39 14 39 20-27-8 39Z" />
      <path className="v5-bird__mask" d="M76 94c13-27 38-40 66-34l17 20-27 25-35-1Z" />
      <path className="v5-bird__beak" d="m77 96-53 16 51 13 17-15Z" />
      <circle className="v5-bird__eye-ring" cx="103" cy="86" r="14" />
      <circle className="v5-bird__eye" cx="101" cy="87" r="5" />
      <path className="v5-bird__leg" d="m108 205-4 17m36-17 4 17m-22-1-24 3m42-3 24 3" />
      {advanced && (
        <g className="v5-bird__signature">
          <path d="M151 92c17 4 31 13 39 28" />
          <path d="m193 108 9 10-13 1" />
          <path d="M120 45h34" />
          <circle cx="159" cy="45" r="5" />
        </g>
      )}
    </g>
  );
}

function Magpie({ advanced }: { advanced: boolean }) {
  return (
    <g className="v5-bird__figure v5-bird__figure--magpie">
      <path className="v5-bird__tail" d="M162 162 223 211 146 192 129 165Z" />
      <path className="v5-bird__tail-line" d="m158 173 51 30m-65-23 57 14" />
      <path className="v5-bird__body" d="M67 111c4-34 29-56 64-56 35 0 60 24 62 60l-5 59c-3 30-24 47-58 47-35 0-56-17-59-47Z" />
      <path className="v5-bird__belly" d="M82 119c12 19 33 30 56 29 19 0 35-6 49-18l-2 43c-2 23-21 35-54 35-31 0-49-13-52-35Z" />
      <path className="v5-bird__wing" d="M141 99c28 3 44 20 43 47-1 25-16 40-40 43l-41-30c0-26 15-50 38-60Z" />
      <path className="v5-bird__wing-line" d="m142 119 27 20m-37-3 31 26m-42-6 31 23" />
      <path className="v5-bird__crest" d="m96 65 4-36 18 30 14-35 7 39 24-20-15 33Z" />
      <path className="v5-bird__mask" d="M72 95c9-27 35-42 65-36l23 19-29 29-37-2Z" />
      <path className="v5-bird__beak" d="m74 96-55 5 53 22 19-13Z" />
      <circle className="v5-bird__eye-ring" cx="100" cy="86" r="14" />
      <circle className="v5-bird__eye" cx="99" cy="87" r="5" />
      <path className="v5-bird__leg" d="m106 205-4 17m36-17 4 17m-22-1-24 3m42-3 24 3" />
      {advanced && (
        <g className="v5-bird__signature">
          <path d="m175 69 16 8-4 18-17 9-16-9-4-18 16-8Z" />
          <path d="m161 87 5 5 10-10" />
          <path d="M66 144h32" />
        </g>
      )}
    </g>
  );
}

function Owl({ advanced }: { advanced: boolean }) {
  return (
    <g className="v5-bird__figure v5-bird__figure--owl">
      <path className="v5-bird__tail" d="m161 168 45 30-53-8-18-22Z" />
      <path className="v5-bird__tail-line" d="m153 178 38 13m-45-5 35 2" />
      <path className="v5-bird__body" d="m73 103 8-54 27 19 20-28 23 28 30-19 5 54 10 64c3 34-21 55-64 55-44 0-68-21-65-55Z" />
      <path className="v5-bird__belly" d="M82 140c13 11 30 17 49 17 22 0 39-6 52-18l4 31c3 25-16 40-54 40-39 0-58-15-55-40Z" />
      <path className="v5-bird__wing" d="M151 108c27 8 39 28 33 56-5 22-19 35-42 36l-37-34c4-29 18-50 46-58Z" />
      <path className="v5-bird__wing-line" d="m143 131 25 23m-35-10 28 30m-42-14 29 29" />
      <path className="v5-bird__mask" d="M75 101c8-29 29-45 55-44 28 0 48 17 53 45l-16 35-34-10-36 9Z" />
      <circle className="v5-bird__eye-ring" cx="105" cy="96" r="21" />
      <circle className="v5-bird__eye-ring" cx="148" cy="96" r="21" />
      <circle className="v5-bird__eye" cx="106" cy="97" r="7" />
      <circle className="v5-bird__eye" cx="147" cy="97" r="7" />
      <path className="v5-bird__beak" d="m126 110-13 21 14 11 14-12Z" />
      <path className="v5-bird__leg" d="m108 207-4 16m36-16 4 16m-22-1-24 3m42-3 24 3" />
      {advanced && (
        <g className="v5-bird__signature">
          <path d="M74 143c16 9 31 13 45 12" />
          <path d="M81 152c17 10 34 13 51 9" />
          <path d="M159 63v-19m-10 9h20" />
        </g>
      )}
    </g>
  );
}

function Crane({ advanced }: { advanced: boolean }) {
  return (
    <g className="v5-bird__figure v5-bird__figure--crane">
      <path className="v5-bird__tail" d="m160 168 52 31-57-10-15-22Z" />
      <path className="v5-bird__tail-line" d="m154 178 44 14m-49-5 39 2" />
      <path className="v5-bird__body" d="M83 126c2-26 19-44 45-45 31-1 53 18 56 49l4 47c3 29-17 46-52 46-36 0-57-17-56-46Z" />
      <path className="v5-bird__belly" d="M89 151c14 11 31 16 49 15 17 0 31-5 45-15l1 24c2 23-14 35-47 35-34 0-51-12-50-35Z" />
      <path className="v5-bird__wing" d="M145 112c29 4 44 24 39 52-4 23-20 37-43 38l-38-35c3-28 17-49 42-55Z" />
      <path className="v5-bird__wing-line" d="m144 131 25 23m-35-11 28 31m-43-13 30 28" />
      <path className="v5-bird__neck" d="M93 129c-17-23-17-47-5-71 8-15 21-26 36-31l13 18c-16 7-26 17-30 31-4 15 1 31 15 47l-10 31Z" />
      <path className="v5-bird__mask" d="m90 48 4-24 16 17 9-24 11 29-16 20Z" />
      <path className="v5-bird__beak" d="m86 52-63-3 61 18 18-12Z" />
      <circle className="v5-bird__eye-ring" cx="101" cy="55" r="12" />
      <circle className="v5-bird__eye" cx="100" cy="55" r="4.5" />
      <path className="v5-bird__leg" d="m112 208-5 17m35-17 5 17m-24-1-23 3m42-3 24 3" />
      {advanced && (
        <g className="v5-bird__signature">
          <path d="M51 76h36" />
          <path d="m58 69-8 7 8 7m22-14 8 7-8 7" />
          <path d="M161 96c12 7 21 17 26 30" />
        </g>
      )}
    </g>
  );
}
