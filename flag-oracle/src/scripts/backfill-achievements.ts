/**
 * One-off backfill: award achievements to progression records that predate the
 * achievement system.
 *
 * Lives under `src/` so that `tsc` typechecks it, `npm run build` emits it to
 * `dist/scripts/`, and the Dockerfile ships it via `COPY --from=builder /app/dist`.
 * A script outside `src/` would be excluded by `rootDir` and never reach the image.
 *
 * Run against a deployed instance:
 *
 *   docker compose exec flag-oracle npm run backfill:achievements
 *
 * Safe to run more than once — `applyAchievements` de-duplicates by (id, realm),
 * so re-running awards nothing and reports zero.
 */

/* eslint-disable no-console -- operator-facing CLI; stdout is the interface */

import 'reflect-metadata';
import { configureContainer } from '../config/di';
import { AchievementService } from '../services/achievement-service';

async function main() {
  const container = configureContainer();
  const service = container.resolve(AchievementService);
  const summary = await service.backfillAll();

  console.log(
    `Backfill complete: ${summary.awarded} achievement(s) awarded across ` +
      `${summary.usersUpdated} user(s).`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
