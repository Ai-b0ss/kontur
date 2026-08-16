import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { connect } from '../src/driver.js';
import { migrate } from '../src/migrate.js';
import { num } from '../src/repo.js';

describe('схема нового пути', () => {
  test('добавляется без изменения прежних пользователей и держит ограничения', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kontur-journey-schema-'));
    const previous = process.env.PGLITE_DIR;
    process.env.PGLITE_DIR = join(root, 'pg');

    try {
      const db = await connect(undefined);
      try {
        const ran = await migrate(db);
        assert.ok(ran.includes('004_participation_journey.sql'));
        assert.ok(ran.includes('005_journey_action_requests.sql'));
        assert.ok(ran.includes('006_journey_reminders.sql'));

        const requester = await db.one<{ id: string | number }>(
          "insert into users (tg_id, username) values (92001, 'requester') returning id",
        );
        const helper = await db.one<{ id: string | number }>(
          "insert into users (tg_id, username) values (92002, 'helper') returning id",
        );
        const requesterId = num(requester?.id);
        const helperId = num(helper?.id);

        await db.query(
          `insert into participation_profiles (user_id, current_intent)
           values ($1, 'ask')`,
          [requesterId],
        );
        const chat = await db.one<{ id: string | number }>(
          `insert into pilot_chats (code, title, purpose, kind)
           values ('general', 'Общий чат', 'Помощь с первым вопросом', 'general')
           returning id`,
        );
        const chatId = num(chat?.id);
        const journey = await db.one<{ id: string | number }>(
          `insert into journeys (user_id, pilot_chat_id, intent, client_request_id)
           values ($1, $2, 'ask', 'journey-request-0001') returning id`,
          [requesterId, chatId],
        );
        const journeyId = num(journey?.id);

        await db.query(
          `insert into journey_action_requests (user_id,client_request_id,action,journey_id)
           values ($1, 'action-request-0001', 'journey_start', $2)`,
          [requesterId, journeyId],
        );
        await assert.rejects(() => db.query(
          `insert into journey_action_requests (user_id,client_request_id,action,journey_id)
           values ($1, 'action-request-0001', 'journey_prepared', $2)`,
          [requesterId, journeyId],
        ));

        await assert.rejects(() => db.query(
          `insert into journeys (user_id, intent, client_request_id)
           values ($1, 'help', 'journey-request-0002')`,
          [requesterId],
        ));

        await assert.rejects(() => db.query(
          `insert into help_confirmations
             (journey_id, requester_user_id, helper_user_id, source_chat_id,
              source_message_id, reply_message_id, status, client_request_id)
           values ($1, $2, $2, -1001, 10, 11, 'helped', 'confirm-request-0001')`,
          [journeyId, requesterId],
        ));

        await db.query(
          `insert into help_confirmations
             (journey_id, requester_user_id, helper_user_id, source_chat_id,
              source_message_id, reply_message_id, status, client_request_id)
           values ($1, $2, $3, -1001, 10, 11, 'helped', 'confirm-request-0002')`,
          [journeyId, requesterId, helperId],
        );
        await assert.rejects(() => db.query(
          `insert into help_confirmations
             (journey_id, requester_user_id, helper_user_id, source_chat_id,
              source_message_id, reply_message_id, status, client_request_id)
           values ($1, $2, $3, -1001, 10, 11, 'helped', 'confirm-request-0003')`,
          [journeyId, requesterId, helperId],
        ));

        await assert.rejects(() => db.query(
          `insert into nest_items
             (user_id, journey_id, label, status, client_request_id)
           values ($1, $2, '   ', 'helped', 'nest-request-0001')`,
          [requesterId, journeyId],
        ));
        await db.query(
          `insert into nest_items
             (user_id, journey_id, label, status, next_step, client_request_id)
           values ($1, $2, 'Правила гранта', 'helped', 'Проверить срок', 'nest-request-0002')`,
          [requesterId, journeyId],
        );
        const nestItem = await db.one<{ id: string | number }>(
          'select id from nest_items where journey_id=$1',
          [journeyId],
        );
        await db.query(
          `insert into journey_reminders (user_id,nest_item_id,client_request_id)
           values ($1,$2,'reminder-request-0001')`,
          [requesterId, num(nestItem?.id)],
        );
        await assert.rejects(() => db.query(
          `insert into journey_reminders (user_id,nest_item_id,client_request_id)
           values ($1,$2,'reminder-request-0002')`,
          [requesterId, num(nestItem?.id)],
        ));

        await assert.rejects(() => db.query(
          `insert into journey_events (user_id, journey_id, type)
           values ($1, $2, 'message_text_copied')`,
          [requesterId, journeyId],
        ));
        await db.query(
          `insert into journey_events (user_id, journey_id, type, client)
           values ($1, $2, 'result_saved', 'desktop')`,
          [requesterId, journeyId],
        );

        const counts = await db.one<{ users: string | number; journeys: string | number }>(
          `select (select count(*) from users) as users,
                  (select count(*) from journeys) as journeys`,
        );
        assert.equal(num(counts?.users), 2);
        assert.equal(num(counts?.journeys), 1);
      } finally {
        await db.close();
      }
    } finally {
      if (previous === undefined) delete process.env.PGLITE_DIR;
      else process.env.PGLITE_DIR = previous;
      await rm(root, { recursive: true, force: true });
    }
  });
});
