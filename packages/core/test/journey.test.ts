import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  advanceParticipationStage,
  canTransitionJourney,
  canTransitionNestItem,
  decideHelpConfirmation,
  isValidClientRequestId,
} from '../src/index.ts';

describe('путь участия', () => {
  test('движется только вперёд', () => {
    assert.equal(advanceParticipationStage('looking', 'conversation_joined'), 'thread');
    assert.equal(advanceParticipationStage('thread', 'result_saved'), 'nest');
    assert.equal(advanceParticipationStage('nest', 'connection_extended'), 'connection');
  });

  test('пауза и повтор не уменьшают состояние птицы', () => {
    assert.equal(advanceParticipationStage('nest', 'intent_selected'), 'nest');
    assert.equal(advanceParticipationStage('connection', 'result_saved'), 'connection');
  });
});

describe('состояния разговора', () => {
  test('поддерживает основной путь до результата', () => {
    assert.equal(canTransitionJourney('started', 'prepared'), true);
    assert.equal(canTransitionJourney('prepared', 'published'), true);
    assert.equal(canTransitionJourney('published', 'waiting'), true);
    assert.equal(canTransitionJourney('waiting', 'helped'), true);
    assert.equal(canTransitionJourney('helped', 'saved'), true);
    assert.equal(canTransitionJourney('saved', 'done'), true);
  });

  test('после уточнения разрешает подготовить продолжение', () => {
    assert.equal(canTransitionJourney('clarify', 'prepared'), true);
  });

  test('не позволяет перескочить из начала прямо в результат', () => {
    assert.equal(canTransitionJourney('started', 'helped'), false);
    assert.equal(canTransitionJourney('closed', 'prepared'), false);
  });
});

describe('благодарность за конкретный ответ', () => {
  const base = {
    requesterUserId: 1,
    helperUserId: 2,
    sourceMessageId: 10,
    replyMessageId: 11,
    duplicate: false,
    recentPairConfirmations: 0,
  };

  test('принимает доступную пару вопроса и ответа', () => {
    assert.deepEqual(decideHelpConfirmation(base), { accepted: true, status: 'helped' });
  });

  test('запрещает благодарить себя', () => {
    assert.deepEqual(decideHelpConfirmation({ ...base, helperUserId: 1 }), {
      accepted: false,
      rejection: 'self',
    });
  });

  test('не принимает повтор той же пары сообщений', () => {
    assert.deepEqual(decideHelpConfirmation({ ...base, duplicate: true }), {
      accepted: false,
      rejection: 'duplicate',
    });
  });

  test('не выдаёт недоступное сообщение за доказанную помощь', () => {
    assert.deepEqual(decideHelpConfirmation({ ...base, replyMessageId: null }), {
      accepted: false,
      rejection: 'message_unavailable',
    });
  });

  test('частую взаимность отправляет на проверку без обвинения', () => {
    assert.deepEqual(decideHelpConfirmation({ ...base, recentPairConfirmations: 3 }), {
      accepted: true,
      status: 'review',
    });
  });
});

describe('личное гнездо и защита повторов', () => {
  test('состояние гнезда может уточняться и завершаться, но не откатывается из done', () => {
    assert.equal(canTransitionNestItem('waiting', 'clarify'), true);
    assert.equal(canTransitionNestItem('clarify', 'helped'), true);
    assert.equal(canTransitionNestItem('helped', 'done'), true);
    assert.equal(canTransitionNestItem('done', 'waiting'), false);
  });

  test('принимает UUID-подобный ключ и отклоняет мусор', () => {
    assert.equal(isValidClientRequestId('550e8400-e29b-41d4-a716-446655440000'), true);
    assert.equal(isValidClientRequestId('short'), false);
    assert.equal(isValidClientRequestId('contains spaces'), false);
  });
});
