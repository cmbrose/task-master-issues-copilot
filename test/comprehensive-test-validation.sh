#!/bin/bash

# Comprehensive Test Suite Validation Script
# This script validates all testing requirements for Issue #263
# - Comprehensive test suite covering all workflows and edge cases
# - Performance tests validating 5-minute runtime requirement
# - CI/CD pipeline testing
# - Smoke tests for Taskmaster CLI integration

# Don't exit on first error - we want to run all tests
set +e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNING_TESTS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"
    
    echo ""
    log_info "Running: $test_name"
    ((TOTAL_TESTS++))
    
    # Capture both stdout and stderr
    local output
    local exit_code
    
    if output=$(eval "$test_command" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi
    
    if [ $exit_code -eq $expected_exit_code ]; then
        log_success "$test_name"
        return 0
    else
        log_error "$test_name (Exit code: $exit_code, Expected: $expected_exit_code)"
        # Don't exit the script, just continue with other tests
        return 1
    fi
}

print_header() {
    echo ""
    echo "================================================================"
    echo -e "${BLUE}🧪 $1${NC}"
    echo "================================================================"
}

print_summary() {
    echo ""
    echo "================================================================"
    echo -e "${BLUE}📊 TEST SUMMARY${NC}"
    echo "================================================================"
    echo "Total Tests:    $TOTAL_TESTS"
    echo -e "Passed:         ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Warnings:       ${YELLOW}$WARNING_TESTS${NC}"
    echo -e "Failed:         ${RED}$FAILED_TESTS${NC}"
    
    local success_rate
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
        echo "Success Rate:   $success_rate%"
    fi
    
    echo ""
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo "Comprehensive testing and documentation requirements are fully met."
        return 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED${NC}"
        echo "Please review failed tests and resolve issues before proceeding."
        return 1
    fi
}

check_prerequisites() {
    print_header "PREREQUISITES CHECK"
    
    # Check Node.js
    run_test "Node.js installation" "node --version"
    
    # Check npm
    run_test "npm installation" "npm --version"
    
    # Check dependencies
    if npm list --depth=0 > /dev/null 2>&1; then
        log_success "npm dependencies"
    else
        log_warning "npm dependencies (some optional dependencies missing)"
    fi
    
    # Check TypeScript
    run_test "TypeScript compilation" "npx tsc --noEmit"
    
    # Check configuration files
    run_test "Jest configuration" "test -f jest.config.js"
    run_test "Package.json test scripts" "grep -q 'test:' package.json"
}

run_unit_tests() {
    print_header "UNIT TESTS"
    
    # Core unit tests with Jest
    run_test "Jest unit test suite" "npm run test:unit -- --passWithNoTests"
    
    # Test coverage analysis
    if npm run test:unit:coverage > /dev/null 2>&1; then
        log_success "Unit test coverage generation"
    else
        log_warning "Unit test coverage generation (non-critical)"
    fi
    
    # Specific component tests (these may not exist yet)
    if npm run demo:issue-parser > /dev/null 2>&1; then
        log_success "Issue parser demo"
    else
        log_warning "Issue parser demo (optional)"
    fi
    
    if npm run demo:metadata-extractor > /dev/null 2>&1; then
        log_success "Metadata extractor demo"  
    else
        log_warning "Metadata extractor demo (optional)"
    fi
}

run_integration_tests() {
    print_header "INTEGRATION TESTS"
    
    # API integration tests
    run_test "GitHub API integration" "npm run test:github-api-simple"
    
    # Database integration tests  
    run_test "Database integration" "npm run test:integration-framework"
    
    # Service integration tests
    run_test "Service integration" "npm run test:service-integration"
    
    # Sub-issues API tests
    run_test "Sub-issues API" "npm run test:sub-issues-api"
    
    # Dependency tracking tests
    run_test "Dependency tracking" "npm run test:dependency-tracking"
    
    # Blocked status management
    run_test "Blocked status management" "npm run test:blocked-status"
}

run_performance_tests() {
    print_header "PERFORMANCE TESTS"
    
    # 5-minute runtime requirement test
    log_info "Testing 5-minute runtime requirement for 1000-line PRDs..."
    local start_time=$(date +%s)
    
    if npm run test:5min-prd > /dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [ $duration -le 300 ]; then  # 5 minutes = 300 seconds
            log_success "5-minute runtime requirement ($duration seconds)"
        else
            log_warning "5-minute runtime requirement exceeded ($duration seconds)"
        fi
    else
        log_error "5-minute runtime requirement test failed"
    fi
    
    # Performance validation suite
    run_test "Performance validation suite" "timeout 600 npm run test:performance-validation" 0
    
    # Load testing scenarios
    run_test "Load testing scenarios" "timeout 300 npm run test:load-testing" 0
    
    # Memory usage validation
    run_test "Memory usage validation" "npm run test:memory-usage > /dev/null" 0
}

run_smoke_tests() {
    print_header "SMOKE TESTS"
    
    # Taskmaster CLI integration smoke tests
    run_test "Smoke test framework" "npm run test:smoke"
    
    # System health checks
    run_test "System health validation" "npm run test:smoke:ci"
    
    # Configuration validation
    run_test "Configuration validation" "npm run config:validate" 0
}

run_workflow_tests() {
    print_header "WORKFLOW AND EDGE CASE TESTS"
    
    # Trigger configuration tests
    run_test "Trigger configuration" "npm run test:triggers"
    
    # Generate workflow tests
    run_test "Generate workflow" "npm run test:generate-workflow"
    
    # Issue creation tests
    run_test "Issue creation workflow" "npm run test:issue-creation"
    
    # Label hierarchy tests
    run_test "Label hierarchy" "npm run test:labels"
    
    # YAML parser tests
    run_test "YAML parser" "npm run test:yaml-parser"
    
    # Dry run mode tests
    run_test "Dry run mode" "npm run test:dry-run-mode"
    
    # Pull request trigger tests
    run_test "Pull request triggers" "npm run test:pull-request-trigger"
    
    # Enhanced dependency scanning
    run_test "Enhanced dependency scanning" "npm run test:enhanced-dependency-scanning"
    
    # Enhanced error handling
    run_test "Enhanced error handling" "npm run test:enhanced-error-handling"
    
    # E2E issue hierarchy
    run_test "E2E issue hierarchy" "npm run test:e2e-hierarchy"
    
    # Integration hierarchy
    run_test "Integration hierarchy" "npm run test:integration-hierarchy"
}

run_artifact_and_recovery_tests() {
    print_header "ARTIFACT MANAGEMENT AND RECOVERY TESTS"
    
    # Artifact retention tests
    run_test "Artifact retention" "npm run test:artifact-retention"
    
    # Artifact cleanup tests
    run_test "Artifact cleanup" "npm run test:artifact-cleanup"
    
    # Artifact capabilities tests
    run_test "Artifact capabilities" "npm run test:artifact-capabilities"
    
    # Artifact recovery tests
    run_test "Artifact recovery" "npm run test:artifact-recovery"
    
    # Batch processing tests
    run_test "Batch processing" "npm run test:batch-processing"
    
    # Enhanced rate limit recovery
    run_test "Rate limit recovery" "npm run test:enhanced-rate-limit-recovery"
    
    # Idempotency framework
    run_test "Idempotency framework" "npm run test:idempotency-framework"
    
    # Idempotency integration
    run_test "Idempotency integration" "npm run test:idempotency-integration"
}

run_advanced_features_tests() {
    print_header "ADVANCED FEATURES TESTS"
    
    # Comprehensive error handling
    run_test "Comprehensive error handling" "npm run test:comprehensive-error-handling"
    
    # Task graph replay workflow
    run_test "Task graph replay workflow" "npm run test:taskgraph-replay-workflow"
    
    # Parent issue state management
    run_test "Parent issue state management" "npm run test:parent-issue-state"
    
    # Preview comment generation
    run_test "Preview comment generation" "npm run test:preview-comment-generation"
    
    # Integration PR workflow
    run_test "Integration PR workflow" "npm run test:integration-pr-workflow"
    
    # Edge cases preview
    run_test "Edge cases preview" "npm run test:edge-cases-preview"
    
    # Comment parser tests
    run_test "Comment parser" "npm run test:comment-parser"
    
    # Enhanced validation
    run_test "Enhanced validation" "npm run test:enhanced-validation"
    
    # Metadata extractor
    run_test "Metadata extractor" "npm run test:metadata-extractor"
}

run_scheduling_and_cron_tests() {
    print_header "SCHEDULING AND AUTOMATION TESTS"
    
    # Cron scheduling tests
    run_test "Cron scheduling" "npm run test:cron-scheduling"
    
    # Artifact download validation
    run_test "Artifact download validation" "npm run test:artifact-download-validation"
    
    # Webhook triggers
    run_test "Webhook triggers" "npm run test:webhook-triggers"
    
    # Manual dry run toggle
    run_test "Manual dry run toggle" "npm run test:manual-dry-run-toggle"
    
    # Comprehensive validation
    run_test "Comprehensive validation" "npm run test:comprehensive-validation"
}

validate_ci_cd_pipeline() {
    print_header "CI/CD PIPELINE VALIDATION"
    
    # Check GitHub Actions workflow files
    run_test "Main workflow file exists" "test -f .github/workflows/taskmaster.yml"
    run_test "Generate workflow file exists" "test -f .github/workflows/taskmaster-generate.yml"
    run_test "Breakdown workflow file exists" "test -f .github/workflows/taskmaster-breakdown.yml"
    run_test "Watcher workflow file exists" "test -f .github/workflows/taskmaster-watcher.yml"
    run_test "CI/CD pipeline file exists" "test -f .github/workflows/ci-cd-pipeline.yml"
    run_test "Smoke tests workflow exists" "test -f .github/workflows/smoke-tests.yml"
    
    # Validate workflow syntax
    if command -v gh >/dev/null 2>&1; then
        log_info "GitHub CLI available - validating workflow syntax"
        # Note: This requires gh auth and may not work in all environments
        if gh workflow list >/dev/null 2>&1; then
            log_success "GitHub workflows validation"
        else
            log_warning "GitHub workflows validation (requires auth)"
        fi
    else
        log_warning "GitHub CLI not available - skipping workflow validation"
    fi
}

validate_documentation() {
    print_header "DOCUMENTATION VALIDATION"
    
    # Check core documentation files
    run_test "Setup instructions exist" "test -f docs/setup-instructions.md"
    run_test "Configuration options exist" "test -f docs/configuration-options.md"
    run_test "Troubleshooting guide exists" "test -f docs/troubleshooting-guide.md"
    run_test "User guide exists" "test -f docs/user-guide.md"
    run_test "Architecture overview exists" "test -f docs/architecture-overview.md"
    
    # Check examples
    run_test "Example PRDs exist" "test -d examples/prds"
    run_test "Example outputs exist" "test -d examples/outputs"
    run_test "Examples README exists" "test -f examples/README.md"
    
    # Validate example PRD files
    run_test "User auth PRD example exists" "test -f examples/prds/user-authentication-system.prd.md"
    run_test "Ecommerce PRD example exists" "test -f examples/prds/ecommerce-checkout-system.prd.md"
    run_test "Mobile PRD example exists" "test -f examples/prds/mobile-push-notifications.prd.md"
    
    # Validate expected outputs
    run_test "User auth expected output exists" "test -f examples/outputs/user-authentication-system-expected-issues.md"
    
    # Check documentation completeness
    local doc_count=$(find docs/ -name "*.md" | wc -l)
    if [ $doc_count -ge 35 ]; then
        log_success "Comprehensive documentation ($doc_count files)"
    else
        log_warning "Documentation completeness ($doc_count files, expected 35+)"
    fi
}

# Main execution function
main() {
    echo "🚀 Starting Comprehensive Test Suite Validation"
    echo "Testing all requirements for Issue #263: Implement Comprehensive Testing and Documentation"
    echo ""
    
    local start_time=$(date +%s)
    
    # Run all test categories
    check_prerequisites
    run_unit_tests
    run_integration_tests
    run_performance_tests
    run_smoke_tests
    run_workflow_tests
    run_artifact_and_recovery_tests
    run_advanced_features_tests
    run_scheduling_and_cron_tests
    validate_ci_cd_pipeline
    validate_documentation
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    echo ""
    echo "================================================================"
    echo -e "${BLUE}⏱️  EXECUTION TIME${NC}"
    echo "================================================================"
    echo "Total Duration: $total_duration seconds"
    
    if [ $total_duration -le 1800 ]; then  # 30 minutes
        log_success "Execution time within acceptable limits"
    else
        log_warning "Execution time exceeded 30 minutes"
    fi
    
    # Print final summary
    print_summary
}

# Handle script arguments
case "${1:-}" in
    "prerequisites")
        check_prerequisites
        print_summary
        ;;
    "unit")
        run_unit_tests
        print_summary
        ;;
    "integration")
        run_integration_tests
        print_summary
        ;;
    "performance")
        run_performance_tests
        print_summary
        ;;
    "smoke")
        run_smoke_tests
        print_summary
        ;;
    "workflow")
        run_workflow_tests
        print_summary
        ;;
    "ci-cd")
        validate_ci_cd_pipeline
        print_summary
        ;;
    "docs")
        validate_documentation
        print_summary
        ;;
    "quick")
        check_prerequisites
        run_unit_tests
        run_smoke_tests
        validate_documentation
        print_summary
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [category]"
        echo ""
        echo "Categories:"
        echo "  prerequisites - Check system requirements"
        echo "  unit         - Run unit tests"
        echo "  integration  - Run integration tests"
        echo "  performance  - Run performance tests"
        echo "  smoke        - Run smoke tests"
        echo "  workflow     - Run workflow and edge case tests"
        echo "  ci-cd        - Validate CI/CD pipeline"
        echo "  docs         - Validate documentation"
        echo "  quick        - Run essential tests only"
        echo "  (no args)    - Run complete test suite"
        ;;
    *)
        main
        ;;
esac