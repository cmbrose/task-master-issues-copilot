#!/usr/bin/env ts-node

/**
 * Test for Parent Issue State Management
 * 
 * Tests comprehensive parent issue state tracking including:
 * - Breakdown initialization and completion
 * - Dynamic status updates based on sub-issue completion
 * - State consistency validation
 * - Label management and tracking
 */

import { ParentIssueStateManager, BreakdownStatus, type BreakdownMetadata } from '../scripts/parent-issue-state-manager';
import { EnhancedGitHubApi, type ApiIssue } from '../scripts/github-api';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

class ParentStateTestSuite {
  private results: TestResult[] = [];
  private mockApi: any;
  private stateManager: ParentIssueStateManager;

  constructor() {
    this.mockApi = this.createMockGitHubApi();
    this.stateManager = new ParentIssueStateManager(this.mockApi);
  }

  private createMockGitHubApi() {
    const mockIssues = new Map<number, ApiIssue>();
    const testSuiteRef = this;
    
    // Setup mock issues
    mockIssues.set(100, {
      number: 100,
      title: 'Parent Issue',
      body: '## Details\nThis is a parent issue for breakdown testing',
      state: 'open',
      labels: [{ name: 'taskmaster' }],
      updated_at: new Date().toISOString()
    } as ApiIssue);
    
    mockIssues.set(101, {
      number: 101,
      title: 'Sub-issue 1',
      body: '## Details\nFirst sub-issue\n\n## Meta\n- **Parent Task:** #100',
      state: 'open',
      labels: [{ name: 'taskmaster' }, { name: 'subtask' }],
      updated_at: new Date().toISOString()
    } as ApiIssue);
    
    mockIssues.set(102, {
      number: 102,
      title: 'Sub-issue 2',
      body: '## Details\nSecond sub-issue\n\n## Meta\n- **Parent Task:** #100',
      state: 'closed',
      labels: [{ name: 'taskmaster' }, { name: 'subtask' }],
      updated_at: new Date().toISOString()
    } as ApiIssue);
    
    return {
      async getIssue(issueNumber: number): Promise<ApiIssue> {
        const issue = mockIssues.get(issueNumber);
        if (!issue) throw new Error(`Issue #${issueNumber} not found`);
        return issue;
      },
      
      async updateIssue(issueNumber: number, updates: any): Promise<void> {
        const issue = mockIssues.get(issueNumber);
        if (!issue) throw new Error(`Issue #${issueNumber} not found`);
        
        if (updates.body) issue.body = updates.body;
        if (updates.labels) {
          issue.labels = updates.labels.map((label: string) => ({ name: label }));
        }
        issue.updated_at = new Date().toISOString();
      },
      
      async getSubIssues(issueNumber: number): Promise<ApiIssue[]> {
        if (issueNumber === 100) {
          return [mockIssues.get(101)!, mockIssues.get(102)!];
        }
        return [];
      }
    };
  }

  async runTests(): Promise<void> {
    console.log('🧪 Testing Parent Issue State Management...\n');

    await this.testBreakdownInitialization();
    await this.testBreakdownCompletion();
    await this.testDynamicStateUpdates();
    await this.testStateConsistencyValidation();
    await this.testLabelManagement();

    this.printResults();
  }

  private async testBreakdownInitialization(): Promise<void> {
    console.log('1️⃣ Testing breakdown initialization...');
    
    try {
      const breakdownMetadata: BreakdownMetadata = {
        executedAt: new Date(),
        maxDepth: 2,
        complexityThreshold: 40,
        commandArgs: { depth: 2, threshold: 40 }
      };
      
      await this.stateManager.initializeBreakdown(100, breakdownMetadata);
      
      const state = this.stateManager.getState(100);
      if (!state) {
        this.results.push({
          name: 'Breakdown Initialization',
          passed: false,
          details: 'State not found after initialization'
        });
        return;
      }
      
      const passed = state.breakdownStatus === BreakdownStatus.BREAKDOWN_IN_PROGRESS &&
                    state.issueNumber === 100 &&
                    state.breakdownMetadata?.maxDepth === 2;
      
      this.results.push({
        name: 'Breakdown Initialization',
        passed,
        details: passed ? 'Successfully initialized breakdown state' : `Unexpected state: ${JSON.stringify(state)}`
      });
      
      console.log(`  ✅ Status: ${state.breakdownStatus}`);
      console.log(`  📊 Metadata: depth=${state.breakdownMetadata?.maxDepth}, threshold=${state.breakdownMetadata?.complexityThreshold}`);
      
    } catch (error) {
      this.results.push({
        name: 'Breakdown Initialization',
        passed: false,
        details: `Error: ${error}`
      });
    }
  }

  private async testBreakdownCompletion(): Promise<void> {
    console.log('\n2️⃣ Testing breakdown completion...');
    
    try {
      const subIssueNumbers = [101, 102];
      await this.stateManager.completeBreakdown(100, subIssueNumbers);
      
      const state = this.stateManager.getState(100);
      if (!state) {
        this.results.push({
          name: 'Breakdown Completion',
          passed: false,
          details: 'State not found after completion'
        });
        return;
      }
      
      const passed = state.breakdownStatus === BreakdownStatus.BREAKDOWN_COMPLETED &&
                    state.subIssueNumbers.length === 2 &&
                    state.totalSubIssues === 2 &&
                    state.completedSubIssues === 1; // One sub-issue is closed (102)
      
      this.results.push({
        name: 'Breakdown Completion',
        passed,
        details: passed ? 'Successfully completed breakdown' : `Unexpected state: ${JSON.stringify(state)}`
      });
      
      console.log(`  ✅ Status: ${state.breakdownStatus}`);
      console.log(`  📊 Progress: ${state.completedSubIssues}/${state.totalSubIssues} completed`);
      console.log(`  🔗 Sub-issues: ${state.subIssueNumbers.join(', ')}`);
      
    } catch (error) {
      this.results.push({
        name: 'Breakdown Completion',
        passed: false,
        details: `Error: ${error}`
      });
    }
  }

  private async testDynamicStateUpdates(): Promise<void> {
    console.log('\n3️⃣ Testing dynamic state updates...');
    
    try {
      // Simulate closing the remaining sub-issue
      const mockIssue101 = await this.mockApi.getIssue(101);
      mockIssue101.state = 'closed';
      
      await this.stateManager.refreshParentState(100);
      
      const state = this.stateManager.getState(100);
      if (!state) {
        this.results.push({
          name: 'Dynamic State Updates',
          passed: false,
          details: 'State not found after refresh'
        });
        return;
      }
      
      const passed = state.breakdownStatus === BreakdownStatus.ALL_SUBTASKS_COMPLETED &&
                    state.completedSubIssues === 2 &&
                    state.totalSubIssues === 2;
      
      this.results.push({
        name: 'Dynamic State Updates',
        passed,
        details: passed ? 'Successfully updated state when all sub-issues completed' : `Unexpected state: ${JSON.stringify(state)}`
      });
      
      console.log(`  ✅ Status: ${state.breakdownStatus}`);
      console.log(`  📊 Progress: ${state.completedSubIssues}/${state.totalSubIssues} completed`);
      
    } catch (error) {
      this.results.push({
        name: 'Dynamic State Updates',
        passed: false,
        details: `Error: ${error}`
      });
    }
  }

  private async testStateConsistencyValidation(): Promise<void> {
    console.log('\n4️⃣ Testing state consistency validation...');
    
    try {
      const consistencyCheck = await this.stateManager.validateStateConsistency(100);
      
      const passed = consistencyCheck.isConsistent;
      
      this.results.push({
        name: 'State Consistency Validation',
        passed,
        details: passed ? 'State consistency validation passed' : `Issues found: ${consistencyCheck.issues.join(', ')}`
      });
      
      console.log(`  ✅ Consistent: ${consistencyCheck.isConsistent}`);
      if (!consistencyCheck.isConsistent) {
        console.log(`  ⚠️ Issues: ${consistencyCheck.issues.join(', ')}`);
      }
      
    } catch (error) {
      this.results.push({
        name: 'State Consistency Validation',
        passed: false,
        details: `Error: ${error}`
      });
    }
  }

  private async testLabelManagement(): Promise<void> {
    console.log('\n5️⃣ Testing label management...');
    
    try {
      // Check that the parent issue has proper labels
      const parentIssue = await this.mockApi.getIssue(100);
      const labelNames = parentIssue.labels?.map((l: any) => l.name) || [];
      
      const hasBreakdownLabels = labelNames.includes('breakdown-completed') ||
                                labelNames.includes('all-subtasks-completed');
      
      this.results.push({
        name: 'Label Management',
        passed: hasBreakdownLabels,
        details: hasBreakdownLabels ? 'Parent issue has proper breakdown labels' : `Labels found: ${labelNames.join(', ')}`
      });
      
      console.log(`  🏷️ Labels: ${labelNames.join(', ')}`);
      
    } catch (error) {
      this.results.push({
        name: 'Label Management',
        passed: false,
        details: `Error: ${error}`
      });
    }
  }

  private printResults(): void {
    console.log('\n🎉 Test Results Summary:');
    console.log('='.repeat(50));
    
    let passed = 0;
    let total = this.results.length;
    
    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
      if (result.passed) passed++;
    }
    
    console.log('='.repeat(50));
    console.log(`📊 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🚀 All parent issue state management tests passed!');
    } else {
      console.log('⚠️ Some tests failed. Review implementation.');
    }
  }
}

// Run tests
async function main() {
  const testSuite = new ParentStateTestSuite();
  await testSuite.runTests();
}

main().catch(console.error);