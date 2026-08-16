import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveZeroSeasonAction,
  selectZeroSeasonVote,
  zeroSeasonEffect,
  zeroSeasonLeader,
  zeroSeasonQuestionSeries,
  zeroSeasonDifficulty,
  zeroSeasonRank,
  zeroSeasonSchedule,
} from '../src/zero-season.ts';

describe('нулевой сезон', () => {
  it('не даёт удар за один найденный ответ и сохраняет частичный результат разведкой', () => {
    assert.equal(zeroSeasonEffect(5, 'attack'), 'attack');
    assert.equal(zeroSeasonEffect(3, 'attack'), 'scout');
    assert.equal(zeroSeasonEffect(2, 'shield'), 'scout');
    assert.equal(zeroSeasonEffect(1, 'scout'), 'none');
  });

  it('собирает все голоса птицы в один предсказуемый выбор', () => {
    const chosen = selectZeroSeasonVote([
      { bird: 'owl', intent: 'attack', nest: 2 },
      { bird: 'owl', intent: 'attack', nest: 2 },
      { bird: 'owl', intent: 'shield', nest: 1 },
    ], 'owl');
    assert.deepEqual(chosen, { bird: 'owl', intent: 'attack', nest: 2 });
  });

  it('щит снимается первым ударом, а чужой насест сначала становится нейтральным', () => {
    const board = { nests: ['owl', null, null] as const, shields: [0], marks: [] };
    const broken = resolveZeroSeasonAction(board, 'crane', 'attack', 0);
    assert.equal(broken.note, 'shield_broken');
    const neutralized = resolveZeroSeasonAction(broken.board, 'crane', 'attack', 0);
    assert.equal(neutralized.note, 'neutralized');
    assert.equal(neutralized.board.nests[0], null);
  });

  it('объявляет лидерство только при четырёх насестах', () => {
    assert.equal(zeroSeasonLeader({ nests: ['owl', 'owl', 'owl', 'owl', null], shields: [], marks: [] }), 'owl');
    assert.equal(zeroSeasonLeader({ nests: ['owl', 'owl', 'owl', null], shields: [], marks: [] }), null);
  });

  it('строит пять воспроизводимых коротких задач с допустимыми ответами', () => {
    const today = zeroSeasonQuestionSeries(321, 77, 'owl');
    const repeated = zeroSeasonQuestionSeries(321, 77, 'owl');
    const tomorrow = zeroSeasonQuestionSeries(322, 77, 'owl');
    assert.deepEqual(today, repeated);
    assert.equal(today.length, 5);
    assert.ok(today.every((question) => question.options.length === 4 && question.answer >= 0 && question.answer < 4));
    assert.notDeepEqual(today.map((question) => question.prompt), tomorrow.map((question) => question.prompt));
    assert.notEqual(
      zeroSeasonQuestionSeries(321, 77, 'owl')[4]?.prompt,
      zeroSeasonQuestionSeries(321, 77, 'woodpecker')[4]?.prompt,
    );
  });

  it('даёт статус птицы только за сильные серии, а не за валюту или скорость', () => {
    assert.equal(zeroSeasonRank(0), 'rookie');
    assert.equal(zeroSeasonRank(3), 'field');
    assert.equal(zeroSeasonRank(7), 'crown');
  });

  it('поднимает сложность от базового правила к композиции условий', () => {
    assert.equal(zeroSeasonDifficulty(0), 'base');
    assert.equal(zeroSeasonDifficulty(3), 'applied');
    assert.equal(zeroSeasonDifficulty(7), 'advanced');
    assert.notEqual(
      zeroSeasonQuestionSeries(321, 77, 'owl', 0)[0]?.prompt,
      zeroSeasonQuestionSeries(321, 77, 'owl', 7)[0]?.prompt,
    );
  });

  it('завершает коллективную ветвь через пять недель', () => {
    assert.deepEqual(zeroSeasonSchedule(0), { number: 0, day: 1, daysLeft: 34 });
    assert.deepEqual(zeroSeasonSchedule(34), { number: 0, day: 35, daysLeft: 0 });
    assert.deepEqual(zeroSeasonSchedule(35), { number: 1, day: 1, daysLeft: 34 });
  });
});
