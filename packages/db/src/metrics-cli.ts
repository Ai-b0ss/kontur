import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './driver.js';
import { migrate } from './migrate.js';
import { pilotMetrics } from './metrics.js';

const rootEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env');
const envFile = process.env.KONTUR_ENV_FILE ? resolve(process.env.KONTUR_ENV_FILE) : rootEnv;
if (existsSync(envFile)) process.loadEnvFile(envFile);

const db = await connect(process.env.DATABASE_URL);
try {
  await migrate(db);
  const metrics = await pilotMetrics(db);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    const pct = (value: number | null) => value === null ? 'недостаточно данных' : `${value}%`;
    console.log(`Отчёт Контур · ${metrics.generatedAt}`);
    console.log(`Стартовали: ${metrics.funnel.started}`);
    console.log(`Вылупились: ${metrics.funnel.hatched} (${pct(metrics.funnel.hatchRate)})`);
    console.log(`Активны: сутки ${metrics.activity.lastDay}, 7 дней ${metrics.activity.lastSevenDays}`);
    console.log(`D1: ${metrics.activity.d1Retained}/${metrics.activity.d1Eligible} (${pct(metrics.activity.d1Rate)})`);
    console.log(`D7: ${metrics.activity.d7Retained}/${metrics.activity.d7Eligible} (${pct(metrics.activity.d7Rate)})`);
    console.log(`Червяки за 7 дней: ${metrics.worms.grantsSevenDays}`);
    console.log(`С причиной: ${metrics.worms.withReasonSevenDays} (${pct(metrics.worms.reasonRate)})`);
    console.log(`Сигнал-карты: ${metrics.signals.total}, участников: ${metrics.signals.players}`);
  }
} finally {
  await db.close();
}
