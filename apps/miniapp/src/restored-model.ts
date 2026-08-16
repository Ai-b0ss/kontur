import type { RestoredPathKind } from '@kontur/contracts';

export type RestoredTab = 'bird' | 'community' | 'actions' | 'nest' | 'collection';

export interface PathMeta {
  kind: RestoredPathKind;
  label: string;
  short: string;
  prompt: string;
  defaultTitle: string;
  accent: string;
}

export const RESTORED_PATHS: readonly PathMeta[] = [
  { kind: 'ask', label: 'Задать вопрос', short: 'Вопрос', prompt: 'Что хочешь понять и какой контекст уже есть?', defaultTitle: 'Ищу конкретный ответ', accent: 'coral' },
  { kind: 'help', label: 'Помочь', short: 'Помощь', prompt: 'Где твой опыт может снять чужой стопор?', defaultTitle: 'Готов помочь с задачей', accent: 'teal' },
  { kind: 'connect', label: 'Найти человека', short: 'Контакт', prompt: 'Кого ищешь и что предлагаешь со своей стороны?', defaultTitle: 'Ищу партнёра или команду', accent: 'plum' },
  { kind: 'orient', label: 'Разобраться в чатах', short: 'Навигация', prompt: 'С какой темой хочешь войти в сообщество?', defaultTitle: 'Выбираю подходящий чат', accent: 'blue' },
  { kind: 'opportunity', label: 'Найти возможность', short: 'Возможность', prompt: 'Какой ресурс, проект, грант или событие нужен сейчас?', defaultTitle: 'Ищу актуальную возможность', accent: 'amber' },
  { kind: 'contribution', label: 'Показать вклад', short: 'Вклад', prompt: 'Что уже сделано и чем это было полезно?', defaultTitle: 'Завершил полезную работу', accent: 'gold' },
  { kind: 'save', label: 'Сохранить результат', short: 'Результат', prompt: 'Что важно не потерять и какой следующий шаг?', defaultTitle: 'Сохраняю полезный результат', accent: 'leaf' },
  { kind: 'progress', label: 'Развить птицу', short: 'Прогресс', prompt: 'Коллекция растёт от полезных действий, окрасов и подтверждённых вкладов.', defaultTitle: 'Продолжаю путь', accent: 'ink' },
] as const;

export const RESTORED_TABS: readonly { key: RestoredTab; label: string }[] = [
  { key: 'bird', label: 'Птица' },
  { key: 'community', label: 'Стая' },
  { key: 'actions', label: 'Действия' },
  { key: 'nest', label: 'Гнездо' },
  { key: 'collection', label: 'Коллекция' },
] as const;

export const RESTORED_PATH_BY_KIND = new Map(RESTORED_PATHS.map((path) => [path.kind, path]));

export function restoredDraftKey(kind: RestoredPathKind) {
  return `kontur:v3:draft:${kind}`;
}

export function restoredDefaultStatus(kind: RestoredPathKind) {
  return kind === 'contribution' || kind === 'save' ? 'done' as const : 'active' as const;
}
