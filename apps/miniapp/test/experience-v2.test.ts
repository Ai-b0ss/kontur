import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildQuestionDraft, viewForJourney } from '../src/experience-v2-state.ts';
import { previewInitData } from '../src/preview.ts';

describe('новый путь в мини-приложении', () => {
  test('собирает вопрос из трёх частей без передачи лишних пробелов', () => {
    assert.equal(buildQuestionDraft({
      goal: '  Как подтвердить грант? ',
      checked: 'Прочитал закреп.',
      needed: ' Нужен срок. ',
    }), 'Как подтвердить грант?\n\nПрочитал закреп.\n\nНужен срок.');
  });

  test('показывает экран по сохранённому серверному состоянию', () => {
    assert.equal(viewForJourney('started'), 'compose');
    assert.equal(viewForJourney('prepared'), 'preview');
    assert.equal(viewForJourney('published'), 'waiting');
    assert.equal(viewForJourney('helped'), 'outcome');
    assert.equal(viewForJourney('saved'), 'nest');
  });

  test('предпросмотр даёт десять изолированных мест и выключен в обычной сборке', () => {
    assert.equal(previewInitData('?preview=5', true), 'dev:980005');
    assert.equal(previewInitData('', true), 'dev:980001');
    assert.equal(previewInitData('?preview=10', true), 'dev:980010');
    assert.equal(previewInitData('?preview=11', true), '');
    assert.equal(previewInitData('?preview=1.0', true), '');
    assert.equal(previewInitData('?preview=', true), '');
    assert.equal(previewInitData('?preview=5', false), '');
  });
});
