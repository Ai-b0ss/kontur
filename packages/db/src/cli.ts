import { connect } from './driver.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

/** `pnpm migrate` — накат миграций и посев. */
const db = await connect(process.env.DATABASE_URL);
console.log(`драйвер: ${db.driver}`);

const ran = await migrate(db);
console.log(
  ran.length ? `применены миграции: ${ran.join(', ')}` : 'миграции уже применены',
);

await seed(db);
console.log('посев выполнен');

await db.close();
