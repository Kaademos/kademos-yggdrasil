import 'reflect-metadata';
import { configureContainer } from '../src/config/di';
import { AchievementService } from '../src/services/achievement-service';

async function main() {
  const container = configureContainer();
  const service = container.resolve(AchievementService);
  const summary = await service.backfillAll();
  console.log(`Backfill selesai: ${summary.usersUpdated} user, ${summary.awarded} achievement diberikan`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
