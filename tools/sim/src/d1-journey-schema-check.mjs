import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const workerDir = join(root, 'apps', 'worker');
const require = createRequire(join(workerDir, 'package.json'));
const wrangler = require.resolve('wrangler');
const temp = await mkdtemp(join(tmpdir(), 'kontur-d1-journey-schema-'));
const migrations = join(temp, 'migrations');
const state = join(temp, 'state');

function run(args, { expectFailure = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: temp,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if ((code === 0) === !expectFailure) resolveRun(output);
      else reject(new Error(`Неожиданный код ${code}:\n${output.slice(-4_000)}`));
    });
  });
}

async function d1Execute(command, options) {
  return run([
    wrangler, 'd1', 'execute', 'kontur', '--local', '--persist-to', state,
    '--command', command,
  ], options);
}

function parseD1Json(text) {
  const match = /(\[\s*\{\s*"results"[\s\S]*\}\s*\])/.exec(text);
  if (!match) throw new Error(`D1 не вернула JSON: ${text.slice(-2_000)}`);
  return JSON.parse(match[1]);
}

try {
  await mkdir(migrations);
  await writeFile(join(temp, 'worker.mjs'), 'export default { fetch() { return new Response("ok") } };\n');
  await writeFile(join(temp, 'wrangler.jsonc'), JSON.stringify({
    name: 'kontur-d1-journey-schema-check',
    main: 'worker.mjs',
    compatibility_date: '2026-08-05',
    d1_databases: [{
      binding: 'DB',
      database_name: 'kontur',
      database_id: '00000000-0000-0000-0000-000000000000',
      migrations_dir: 'migrations',
    }],
  }, null, 2));

  await copyFile(
    join(workerDir, 'migrations', '0001_initial.sql'),
    join(migrations, '0001_initial.sql'),
  );
  await copyFile(
    join(workerDir, 'migrations', '0002_maintenance.sql'),
    join(migrations, '0002_maintenance.sql'),
  );
  await run([wrangler, 'd1', 'migrations', 'apply', 'kontur', '--local', '--persist-to', state]);

  await d1Execute(
    `INSERT INTO users (tg_id,username,started_bot_at,is_member)
       VALUES (93001,'upgrade_fixture',datetime('now'),1);
     UPDATE profiles SET role='coder',hatched_at=datetime('now'),bird_name='Архив'
       WHERE user_id=(SELECT id FROM users WHERE tg_id=93001);
     UPDATE wallets SET wallet=17,reputation=9
       WHERE user_id=(SELECT id FROM users WHERE tg_id=93001);`,
  );

  await copyFile(
    join(workerDir, 'migrations', '0003_participation_journey.sql'),
    join(migrations, '0003_participation_journey.sql'),
  );
  await copyFile(
    join(workerDir, 'migrations', '0004_journey_action_requests.sql'),
    join(migrations, '0004_journey_action_requests.sql'),
  );
  await copyFile(
    join(workerDir, 'migrations', '0005_journey_reminders.sql'),
    join(migrations, '0005_journey_reminders.sql'),
  );
  await copyFile(
    join(workerDir, 'migrations', '0006_restored_product.sql'),
    join(migrations, '0006_restored_product.sql'),
  );
  await run([wrangler, 'd1', 'migrations', 'apply', 'kontur', '--local', '--persist-to', state]);

  const preservedText = await d1Execute(
    `SELECT u.username,p.role,p.bird_name,w.wallet,w.reputation,
            (SELECT count(*) FROM participation_profiles) AS new_profiles
       FROM users u JOIN profiles p ON p.user_id=u.id JOIN wallets w ON w.user_id=u.id
      WHERE u.tg_id=93001`,
  );
  const preserved = parseD1Json(preservedText)[0].results[0];
  if (
    preserved.username !== 'upgrade_fixture' || preserved.role !== 'coder' ||
    preserved.bird_name !== 'Архив' || Number(preserved.wallet) !== 17 ||
    Number(preserved.reputation) !== 9 || Number(preserved.new_profiles) !== 0
  ) {
    throw new Error(`Старая запись изменилась: ${JSON.stringify(preserved)}`);
  }

  await d1Execute(
    `INSERT INTO users (tg_id,username) VALUES (93002,'helper_fixture');
     INSERT INTO participation_profiles (user_id,current_intent)
       SELECT id,'ask' FROM users WHERE tg_id=93001;
     INSERT INTO pilot_chats (code,title,purpose,kind)
       VALUES ('general','Общий чат','Помощь с первым вопросом','general');
     INSERT INTO journeys (user_id,pilot_chat_id,intent,client_request_id)
       SELECT u.id,c.id,'ask','journey-request-0001'
         FROM users u,pilot_chats c WHERE u.tg_id=93001 AND c.code='general';
     INSERT INTO journey_action_requests (user_id,client_request_id,action)
       SELECT id,'action-request-0001','journey_start' FROM users WHERE tg_id=93001;
     INSERT INTO nest_items (user_id,journey_id,label,status,next_step,client_request_id)
       SELECT u.id,j.id,'Первый результат','helped','Проверить срок','nest-request-0001'
         FROM users u JOIN journeys j ON j.user_id=u.id WHERE u.tg_id=93001;
     INSERT INTO journey_reminders (user_id,nest_item_id,client_request_id)
       SELECT n.user_id,n.id,'reminder-request-0001' FROM nest_items n;
     INSERT INTO restored_actions
       (user_id,kind,status,title,visibility,client_request_id)
       SELECT id,'connect','active','Ищу команду','flock','restored-action-0001'
         FROM users WHERE tg_id=93001;
     INSERT INTO restored_nest_items
       (user_id,source_kind,source_id,title,next_step,client_request_id)
       SELECT id,'action','1','Сохранённый контакт','Написать','restored-nest-0001'
         FROM users WHERE tg_id=93001;`,
  );

  await d1Execute(
    `INSERT INTO journeys (user_id,intent,client_request_id)
       SELECT id,'help','journey-request-0002' FROM users WHERE tg_id=93001`,
    { expectFailure: true },
  );
  await d1Execute(
    `INSERT INTO help_confirmations
       (journey_id,requester_user_id,helper_user_id,source_chat_id,
        source_message_id,reply_message_id,status,client_request_id)
     SELECT j.id,u.id,u.id,-1001,10,11,'helped','confirm-request-0001'
       FROM journeys j JOIN users u ON u.id=j.user_id WHERE u.tg_id=93001`,
    { expectFailure: true },
  );

  const schemaText = await d1Execute(
    `SELECT (SELECT count(*) FROM journeys) AS journeys,
            (SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN
              ('participation_profiles','pilot_chats','journeys','help_confirmations',
               'nest_items','journey_events','journey_action_requests','journey_reminders',
               'restored_actions','restored_action_updates','restored_nest_items',
               'restored_nest_updates','restored_preferences','restored_opportunities')) AS new_tables,
            (SELECT count(*) FROM journey_reminders WHERE status='pending') AS reminders,
            (SELECT count(*) FROM restored_opportunities) AS opportunities,
            (SELECT count(*) FROM restored_actions) AS restored_actions,
            (SELECT count(*) FROM restored_nest_items) AS restored_nest`,
  );
  const schema = parseD1Json(schemaText)[0].results[0];
  if (
    Number(schema.journeys) !== 1 || Number(schema.new_tables) !== 14 ||
    Number(schema.reminders) !== 1 || Number(schema.opportunities) !== 4 ||
    Number(schema.restored_actions) !== 1 || Number(schema.restored_nest) !== 1
  ) {
    throw new Error(`Новая схема неполна: ${JSON.stringify(schema)}`);
  }

  console.log('  ✔ D1 обновляется с 0002 до 0006 без изменения старой записи');
  console.log('  ✔ V2 и восстановленные V3-таблицы с ограничениями применены рядом');
} finally {
  await rm(temp, { recursive: true, force: true });
}
