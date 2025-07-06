#!/usr/bin/env node

/**
 * Smoke Test CLI for Post-Deployment Validation
 * 
 * This standalone script can be run after deployment to validate
 * that the Taskmaster system is functioning correctly.
 * 
 * Usage:
 *   npm run smoke-test
 *   node scripts/smoke-test-cli.js
 *   node scripts/smoke-test-cli.js --github-token=<token> --verbose
 */

const SmokeTestFramework = require('../src/tests/smoke-test-framework').default;

interface CliOptions {
  githubToken?: string;
  owner?: string;
  repo?: string;
  verbose?: boolean;
  help?: boolean;
  exitOnFailure?: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    verbose: false,
    exitOnFailure: true
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--no-exit-on-failure') {
      options.exitOnFailure = false;
    } else if (arg.startsWith('--github-token=')) {
      options.githubToken = arg.split('=')[1];
    } else if (arg.startsWith('--owner=')) {
      options.owner = arg.split('=')[1];
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.split('=')[1];
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Taskmaster Smoke Test CLI

Usage:
  smoke-test-cli [options]

Options:
  --help, -h                 Show this help message
  --verbose, -v              Enable verbose output
  --github-token=<token>     GitHub API token for API health checks
  --owner=<owner>            GitHub repository owner
  --repo=<repo>              GitHub repository name
  --no-exit-on-failure       Don't exit with non-zero code on test failures

Environment Variables:
  GITHUB_TOKEN              GitHub API token (alternative to --github-token)
  GITHUB_OWNER              GitHub repository owner (alternative to --owner)
  GITHUB_REPO               GitHub repository name (alternative to --repo)
  DEBUG_TESTS               Enable debug output (same as --verbose)

Examples:
  smoke-test-cli --verbose
  smoke-test-cli --github-token=ghp_... --owner=myorg --repo=myrepo
  GITHUB_TOKEN=ghp_... smoke-test-cli --verbose
`);
}

async function main(): Promise<void> {
  const options = parseCliArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('🧪 Taskmaster Smoke Test Suite');
  console.log('================================\n');

  // Initialize smoke test framework
  const smokeTests = new SmokeTestFramework({
    githubToken: options.githubToken || process.env.GITHUB_TOKEN,
    owner: options.owner || process.env.GITHUB_OWNER || 'cmbrose',
    repo: options.repo || process.env.GITHUB_REPO || 'task-master-issues',
    verbose: options.verbose || process.env.DEBUG_TESTS === 'true'
  });

  try {
    // Run the complete smoke test suite
    const results = await smokeTests.runSmokeTests();

    console.log('\n📋 Test Summary:');
    console.log(`   Suite: ${results.suiteName}`);
    console.log(`   Tests: ${results.passedTests}/${results.totalTests} passed`);
    console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`   Success Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);

    if (results.passed) {
      console.log('\n✅ SUCCESS: All smoke tests passed!');
      console.log('   The Taskmaster system appears to be healthy and ready for use.');
      
      if (options.exitOnFailure) {
        process.exit(0);
      }
    } else {
      console.log('\n❌ FAILURE: Some smoke tests failed.');
      console.log('   Please review the test results and address issues before proceeding.\n');
      
      // Show failed test details
      const failedTests = results.results.filter((r: any) => !r.passed);
      console.log('Failed Tests:');
      failedTests.forEach((test: any, index: number) => {
        console.log(`${index + 1}. ${test.testName}`);
        console.log(`   Error: ${test.error}`);
        console.log(`   Duration: ${test.duration}ms\n`);
      });

      if (options.exitOnFailure) {
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR: Smoke test suite failed to execute');
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    if (options.exitOnFailure) {
      process.exit(2);
    }
  }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  process.exit(3);
});

process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(4);
});

// Only run if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error in smoke test CLI:', error);
    process.exit(5);
  });
}

module.exports = { main, parseCliArgs, printHelp };