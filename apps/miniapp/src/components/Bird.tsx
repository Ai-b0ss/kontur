import type { Role } from '@kontur/core';
import type { Palette } from '@kontur/contracts';

interface BirdProps {
  role: Role | null;
  palette: Palette;
  size?: number;
  alive?: boolean;
  mood?: 'calm' | 'ready' | 'active' | 'achieved';
}

const BODY: Record<Role, string> = {
  designer: 'M-31-8C-34-28-18-40 2-38C22-36 34-22 33-2C32 17 18 29-1 29C-20 29-32 14-31-8Z',
  coder: 'M-31-7C-32-27-17-39 2-37C20-35 31-23 31-4L27 21 2 29C-17 28-32 14-31-7Z',
  creative: 'M-32-6C-33-28-16-39 3-36C23-33 36-17 31 4C27 22 11 31-7 27C-24 24-34 11-32-6Z',
  manager: 'M-31-8C-31-26-18-38 0-38C20-38 33-23 32-4C31 16 18 29 0 29C-20 29-33 13-31-8Z',
  vibe: 'M-33-5C-35-25-21-39 0-39C23-39 36-23 34-2C32 20 17 30-3 29C-23 28-35 14-33-5Z',
};

/**
 * Пять ролей используют общий графический язык, но разные силуэты. Окрас
 * меняет материал птицы, а роль и её достоинство не зависят от аксессуара.
 */
export function Bird({ role, palette, size = 160, alive = true, mood = 'calm' }: BirdProps) {
  const actualRole = role ?? 'vibe';
  return (
    <svg
      width={size}
      height={size}
      viewBox="-58 -62 122 122"
      className={`bird ${alive ? 'bird--alive' : ''} bird--${mood} bird--role-${actualRole}`}
      role="img"
      aria-label={role ? `Птица роли ${role}` : 'Птица'}
    >
      {mood === 'achieved' && <AchievementAura />}
      <RoleTail role={actualRole} palette={palette} />
      <path fill={palette.body} stroke="#153f46" strokeWidth="2" strokeLinejoin="round" d={BODY[actualRole]} />
      <path fill={palette.belly} opacity=".9" d="M-29 2C-25 19-12 28 3 27C14 27 24 20 29 10C16 20-5 22-18 14C-25 10-28 5-29 2Z" />
      <RoleWing role={actualRole} palette={palette} />
      <path fill={palette.beak} stroke="#153f46" strokeWidth="1.4" strokeLinejoin="round" d="M-30-19L-47-12L-30-7Z" />
      <circle fill="#fff9ec" stroke="#153f46" strokeWidth="1.6" cx="-17" cy="-21" r="7" />
      <circle className="bird__eye" fill="#153f46" cx="-18" cy="-21" r="3.4" />
      <circle fill="#fff" cx="-19.4" cy="-22.4" r="1.15" />
      <RoleCrest role={actualRole} palette={palette} />
      <path d="M-12 29L-14 38M7 29L9 38M-20 38H-8M3 38H15" fill="none" stroke="#153f46" strokeWidth="2" strokeLinecap="round" />
      {mood === 'active' && <path d="M38-27C46-23 50-17 52-10M40-36C50-33 57-26 60-18" fill="none" stroke={palette.beak} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 4" />}
    </svg>
  );
}

function RoleTail({ role, palette }: { role: Role; palette: Palette }) {
  if (role === 'designer') return <g fill={palette.tail} stroke="#153f46" strokeWidth="1.4" strokeLinejoin="round"><path d="M22-9L58-21L39 0Z"/><path d="M25-1L61-4L38 10Z"/><path d="M23 7L53 17L33 18Z"/></g>;
  if (role === 'coder') return <g fill={palette.tail} stroke="#153f46" strokeWidth="1.5" strokeLinejoin="round"><path d="M22-8L59-15L43 1L61 8L31 17Z"/><path d="M36-6L47 0L37 7" fill="none" stroke={palette.crest} strokeWidth="2"/></g>;
  if (role === 'creative') return <g fill={palette.tail} stroke="#153f46" strokeWidth="1.4"><path d="M22-9C41-17 53-16 61-9C49-5 43 0 37 8Z"/><path d="M23 1C40 0 53 7 58 15C46 12 38 14 31 20Z"/></g>;
  if (role === 'manager') return <g fill={palette.tail} stroke="#153f46" strokeWidth="1.4"><path d="M23-9C39-13 50-10 57-4C47 0 41 4 35 10Z"/><path d="M27 2C42 1 50 7 54 13C45 13 38 15 32 20Z"/></g>;
  return <g fill={palette.tail} stroke="#153f46" strokeWidth="1.4"><path d="M24-6C42-9 53-4 58 4C47 5 40 9 33 16Z"/><path d="M38-20C51-23 58-17 60-10" fill="none" stroke={palette.crest} strokeWidth="2" strokeDasharray="3 4"/></g>;
}

function RoleWing({ role, palette }: { role: Role; palette: Palette }) {
  if (role === 'designer') return <g stroke="#153f46" strokeWidth="1.3" strokeLinejoin="round"><path fill={palette.wing} d="M16-6C11-20-6-24-17-15C-25-8-20 8-8 14C3 18 15 9 16-6Z"/><path d="M-16-8L12 4M-11-17L2 14M0-20L-8 14" fill="none" stroke={palette.crest}/></g>;
  if (role === 'coder') return <g stroke="#153f46" strokeWidth="1.5" strokeLinejoin="round"><path fill={palette.wing} d="M17-8L5-20L-15-15L-20 2L-7 15L12 9Z"/><path d="M-10-8L-3-3L-10 2M4-8L-1 7M5 4L11 4" fill="none" stroke={palette.crest} strokeWidth="2"/></g>;
  if (role === 'creative') return <g stroke="#153f46" strokeWidth="1.4"><path fill={palette.wing} d="M18-8C8-23-11-22-18-10C-23 0-15 13-4 17C7 12 15 4 18-8Z"/><path d="M-13-8C-3-3 3 5 5 13M-6-16C3-9 9-2 13 7" fill="none" stroke={palette.crest} strokeWidth="2"/></g>;
  if (role === 'manager') return <g stroke="#153f46" strokeWidth="1.3"><path fill={palette.wing} d="M16-8C10-20-7-23-17-14C-23-8-20 8-8 15C3 16 14 7 16-8Z"/><path d="M-16-6C-6-9 6-5 12 2M-15 1C-5-2 5 2 9 8M-11 8C-4 7 2 9 5 13" fill="none" stroke={palette.crest}/><circle cx="-2" cy="-4" r="4" fill="none" stroke={palette.crest}/><path d="M-2-4L1-8" stroke={palette.crest}/></g>;
  return <g stroke="#153f46" strokeWidth="1.3"><path fill={palette.wing} d="M16-7C9-21-9-23-19-13C-25-5-18 11-5 17C6 16 15 7 16-7Z"/><path d="M-15-7C-4-13 8-8 11 2C4 10-6 12-13 7" fill="none" stroke={palette.crest} strokeWidth="2"/></g>;
}

function RoleCrest({ role, palette }: { role: Role; palette: Palette }) {
  if (role === 'designer') return <path fill={palette.crest} stroke="#153f46" strokeWidth="1.4" d="M-8-37C-17-47-8-52 0-46C6-55 16-50 13-41C5-42 0-39-2-36Z" />;
  if (role === 'coder') return <path fill={palette.crest} stroke="#153f46" strokeWidth="1.4" d="M-7-37L-11-50L0-43L7-54L10-39Z" />;
  if (role === 'creative') return <g fill={palette.crest} stroke="#153f46" strokeWidth="1.3"><path d="M-12-36C-24-48-14-55-5-47Z"/><path d="M-4-37C-8-54 5-58 8-45Z"/><path d="M4-36C12-51 23-45 16-37Z"/></g>;
  if (role === 'manager') return <path fill={palette.crest} stroke="#153f46" strokeWidth="1.4" d="M-8-37C-10-49 0-52 5-43C11-50 18-42 12-36Z" />;
  return <g fill="none" stroke={palette.crest} strokeWidth="1.8"><path d="M-15-40C-3-52 13-49 20-36"/><path d="M-20-45C-4-61 18-57 28-39" strokeDasharray="3 4"/></g>;
}

function AchievementAura() {
  return <g fill="none" stroke="#d6a019" strokeLinecap="round"><circle cx="0" cy="-4" r="51" strokeWidth="1" strokeDasharray="3 5" opacity=".65"/><path d="M-43-35l-3-7m49-13 1-8m39 27 7-4m-2 48 8 2m-45 34 2 8m-48-14-6 5" strokeWidth="2"/><path d="M38-43l3 5 5 2-5 2-3 5-2-5-5-2 5-2Z" fill="#d6a019" stroke="none"/></g>;
}
