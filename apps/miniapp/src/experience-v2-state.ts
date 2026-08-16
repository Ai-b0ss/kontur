import type { JourneyStatus, ParticipationStage } from '@kontur/contracts';

export interface QuestionDraft {
  goal: string;
  checked: string;
  needed: string;
}

export type ExperienceView = 'compose' | 'preview' | 'waiting' | 'outcome' | 'nest';

export function buildQuestionDraft(draft: QuestionDraft): string {
  return [draft.goal, draft.checked, draft.needed]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function viewForJourney(status: JourneyStatus): ExperienceView {
  if (status === 'started' || status === 'clarify') return 'compose';
  if (status === 'prepared') return 'preview';
  if (status === 'published' || status === 'waiting') return 'waiting';
  if (status === 'helped') return 'outcome';
  return 'nest';
}

export const STAGE_LABELS: Record<ParticipationStage, string> = {
  looking: 'Осматривается',
  thread: 'Нашла нить',
  nest: 'Устроила гнездо',
  connection: 'Связала людей',
};
