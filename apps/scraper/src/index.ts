import { logger } from './lib/logger.js';
import { runSchoolDiscovery } from './jobs/school-discovery.js';
import { runTierVerification } from './jobs/tier-verification.js';
import { runContactEnrichment } from './jobs/contact-enrichment.js';
import { runLinkedInVerification } from './jobs/linkedin-verification.js';
import { runEmailValidation } from './jobs/email-validation.js';

const JOBS = {
  discover: () => runSchoolDiscovery(),
  tier: () => runTierVerification('fdf'),
  enrich: () => runContactEnrichment('fdf'),
  linkedin: () => runLinkedInVerification(),
  validate: () => runEmailValidation(),
} as const;

type JobName = keyof typeof JOBS;

function isJob(name: string): name is JobName {
  return name in JOBS;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    logger.info(
      { available: Object.keys(JOBS) },
      'usage: pnpm -F @lwl/scraper start <job> | dev <job>',
    );
    return;
  }
  if (!isJob(arg)) {
    logger.error({ requested: arg, available: Object.keys(JOBS) }, 'unknown_job');
    process.exit(1);
  }
  logger.info({ job: arg }, 'job_start');
  const result = await JOBS[arg]();
  logger.info({ job: arg, result }, 'job_done');
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
