import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";

const token = process.env.GITHUB_TOKEN;
const prNumber = process.env.PR_NUMBER;
const repoFull = process.env.REPO;

if (!token || !repoFull) {
  console.error("Missing required environment variables: GITHUB_TOKEN, REPO");
  process.exit(1);
}

const [owner, repo] = repoFull.split("/");
const octokit = new Octokit({ auth: token });
const graphqlWithAuth = graphql.defaults({ headers: { authorization: `token ${token}` } });

async function processPR(prNum: number) {
  try {
    // Get PR details
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNum,
    });
    const prNodeId = pr.node_id;

    // Check if cmbrose is a requested reviewer
    const reviewers = pr.requested_reviewers?.map((r: any) => r.login) || [];
    if (!reviewers.includes("cmbrose")) {
      console.log(`PR #${prNum}: cmbrose is not a requested reviewer, skipping.`);
      return;
    }

    // Publish if draft
    if (pr.draft) {
      await graphqlWithAuth(
        `mutation MarkReady($prId: ID!) {
          markPullRequestReadyForReview(input: {pullRequestId: $prId}) {
            pullRequest { id isDraft }
          }
        }`,
        { prId: prNodeId }
      );
      console.log(`PR #${prNum}: Published draft PR`);
    } else {
      console.log(`PR #${prNum}: PR is already published`);
    }

    // Merge the PR
    await octokit.pulls.merge({
      owner,
      repo,
      pull_number: prNum,
      merge_method: "squash", // or 'merge' or 'rebase'
    });
    console.log(`PR #${prNum}: Merged PR`);
  } catch (err) {
    console.error(`Error processing PR #${prNum}:`, err);
  }
}

async function main() {
  if (prNumber) {
    await processPR(Number(prNumber));
  } else {
    // No PR_NUMBER: poll all open PRs
    try {
      let page = 1;
      let processed = 0;
      while (true) {
        const { data: prs } = await octokit.pulls.list({
          owner,
          repo,
          state: "open",
          per_page: 100,
          page,
        });
        if (prs.length === 0) break;
        for (const pr of prs) {
          await processPR(pr.number);
          processed++;
        }
        if (prs.length < 100) break;
        page++;
      }
      if (processed === 0) {
        console.log("No open PRs found.");
      }
    } catch (err) {
      console.error("Error listing open PRs:", err);
      process.exit(1);
    }
  }
}

main(); 