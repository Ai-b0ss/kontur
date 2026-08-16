import type { Role } from '@kontur/core';
import type { Palette } from '@kontur/contracts';

interface LocalBirdProps {
  role: Role | null;
  palette: Palette;
  size?: number;
  mood?: 'calm' | 'ready' | 'active' | 'achieved';
}

const INK = '#22302F';
const INK_DEEP = '#13201F';
const INK_SOFT = '#334140';
const PAPER = '#F0EEE8';
const PAPER_LIGHT = '#F7F5EE';
const PAPER_SOFT = '#E4E1D8';
const WARM = '#D9C49A';
const LEG = '#5E6B68';

const NAMES: Record<Role, string> = {
  designer: 'сорока',
  coder: 'дятел',
  creative: 'сойка',
  manager: 'журавль',
  vibe: 'сова',
};

/**
 * Птицы LOCAL MVP: лёгкие редакционные векторные силуэты.
 * Окрас меняет только отдельные зоны, поэтому вид птицы остаётся узнаваемым.
 */
export function LocalBird({ role, palette, size = 240, mood = 'calm' }: LocalBirdProps) {
  const actualRole = role ?? 'vibe';
  const pose = mood === 'achieved' ? 'translate(0 -3)' : mood === 'ready' ? 'translate(2 -1)' : '';

  return (
    <svg
      width={size}
      height={Math.round(size * 0.78)}
      viewBox="0 0 280 210"
      className={`local-bird local-bird--${mood} local-bird--${actualRole}`}
      role="img"
      aria-label={NAMES[actualRole]}
    >
      <FieldLine mood={mood} />
      <g transform={pose}>
        {actualRole === 'designer' && <Magpie palette={palette} />}
        {actualRole === 'coder' && <Woodpecker palette={palette} />}
        {actualRole === 'creative' && <Jay palette={palette} />}
        {actualRole === 'manager' && <Crane palette={palette} />}
        {actualRole === 'vibe' && <Owl palette={palette} />}
      </g>
    </svg>
  );
}

function FieldLine({ mood }: { mood: LocalBirdProps['mood'] }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d="M34 174C93 168 158 170 241 162" stroke="#343638" strokeWidth="1" />
      <path d="M74 170L58 178M214 164L230 171" stroke="#343638" strokeWidth="1" />
      {mood === 'achieved' && (
        <>
          <path d="M42 155C91 135 189 131 240 146" stroke="#5AC8D5" strokeWidth="1.15" strokeDasharray="2 7" opacity=".72" />
          <circle cx="42" cy="155" r="3.2" fill="#5AC8D5" stroke="none" />
        </>
      )}
    </g>
  );
}

function Eye({ cx, cy, r = 2.4 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r + 1.3} fill={PAPER_LIGHT} opacity=".95" />
      <circle cx={cx} cy={cy} r={r} fill={INK_DEEP} />
      <circle cx={cx - 0.7} cy={cy - 0.8} r="0.72" fill="#fff" opacity=".88" />
    </>
  );
}

function LegPair({ left, right, y = 172 }: { left: number; right: number; y?: number }) {
  return (
    <g fill="none" stroke={LEG} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${left} ${y - 28}L${left - 4} ${y}`} />
      <path d={`M${left - 4} ${y}L${left - 16} ${y + 5}M${left - 4} ${y}L${left + 7} ${y + 6}M${left - 4} ${y}L${left - 2} ${y + 8}`} />
      <path d={`M${right} ${y - 28}L${right + 3} ${y}`} />
      <path d={`M${right + 3} ${y}L${right - 10} ${y + 5}M${right + 3} ${y}L${right + 14} ${y + 6}M${right + 3} ${y}L${right + 4} ${y + 9}`} />
    </g>
  );
}

function FeatherMarks({ lines }: { lines: string[] }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="1" opacity=".18" strokeLinecap="round">
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

function Magpie({ palette }: { palette: Palette }) {
  return (
    <g stroke={INK_SOFT} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      {/* Long tail behind the body. */}
      <path d="M177 124C205 116 230 108 256 98C237 118 218 135 188 151Z" fill="#173033" stroke="none" />
      <path d="M183 132C209 126 232 120 253 114C232 134 211 148 187 160Z" fill={palette.tail} stroke="none" opacity=".82" />

      {/* One light body, with the dark back laid over it. */}
      <path d="M96 122C106 106 128 98 151 100C177 101 197 113 200 130C204 147 186 159 160 162C134 165 109 157 99 145C92 137 91 130 96 122Z" fill={PAPER} />
      <path d="M104 116C121 101 145 99 166 104C183 108 195 118 199 130C185 124 170 122 154 124C135 127 119 134 107 145C99 138 98 125 104 116Z" fill={INK_DEEP} stroke="none" />

      {/* Head and neck are deliberately one connected silhouette. */}
      <path d="M78 89C83 76 96 68 109 70C122 72 130 82 128 94C127 103 120 110 111 113C106 115 103 119 102 124L92 126C92 116 88 108 82 102C77 98 76 94 78 89Z" fill={INK_DEEP} stroke="none" />
      <path d="M77 92L39 101L78 108L90 101Z" fill={palette.beak} stroke="none" />

      {/* Classic white shoulder slash and a calmer wing. */}
      <path d="M113 111C124 106 137 104 149 107C140 112 133 120 128 130C122 139 120 147 121 154C112 150 106 144 104 136C102 126 105 117 113 111Z" fill={PAPER_LIGHT} stroke="none" />
      <path d="M130 119C146 110 166 112 182 124C180 140 168 151 151 155C138 157 127 153 121 145C121 135 124 126 130 119Z" fill="#1B292A" stroke="none" />
      <path d="M140 123C151 118 163 120 173 128C168 139 161 147 151 152C143 153 136 151 130 146C131 137 134 129 140 123Z" fill={palette.wing} stroke="none" opacity=".42" />
      <path d="M131 122C136 119 142 117 148 117" stroke="#fff" strokeWidth="1.4" opacity=".32" />

      <Eye cx={102} cy={85} r={2.25} />
      <LegPair left={128} right={166} y={179} />
    </g>
  );
}

function Woodpecker({ palette }: { palette: Palette }) {
  return (
    <g stroke={INK_SOFT} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      {/* Slim upright body. */}
      <path d="M111 92C119 78 133 70 147 72C162 74 172 87 171 104L168 145C166 159 155 168 141 168C126 168 115 158 113 144L108 111C106 104 107 98 111 92Z" fill={PAPER} />
      <path d="M117 94C126 83 140 79 152 84C160 91 164 105 162 124C160 139 156 151 151 159C139 163 128 158 121 148C115 136 113 119 117 94Z" fill={INK_DEEP} stroke="none" />
      <path d="M124 104C133 96 145 95 155 101C153 120 149 137 143 151C135 153 127 149 122 142C119 131 119 117 124 104Z" fill={palette.wing} stroke="none" opacity=".48" />

      {/* Recognisable head pattern, still geometric but not fragmented. */}
      <path d="M105 72C112 59 126 52 140 54C154 56 163 66 162 78C161 88 153 95 143 98C132 101 119 96 111 88C105 83 102 78 105 72Z" fill={PAPER_LIGHT} />
      <path d="M110 68C119 59 132 56 143 60C137 64 133 70 132 78C125 78 118 81 112 87C106 82 105 74 110 68Z" fill={INK_DEEP} stroke="none" />
      <path d="M105 74L61 82L106 88Z" fill={palette.beak} stroke="none" />
      <path d="M128 55C136 48 146 48 153 54C145 55 139 59 135 65Z" fill={palette.crest} stroke="none" />
      <path d="M159 140L176 160L159 155Z" fill={palette.tail} stroke="none" opacity=".82" />

      <Eye cx={127} cy={69} r={2.2} />
      <FeatherMarks lines={["M128 110L151 122", "M127 123L148 136"]} />
      <g fill="none" stroke={LEG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M132 162L126 181M151 163L152 181M118 181H132M145 181H159" />
      </g>
    </g>
  );
}

function Jay({ palette }: { palette: Palette }) {
  return (
    <g stroke={INK_SOFT} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      {/* Tail sits behind a warm, organic body. */}
      <path d="M170 128C192 123 214 123 235 129C214 135 196 145 173 151Z" fill="#263436" stroke="none" />
      <path d="M175 132C195 129 214 130 229 134C210 140 194 147 176 155Z" fill={palette.tail} stroke="none" opacity=".82" />

      <path d="M91 117C96 95 115 82 137 82C161 82 181 96 185 117C190 139 172 158 147 163C123 168 99 158 90 141C86 133 86 124 91 117Z" fill="#D7B993" />
      <path d="M96 105C99 88 112 76 127 72C141 68 155 74 162 86C149 84 137 87 126 94C116 100 109 108 105 118C100 115 97 111 96 105Z" fill="#CFA987" stroke="none" />

      {/* Head overlaps the torso instead of floating above it. */}
      <path d="M83 86C88 73 100 65 113 66C127 67 138 77 139 90C139 101 132 109 121 113C112 116 101 113 94 107C86 101 80 94 83 86Z" fill="#DCC09B" />
      <path d="M86 89L54 96L86 103L98 97Z" fill={palette.beak} stroke="none" />
      <path d="M95 70L98 55L106 68L113 54L117 70L124 60L125 76" fill={palette.crest} stroke="none" />
      <path d="M110 91C118 88 127 89 134 94C128 98 124 103 122 109C116 108 111 105 107 101Z" fill={INK_DEEP} stroke="none" opacity=".9" />

      {/* Wing + the jay's blue barred patch. */}
      <path d="M126 105C143 96 163 103 175 119C173 137 161 149 144 154C130 155 119 150 113 141C110 129 114 115 126 105Z" fill="#B89473" stroke="none" />
      <path d="M151 113L168 119L158 124L172 130L158 135L173 140" fill="none" stroke={palette.body} strokeWidth="4.2" opacity=".95" />
      <path d="M153 112L168 118" stroke="#101817" strokeWidth="2.2" opacity=".7" />
      <path d="M154 124L169 130" stroke="#101817" strokeWidth="2.2" opacity=".7" />
      <path d="M156 136L170 141" stroke="#101817" strokeWidth="2.2" opacity=".7" />

      <Eye cx={106} cy={82} r={2.2} />
      <g fill="none" stroke={LEG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M121 156L119 181M151 159L154 181M111 181H125M147 181H161" />
      </g>
    </g>
  );
}

function Crane({ palette }: { palette: Palette }) {
  return (
    <g stroke={INK_SOFT} strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round">
      {/* Tail first, so it sits naturally behind the body. */}
      <path d="M190 137C208 131 224 133 238 139C221 144 207 151 194 160Z" fill={palette.tail} stroke="none" opacity=".72" />

      {/* Compact, light body: no pear-shaped mass. */}
      <path d="M148 121C159 110 174 105 189 109C203 113 211 123 211 135C211 148 201 158 187 162C172 167 156 164 146 156C137 149 134 139 138 131C140 127 143 124 148 121Z" fill={PAPER} />
      <path d="M155 121C166 114 180 113 192 118C200 123 204 130 204 138C199 149 190 156 179 159C168 161 158 158 151 153C147 144 148 131 155 121Z" fill={WARM} stroke="none" opacity=".78" />
      <path d="M162 124C173 118 184 119 195 124C191 137 185 148 175 156C167 158 160 156 154 152C152 144 154 133 162 124Z" fill={palette.wing} stroke="none" opacity=".34" />

      {/* One continuous neck gesture: body -> neck -> head reads as one bird. */}
      <path d="M159 124C164 113 168 104 166 93C164 82 156 74 156 64C156 52 165 43 177 44" fill="none" stroke={PAPER} strokeWidth="16" />
      <path d="M163 123C169 112 173 103 171 92C169 81 162 74 162 64C162 55 168 49 177 49" fill="none" stroke={INK_DEEP} strokeWidth="4.5" opacity=".92" />

      {/* Head and face. */}
      <path d="M168 39C176 35 186 37 191 43C196 50 193 57 185 61C177 65 167 62 163 55C159 49 161 43 168 39Z" fill={PAPER} />
      <path d="M188 47L232 52L189 57Z" fill={palette.beak} stroke="none" />
      <path d="M180 40L190 42C192 46 192 50 190 53L181 50Z" fill={palette.crest} stroke="none" opacity=".86" />
      <Eye cx={181} cy={47} r={2} />

      <FeatherMarks lines={["M164 133C176 132 187 136 196 143", "M162 143C173 144 181 148 188 153"]} />

      {/* Long, restrained legs. */}
      <g fill="none" stroke={LEG} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M162 159L160 190" />
        <path d="M160 190L149 198M160 190L168 199M160 190L160 201" />
        <path d="M187 157L189 190" />
        <path d="M189 190L178 198M189 190L198 198M189 190L190 201" />
      </g>
    </g>
  );
}

function Owl({ palette }: { palette: Palette }) {
  return (
    <g stroke={INK_SOFT} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round">
      <path d="M91 78L101 56L113 71C123 65 138 65 149 71L163 56L171 80C182 95 183 123 172 144C162 160 146 168 129 167C108 167 93 157 85 140C77 121 79 96 91 78Z" fill={PAPER} />
      <path d="M95 82C105 72 117 69 129 73C141 69 153 72 163 82C156 98 146 106 129 107C112 106 102 98 95 82Z" fill={PAPER_SOFT} stroke="none" opacity=".82" />
      <path d="M90 107C98 95 110 93 120 101C124 118 121 139 107 151C94 145 86 128 90 107Z" fill={palette.wing} opacity=".72" stroke="none" />
      <path d="M168 107C160 95 148 93 138 101C134 118 137 139 151 151C164 145 172 128 168 107Z" fill={palette.body} opacity=".72" stroke="none" />
      <path d="M123 95L129 102L135 95L129 92Z" fill={palette.beak} stroke="none" />
      <circle cx="112" cy="86" r="8" fill={PAPER_LIGHT} stroke="none" />
      <circle cx="146" cy="86" r="8" fill={PAPER_LIGHT} stroke="none" />
      <Eye cx={112} cy={86} r={2.3} />
      <Eye cx={146} cy={86} r={2.3} />
      <FeatherMarks lines={["M108 118C115 123 120 130 123 139", "M150 118C143 123 138 130 135 139"]} />
      <g fill="none" stroke={LEG} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M117 164L115 178M141 164L143 178M108 178H120M137 178H149" />
      </g>
    </g>
  );
}
