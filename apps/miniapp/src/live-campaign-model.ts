import type { LiveCampaignAction, LiveCampaignBird, LiveCampaignSectorState } from '@kontur/core';

export interface LiveCampaignBirdMeta {
  id: LiveCampaignBird;
  title: string;
  mark: string;
  note: string;
}

export const LIVE_CAMPAIGN_BIRDS: readonly LiveCampaignBirdMeta[] = [
  { id: 'woodpecker', title: 'Дятел', mark: '⌁', note: 'Ты собираешь цепочки и условия' },
  { id: 'magpie', title: 'Сорока', mark: '◈', note: 'Ты делаешь выбор понятным человеку' },
  { id: 'owl', title: 'Сова', mark: '◉', note: 'Ты идёшь от гипотезы к факту' },
  { id: 'crane', title: 'Журавль', mark: '⌂', note: 'Ты держишь порядок и ограничения' },
] as const;

export const LIVE_CAMPAIGN_ACTIONS: ReadonlyArray<{
  id: LiveCampaignAction;
  mark: string;
  title: string;
  gesture: string;
  note: string;
}> = [
  { id: 'scout', mark: '⌁', title: 'Разведать', gesture: 'Разведать крону', note: 'раскрыть соседний путь' },
  { id: 'claim', mark: '◆', title: 'Закрепить', gesture: 'Открыть путь', note: 'взять открытый сектор' },
  { id: 'hold', mark: '▣', title: 'Удержать', gesture: 'Держать ветку', note: 'поставить ward от шторма' },
] as const;

export const LIVE_CAMPAIGN_SECTOR_LABEL: Record<LiveCampaignSectorState, string> = {
  hidden: 'скрыт',
  exposed: 'открыт',
  secured: 'закреплён',
  rooted: 'укоренён',
};

export const LIVE_CAMPAIGN_PRETEST: ReadonlyArray<{
  id: string;
  prompt: string;
  options: ReadonlyArray<{ bird: LiveCampaignBird; text: string }>;
}> = [
  {
    id: 'route',
    prompt: 'В инструкции шесть шагов. Где сначала ищешь сбой?',
    options: [
      { bird: 'woodpecker', text: 'В условии, которое не покрывает крайний случай' },
      { bird: 'magpie', text: 'В месте, где человек перестаёт понимать следующий шаг' },
      { bird: 'owl', text: 'В выводе, для которого не хватает факта' },
      { bird: 'crane', text: 'В зависимости, которая блокирует остальные шаги' },
    ],
  },
  {
    id: 'deadline',
    prompt: 'Три задачи не помещаются в срок. Какой первый ход?',
    options: [
      { bird: 'woodpecker', text: 'Разбить работу на проверяемые части' },
      { bird: 'magpie', text: 'Убрать действие, которое не меняет путь человека' },
      { bird: 'owl', text: 'Сравнить риск и ожидаемый эффект каждого варианта' },
      { bird: 'crane', text: 'Поставить зависимости и владельцев в порядок' },
    ],
  },
  {
    id: 'signal',
    prompt: 'График вырос. Что не даст перепутать сигнал с выводом?',
    options: [
      { bird: 'woodpecker', text: 'Проверить формулу и входные значения' },
      { bird: 'magpie', text: 'Посмотреть, не скрыт ли важный сценарий пользователя' },
      { bird: 'owl', text: 'Сравнить с базой и размером выборки' },
      { bird: 'crane', text: 'Уточнить, кто принимает решение по этому графику' },
    ],
  },
  {
    id: 'friction',
    prompt: 'Люди бросают форму на втором поле. Что проверишь первым?',
    options: [
      { bird: 'woodpecker', text: 'Состояние и валидацию этого перехода' },
      { bird: 'magpie', text: 'Можно ли убрать или объяснить лишнее поле' },
      { bird: 'owl', text: 'На каком сегменте и в какой момент они уходят' },
      { bird: 'crane', text: 'Кто владеет исправлением и от чего оно зависит' },
    ],
  },
  {
    id: 'constraint',
    prompt: 'Новое ограничение ломает старый план. Что ценнее сохранить?',
    options: [
      { bird: 'woodpecker', text: 'Корректную цепочку условий' },
      { bird: 'magpie', text: 'Понятный путь для человека' },
      { bird: 'owl', text: 'Проверяемость главного вывода' },
      { bird: 'crane', text: 'Порядок, в котором команда сможет перестроиться' },
    ],
  },
  {
    id: 'experiment',
    prompt: 'После ошибки нужно выбрать следующий эксперимент. Что делаешь?',
    options: [
      { bird: 'woodpecker', text: 'Меняю один параметр и прохожу цепочку заново' },
      { bird: 'magpie', text: 'Проверяю самый болезненный сценарий пользователя' },
      { bird: 'owl', text: 'Формулирую, какой результат сможет доказать гипотезу' },
      { bird: 'crane', text: 'Делаю эксперимент коротким и согласованным по ролям' },
    ],
  },
] as const;

export function liveCampaignBirdMeta(bird: LiveCampaignBird): LiveCampaignBirdMeta {
  return LIVE_CAMPAIGN_BIRDS.find((item) => item.id === bird)!;
}

export function liveCampaignActionMeta(action: LiveCampaignAction) {
  return LIVE_CAMPAIGN_ACTIONS.find((item) => item.id === action)!;
}

/** Timer is informational only: server closeAt remains the source of truth. */
export function secondsUntilLiveCampaignClose(closeAt: string, nowMs: number): number {
  const closeAtMs = new Date(closeAt).getTime();
  if (!Number.isFinite(closeAtMs)) return 0;
  return Math.max(0, Math.ceil((closeAtMs - nowMs) / 1000));
}

export function formatLiveCampaignCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
