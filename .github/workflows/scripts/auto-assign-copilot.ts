import { Octokit } from "@octokit/rest";

const token = process.env.GITHUB_TOKEN!;
const [owner, repo] = process.env.REPO!.split("/");
const closedIssueNumber = Number(process.env.ISSUE_NUMBER);

const octokit = new Octokit({ auth: token });

function parseRequiredBy(body: string): number[] {
  const match = body.match(/- Required By:\n([\s\S]+?)(?:\n\S|$)/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/#(\d+)/g)).map(m => Number(m[1]));
}

function parseDependencies(body: string): number[] {
  const match = body.match(/## Dependencies\n([\s\S]+?)(?:\n\S|$)/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/#(\d+)/g)).map(m => Number(m[1]));
}

async function getSubIssues(issueNumber: number): Promise<number[]> {
    const { data: subIssues } = await (octokit.issues as any).listSubIssues({ owner, repo, issue_number: issueNumber });
    return subIssues.map((i: any) => i.number);
}

async function isClosed(issueNumber: number): Promise<boolean> {
  const { data: issue } = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
  return issue.state === "closed";
}

async function findParentIssueOfSubissue(body: string): Promise<number | undefined> {
    const match = body.match(/- Parent Task: #(\d+)/);
    if (match) {
        return Number(match[1]);
    }
    return undefined;
}

async function checkAndAssignCopilot(issueNumber: number) {
  const { data: reqIssue } = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
  const dependencies = parseDependencies(reqIssue.body || "");
  const allDepsClosed = await Promise.all(dependencies.map(isClosed)).then(arr => arr.every(Boolean));
  const subIssues = await getSubIssues(issueNumber);
  const allSubsClosed = await Promise.all(subIssues.map(isClosed)).then(arr => arr.every(Boolean));
  if (allDepsClosed && allSubsClosed) {
    await octokit.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: ["Copilot"],
    });
    console.log(`Assigned Copilot to issue #${issueNumber}`);
  }
}

async function main() {
  // 1. Fetch the closed issue
  const { data: closedIssue } = await octokit.issues.get({ owner, repo, issue_number: closedIssueNumber });

  // 2. Find all issues that require it
  const requiredBy = parseRequiredBy(closedIssue.body || "");
  for (const reqIssueNumber of requiredBy) {
    await checkAndAssignCopilot(reqIssueNumber);
  }

  // 3. If this issue is a subissue, find its parent(s) and check them
  const parentNumber = await findParentIssueOfSubissue(closedIssue.body || "");
  if (parentNumber !== undefined) {
    await checkAndAssignCopilot(parentNumber);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});