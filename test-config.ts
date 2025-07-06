import { loadConfig } from './scripts/config-management';

try {
  const config = loadConfig({
    validate: true,
    baseDir: process.cwd(),
    configPaths: ['test-retention.json']
  }, {
    maxArtifactsCount: parseInt(process.env.INPUT_MAX_ARTIFACTS_COUNT || '0'),
    retentionDays: parseInt(process.env.INPUT_RETENTION_DAYS || '0')
  });
  
  console.log('✅ Configuration loaded successfully');
  console.log(`  • Max artifacts count: ${config.maxArtifactsCount} (expected: 20)`);
  console.log(`  • Retention days: ${config.retentionDays} (expected: 60)`);
  
  if (config.maxArtifactsCount === 20 && config.retentionDays === 60) {
    console.log('✅ Environment variable override working correctly');
  } else {
    console.error('❌ Environment variable override failed');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Configuration loading failed:', (error as Error).message);
  process.exit(1);
}
