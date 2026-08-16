import type { ZeroSeasonBird, ZeroSeasonBoard } from '@kontur/core';

interface ZeroSeasonTreeProps {
  board: ZeroSeasonBoard;
  selected: number;
  disabled?: boolean;
  onSelect(index: number): void;
}

const NODES = [
  { x: 14.5, y: 86 },
  { x: 26.5, y: 37 },
  { x: 42, y: 21 },
  { x: 49.5, y: 61 },
  { x: 61, y: 19 },
  { x: 76, y: 35.5 },
  { x: 87.5, y: 86 },
] as const;

export function ZeroSeasonTree({ board, selected, disabled = false, onSelect }: ZeroSeasonTreeProps) {
  const selectedOwner = board.nests[selected] ?? null;
  return (
    <div className={`zero-tree ${disabled ? 'is-locked' : ''}`}>
      <div className="zero-tree-canvas">
        <svg className="zero-tree-lines" viewBox="0 0 360 240" aria-hidden="true">
          <path className="trunk" d="M180 230C179 199 181 170 178 139C176 113 170 87 171 51" />
          <path d="M179 190C147 188 114 195 52 207" />
          <path d="M177 147C146 137 118 119 95 88" />
          <path d="M174 104C163 91 154 74 151 50" />
          <path d="M179 151C214 141 245 119 273 85" />
          <path d="M174 100C195 87 211 69 220 46" />
          <path d="M180 190C220 187 256 194 315 207" />
          <path className="twig" d="M126 126C111 126 101 131 91 140M236 126C251 126 264 131 275 140" />
        </svg>

        {NODES.map((point, index) => {
          const owner = board.nests[index] ?? null;
          const isSelected = selected === index && !disabled;
          const className = [
            'zero-tree-node',
            owner ? `owner-${owner}` : '',
            isSelected ? 'is-selected' : '',
            board.shields.includes(index) ? 'has-shield' : '',
            board.marks.includes(index) ? 'has-mark' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              className={className}
              key={index}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => onSelect(index)}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={nodeLabel(index, owner, board.shields.includes(index), board.marks.includes(index))}
            >
              <span>{index + 1}</span>
              {owner && <i aria-hidden="true" />}
              {board.shields.includes(index) && <b aria-hidden="true">◇</b>}
              {board.marks.includes(index) && <em aria-hidden="true">·</em>}
            </button>
          );
        })}
      </div>

      {!disabled && (
        <p className="zero-tree-selection" aria-live="polite">
          <strong>Место {selected + 1}</strong>
          <span>{selectedOwner ? `сейчас: ${birdTitle(selectedOwner)}` : 'свободно'}</span>
        </p>
      )}
    </div>
  );
}

function nodeLabel(index: number, owner: ZeroSeasonBird | null, shield: boolean, mark: boolean): string {
  const parts = [`Место ${index + 1}`, owner ? `занято: ${birdTitle(owner)}` : 'свободно'];
  if (shield) parts.push('есть защита');
  if (mark) parts.push('разведано');
  return parts.join(', ');
}

function birdTitle(bird: ZeroSeasonBird): string {
  if (bird === 'woodpecker') return 'Дятел';
  if (bird === 'magpie') return 'Сорока';
  if (bird === 'owl') return 'Сова';
  return 'Журавль';
}
