import type { ZeroSeasonBird } from '@kontur/core';
import type { Palette } from '@kontur/contracts';

interface ZeroSeasonBirdProps {
  bird: ZeroSeasonBird;
  palette: Palette;
  size?: number;
  mood?: 'calm' | 'ready' | 'active' | 'achieved';
}

/**
 * Редакционная птица для Нулевого сезона.
 *
 * Здесь намеренно нет «маскотного» лица и геометрического low-poly корпуса:
 * вид птицы читается по силуэту, а окрас живёт на крупных областях пера.
 */
export function ZeroSeasonBirdIllustration({
  bird,
  palette,
  size = 180,
  mood = 'calm',
}: ZeroSeasonBirdProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 220 180',
    className: `season-bird season-bird--${bird} season-bird--${mood}`,
    role: 'img' as const,
    'aria-label': birdLabel(bird),
  };

  if (bird === 'owl') return <Owl {...common} palette={palette} />;
  if (bird === 'crane') return <Crane {...common} palette={palette} />;
  if (bird === 'magpie') return <Magpie {...common} palette={palette} />;
  return <Woodpecker {...common} palette={palette} />;
}

type SvgProps = {
  width: number;
  height: number;
  viewBox: string;
  className: string;
  role: 'img';
  'aria-label': string;
  palette: Palette;
};

const LINE = '#243738';
const LIGHT_LINE = '#F1F1EC';

function Woodpecker({ palette, ...props }: SvgProps) {
  return (
    <svg {...props}>
      <g className="season-bird__body">
        <path d="M70 127C56 110 54 86 64 65C75 41 101 30 126 36C151 42 165 64 160 90C156 113 138 133 113 139C94 143 80 139 70 127Z" fill={palette.body} />
        <path d="M78 121C69 108 68 91 74 77C82 61 95 53 108 51C98 63 95 80 98 96C101 111 110 126 124 136C103 142 88 136 78 121Z" fill={palette.belly} />
        <path d="M106 55C126 50 145 62 149 82C152 98 143 116 126 126C115 115 109 102 108 88C107 75 108 65 106 55Z" fill={palette.wing} />
        <path d="M116 62C127 68 137 78 142 91M114 75C126 81 135 91 139 102M114 89C124 95 131 103 134 111" fill="none" stroke={palette.crest} strokeWidth="2" strokeLinecap="round" opacity=".72" />
        <path d="M155 103C173 111 187 123 194 137C176 132 160 130 143 132Z" fill={palette.tail} />
        <path d="M155 111C173 117 184 126 191 135" fill="none" stroke={LINE} strokeWidth="1.5" opacity=".48" />
        <path d="M68 66C56 61 45 62 34 70C47 73 57 78 66 84Z" fill={palette.beak} />
        <path d="M66 52C75 38 89 31 103 34C95 25 86 21 77 20C78 29 74 38 66 52Z" fill={palette.crest} />
        <path d="M76 56C84 47 95 42 107 42" fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" opacity=".55" />
        <circle cx="80" cy="57" r="3.1" fill={LINE} />
        <circle cx="79.2" cy="56.2" r=".9" fill={LIGHT_LINE} />
        <path d="M96 137C95 149 92 156 87 163M113 139C113 150 116 157 121 163M78 163H94M115 163H128" fill="none" stroke={palette.crest} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <AchievementMarks mood={props.className.endsWith('--achieved') ? 'achieved' : 'none'} />
    </svg>
  );
}

function Magpie({ palette, ...props }: SvgProps) {
  return (
    <svg {...props}>
      <g className="season-bird__body">
        <path d="M62 119C52 98 57 73 76 55C94 38 122 35 144 47C163 58 172 79 165 100C158 123 137 138 111 138C88 138 70 132 62 119Z" fill={palette.body} />
        <path d="M79 126C67 115 63 100 66 85C72 102 84 115 102 122C118 128 136 127 151 120C139 134 121 140 102 138C92 137 84 133 79 126Z" fill={palette.belly} />
        <path d="M105 51C127 49 150 61 158 82C150 92 139 101 124 108C111 114 99 117 88 116C96 99 101 78 105 51Z" fill={palette.wing} />
        <path d="M104 64C123 64 140 71 151 82M101 79C118 80 133 86 144 96M97 94C112 96 124 102 134 110" fill="none" stroke={palette.crest} strokeWidth="2" strokeLinecap="round" opacity=".72" />
        <path d="M155 105C178 113 196 125 208 141C183 135 163 134 141 136Z" fill={palette.tail} />
        <path d="M151 112C176 118 192 127 202 139" fill="none" stroke={LINE} strokeWidth="1.5" opacity=".5" />
        <path d="M66 62C54 59 44 62 34 69C46 72 56 76 64 82Z" fill={palette.beak} />
        <path d="M68 53C83 38 101 33 116 39C104 32 95 26 87 21C82 34 76 43 68 53Z" fill={palette.crest} />
        <circle cx="79" cy="58" r="3" fill={LINE} />
        <circle cx="78.3" cy="57.2" r=".85" fill={LIGHT_LINE} />
        <path d="M97 136C96 149 92 157 87 163M116 137C117 150 121 157 126 163M78 163H94M120 163H133" fill="none" stroke={palette.crest} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <AchievementMarks mood={props.className.endsWith('--achieved') ? 'achieved' : 'none'} />
    </svg>
  );
}

function Owl({ palette, ...props }: SvgProps) {
  return (
    <svg {...props}>
      <g className="season-bird__body">
        <path d="M74 49C82 35 96 29 110 34C124 28 140 34 148 48C163 61 169 81 165 106C161 131 142 146 111 147C80 147 60 131 56 106C52 82 59 62 74 49Z" fill={palette.body} />
        <path d="M76 50C67 39 65 29 69 20C79 24 87 30 93 39M145 50C153 39 155 29 151 20C141 24 133 30 127 39" fill={palette.crest} />
        <path d="M72 88C79 66 92 56 110 56C128 56 141 66 148 88C143 119 131 137 110 141C89 137 77 119 72 88Z" fill={palette.belly} />
        <path d="M61 91C71 75 83 67 96 65C92 86 91 107 95 130C77 126 65 113 61 91Z" fill={palette.wing} />
        <path d="M159 91C149 75 137 67 124 65C128 86 129 107 125 130C143 126 155 113 159 91Z" fill={palette.wing} />
        <path d="M75 89C81 101 87 110 95 117M145 89C139 101 133 110 125 117" fill="none" stroke={palette.crest} strokeWidth="2" strokeLinecap="round" opacity=".7" />
        <path d="M86 61C94 54 102 52 110 56C101 63 96 72 95 82C89 77 86 70 86 61ZM134 61C126 54 118 52 110 56C119 63 124 72 125 82C131 77 134 70 134 61Z" fill={palette.crest} opacity=".82" />
        <circle cx="94" cy="70" r="3.2" fill={LINE} />
        <circle cx="126" cy="70" r="3.2" fill={LINE} />
        <path d="M110 73L104 82H116Z" fill={palette.beak} />
        <path d="M96 144C95 153 92 159 88 164M124 144C125 153 128 159 132 164M81 164H94M126 164H139" fill="none" stroke={palette.crest} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <AchievementMarks mood={props.className.endsWith('--achieved') ? 'achieved' : 'none'} />
    </svg>
  );
}

function Crane({ palette, ...props }: SvgProps) {
  return (
    <svg {...props}>
      <g className="season-bird__body">
        <path d="M82 125C72 107 77 87 94 75C110 64 132 65 148 78C164 91 167 111 155 127C143 144 116 149 95 141C89 138 85 132 82 125Z" fill={palette.body} />
        <path d="M100 80C115 70 135 73 146 88C136 101 124 114 111 124C103 113 98 98 100 80Z" fill={palette.wing} />
        <path d="M108 85C123 84 135 90 142 99M108 98C121 98 131 103 136 111M111 110C120 111 127 115 131 120" fill="none" stroke={palette.crest} strokeWidth="2" strokeLinecap="round" opacity=".72" />
        <path d="M86 102C75 92 67 79 65 65C63 50 68 39 80 33C90 28 100 30 107 37C96 38 90 44 88 53C85 66 93 74 104 82Z" fill={palette.belly} />
        <path d="M78 35C81 25 88 18 98 16C95 22 95 28 98 34Z" fill={palette.crest} />
        <path d="M74 36C62 34 51 36 39 42C52 45 63 49 72 54Z" fill={palette.beak} />
        <circle cx="81" cy="39" r="2.7" fill={LINE} />
        <circle cx="80.5" cy="38.4" r=".8" fill={LIGHT_LINE} />
        <path d="M151 107C171 113 188 124 201 139C180 135 163 136 147 139Z" fill={palette.tail} />
        <path d="M106 142C104 151 100 158 96 165M135 143C137 153 141 160 147 166M87 165H102M140 166H154" fill="none" stroke={palette.crest} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <AchievementMarks mood={props.className.endsWith('--achieved') ? 'achieved' : 'none'} />
    </svg>
  );
}

function AchievementMarks({ mood }: { mood: 'achieved' | 'none' }) {
  if (mood !== 'achieved') return null;
  return (
    <g className="season-bird__achievement" fill="none" stroke="#D5F15A" strokeLinecap="round">
      <path d="M22 54h18M31 45v18M180 42h15M187.5 34.5v15" strokeWidth="1.5" />
      <circle cx="191" cy="119" r="8" strokeWidth="1.25" strokeDasharray="2 4" />
    </g>
  );
}

function birdLabel(bird: ZeroSeasonBird): string {
  if (bird === 'woodpecker') return 'Дятел';
  if (bird === 'magpie') return 'Сорока';
  if (bird === 'owl') return 'Сова';
  return 'Журавль';
}
