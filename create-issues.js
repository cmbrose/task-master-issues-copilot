"use strict";
// create-issues.ts
//
// Usage:
//   1. Install dependencies:
//      npm install @octokit/rest dotenv
//      npm install --save-dev @types/node
//   2. Set env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
//   3. Run with ts-node or compile with tsc
//
// Note: Requires Node.js types for process, fs, path, etc.
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var dotenv = require("dotenv");
var github_api_1 = require("./scripts/github-api");
var idempotency_manager_1 = require("./scripts/idempotency-manager");
var platform_utils_1 = require("./scripts/platform-utils");
// Types for Node.js globals (process, etc.)
// If you see type errors, run: npm install --save-dev @types/node
dotenv.config();
var GITHUB_TOKEN = process.env.GITHUB_TOKEN;
var GITHUB_OWNER = process.env.GITHUB_OWNER;
var GITHUB_REPO = process.env.GITHUB_REPO;
if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    console.error('Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO in environment variables.');
    process.exit(1);
}
var githubApi = (0, github_api_1.createGitHubApiClient)({
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    maxConcurrent: 3,
    retryDelay: 1000,
    maxRetries: 3,
    debug: process.env.DEBUG === 'true'
});
var TASKS_PATH = path.join('.taskmaster', 'tasks', 'tasks.json');
var COMPLEXITY_PATH = path.join('.taskmaster', 'reports', 'task-complexity-report.json');
var UNIQUE_MARKER = '<!-- created-by-taskmaster-script -->';
// Load complexity report if available
var complexityMap = {};
try {
    var complexityData = JSON.parse(fs.readFileSync(COMPLEXITY_PATH, 'utf-8'));
    for (var _i = 0, _a = complexityData.complexityAnalysis; _i < _a.length; _i++) {
        var entry = _a[_i];
        // Map both parent and subtask IDs as string keys
        complexityMap[String(entry.taskId)] = entry.complexityScore;
    }
}
catch (e) {
    // If not found or invalid, skip
    complexityMap = {};
}
// Helper to update issue labels based on dependency status
function updateDependencyLabels(task, dependencyIssues) {
    var additionalLabels = [];
    if (!dependencyIssues || dependencyIssues.length === 0) {
        return additionalLabels;
    }
    var openDependencies = dependencyIssues.filter(function (issue) { return issue.state === 'open'; });
    if (openDependencies.length > 0) {
        additionalLabels.push('blocked');
        additionalLabels.push("blocked-by:".concat(openDependencies.length));
    }
    else {
        // All dependencies are closed, task is ready
        additionalLabels.push('ready');
    }
    return additionalLabels;
}
// Helper to generate comprehensive labels for issues
function generateIssueLabels(task, parentTask, complexityScore) {
    var labels = ['taskmaster'];
    // Priority labels
    if (task.priority) {
        labels.push("priority:".concat(task.priority.toLowerCase()));
    }
    // Status labels
    if (task.status) {
        labels.push("status:".concat(task.status.toLowerCase()));
    }
    // Task type labels
    if (parentTask) {
        labels.push('subtask');
        labels.push("parent:".concat(parentTask.id));
    }
    else {
        labels.push('main-task');
    }
    // Complexity labels
    if (complexityScore !== undefined) {
        if (complexityScore >= 8) {
            labels.push('complexity:high');
        }
        else if (complexityScore >= 5) {
            labels.push('complexity:medium');
        }
        else {
            labels.push('complexity:low');
        }
    }
    // Dependency status labels
    if (task.dependencies && task.dependencies.length > 0) {
        labels.push('has-dependencies');
    }
    // Hierarchy labels
    if (task.subtasks && task.subtasks.length > 0) {
        labels.push('has-subtasks');
    }
    return labels;
}
function buildIssueBody(task, parentIssue) {
    var _a, _b;
    var body = '';
    // Add complexity if available
    var idKey;
    if (typeof task.id !== 'undefined' && parentIssue && parentIssue.id !== undefined) {
        // Subtask: use parentId.subtaskId
        idKey = "".concat(parentIssue.number, ".").concat(task.id);
    }
    else if (typeof task.id !== 'undefined') {
        // Parent task: use id
        idKey = String(task.id);
    }
    else {
        idKey = '';
    }
    if ('details' in task && task.details) {
        body += "## Details\n".concat(task.details, "\n\n");
    }
    if ('testStrategy' in task && task.testStrategy) {
        body += "## Test Strategy\n".concat(task.testStrategy, "\n\n");
    }
    if ('dependencies' in task && ((_a = task.dependencies) === null || _a === void 0 ? void 0 : _a.length)) {
        // Intentionally empty, filled in later after issues are created
        body += "## Dependencies\n\n\n";
    }
    var meta = '';
    if ('status' in task && task.status) {
        meta += "- Status: `".concat(task.status, "`\n");
    }
    if ('priority' in task && task.priority) {
        meta += "- Priority: `".concat(task.priority, "`\n");
    }
    var complexity = complexityMap[idKey] || complexityMap[String(task.id)];
    if (complexity !== undefined) {
        meta += "- Complexity: `".concat(complexity, " / 10`\n");
    }
    if (parentIssue !== undefined) {
        meta += "- Parent Task: #".concat(parentIssue.number, "\n");
    }
    if ((_b = task.requiredBy) === null || _b === void 0 ? void 0 : _b.length) {
        // Intentially empty, filled in later after issues are created
        meta += "- Required By:\n\n";
    }
    if (meta) {
        body += "## Meta\n".concat(meta, "\n\n");
    }
    body += UNIQUE_MARKER;
    return body;
}
// Helper to find existing issue by title and marker
var allIssuesCache = [];
function findExistingIssue(title) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, githubApi.findExistingIssue(title, UNIQUE_MARKER)];
                case 1: 
                // Use enhanced API with better duplicate detection
                return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Helper to create enhanced issue title with priority ordering
function buildIssueTitle(task, parentTask) {
    var title;
    // Priority prefixes for ordering (high priority tasks appear first)
    var priorityPrefix = task.priority ?
        (task.priority.toLowerCase() === 'high' ? '[🔴 HIGH] ' :
            task.priority.toLowerCase() === 'medium' ? '[🟡 MED] ' :
                task.priority.toLowerCase() === 'low' ? '[🟢 LOW] ' : '') : '';
    if (typeof parentTask !== 'undefined' && 'id' in task) {
        title = "".concat(priorityPrefix, "[").concat(parentTask.id, ".").concat(task.id, "] ").concat(task.title);
    }
    else {
        title = "".concat(priorityPrefix, "[").concat(task.id, "] ").concat(task.title);
    }
    return title;
}
// Helper to create or get issue
function createOrGetIssue(task, parentTask, parentIssue) {
    return __awaiter(this, void 0, void 0, function () {
        var title, body, taskId, complexity, labels, existingIssue, createdIssue;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    title = buildIssueTitle(task, parentTask);
                    body = buildIssueBody(task, parentIssue);
                    taskId = parentTask ? "".concat(parentTask.id, ".").concat(task.id) : String(task.id);
                    complexity = complexityMap[taskId];
                    labels = generateIssueLabels(task, parentTask, complexity);
                    return [4 /*yield*/, findExistingIssue(title)];
                case 1:
                    existingIssue = _a.sent();
                    if (existingIssue) {
                        console.log("Issue already exists for: ".concat(title, " (#").concat(existingIssue.number, ")"));
                        return [2 /*return*/, __assign(__assign({}, existingIssue), { expectedBody: body })];
                    }
                    return [4 /*yield*/, githubApi.createIssue({
                            title: title,
                            body: body,
                            labels: labels,
                        })];
                case 2:
                    createdIssue = _a.sent();
                    allIssuesCache.push(createdIssue);
                    console.log("Created issue: ".concat(title, " (#").concat(createdIssue.number, ")"));
                    return [2 /*return*/, __assign(__assign({}, createdIssue), { expectedBody: body })];
            }
        });
    });
}
// Helper to add sub-issue (GitHub Projects/Tasks API)
function addSubIssue(parentIssue, subIssue) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (parentIssue.subIssues.some(function (s) { return s.id === subIssue.id; })) {
                        console.log("Sub-issue #".concat(subIssue.number, " is already a sub-issue of parent #").concat(parentIssue.number, "."));
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, githubApi.addSubIssue(parentIssue.number, subIssue.number)];
                case 2:
                    _a.sent();
                    parentIssue.subIssues.push(subIssue);
                    console.log("Added sub-issue #".concat(subIssue.number, " to parent #").concat(parentIssue.number, "."));
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.warn("Failed to add sub-issue relationship: ".concat((0, platform_utils_1.formatError)(error_1)));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Helper to update issue body with links to related issues
function updateBodyWithLinks(body, issues, sectionHeader, regex) {
    if (!(issues === null || issues === void 0 ? void 0 : issues.length))
        return body;
    var linkItems = issues.map(function (i) { return "- [".concat(i.state === 'closed' ? 'x' : ' ', "] #").concat(i.number); }).join('\n');
    var section = sectionHeader.includes('##')
        ? "".concat(sectionHeader, "\n").concat(linkItems, "\n\n")
        : "".concat(sectionHeader, "\n").concat(linkItems.split('\n').map(function (line) { return line ? "   ".concat(line) : line; }).join('\n'), "\n");
    return body.replace(regex, section);
}
// Helper to update issue with dependency links
function updateIssueWithDependencies(body, dependencyIssues) {
    return updateBodyWithLinks(body, dependencyIssues, '## Dependencies', /## Dependencies[\s\S]+?\n\n/);
}
// Helper to update issue with required-by links
function updateBodyWithRequiredBy(body, requiredByIssues) {
    return updateBodyWithLinks(body, requiredByIssues, '- Required By:', /- Required By:[\s\S]+?\n\n/);
}
function getSubIssues(issue) {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, githubApi.getSubIssues(issue.number)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_2 = _a.sent();
                    console.warn("Failed to fetch sub-issues for #".concat(issue.number, ": ").concat((0, platform_utils_1.formatError)(error_2)));
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Helper to update issue with dependencies, required-by links, and labels
function updateIssueWithDependenciesAndLabels(issue, task, parentTask, idToIssue, idempotencyManager) {
    return __awaiter(this, void 0, void 0, function () {
        var depIds, depIssues, reqByIds, reqByIssues, taskId, complexity, baseLabels, dependencyLabels, updatedLabels, needsUpdate;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    depIds = ((_a = task.dependencies) === null || _a === void 0 ? void 0 : _a.map(function (depId) {
                        return parentTask ? "".concat(parentTask.id, ".").concat(depId) : String(depId);
                    })) || [];
                    depIssues = depIds.map(function (depId) { return idToIssue[depId]; }).filter(Boolean);
                    issue.expectedBody = updateIssueWithDependencies(issue.expectedBody, depIssues);
                    reqByIds = ((_b = task.requiredBy) === null || _b === void 0 ? void 0 : _b.map(function (reqBy) {
                        return parentTask ? "".concat(parentTask.id, ".").concat(reqBy.id) : String(reqBy.id);
                    })) || [];
                    reqByIssues = reqByIds.map(function (reqById) { return idToIssue[reqById]; }).filter(Boolean);
                    issue.expectedBody = updateBodyWithRequiredBy(issue.expectedBody, reqByIssues);
                    taskId = parentTask ? "".concat(parentTask.id, ".").concat(task.id) : String(task.id);
                    complexity = complexityMap[taskId];
                    baseLabels = generateIssueLabels(task, parentTask, complexity);
                    dependencyLabels = updateDependencyLabels(task, depIssues);
                    updatedLabels = __spreadArray(__spreadArray([], baseLabels, true), dependencyLabels, true);
                    needsUpdate = issue.expectedBody !== issue.body;
                    if (!needsUpdate) return [3 /*break*/, 2];
                    return [4 /*yield*/, githubApi.updateIssue(issue.number, {
                            body: issue.expectedBody,
                            labels: updatedLabels,
                        })];
                case 1:
                    _c.sent();
                    console.log("Updated issue #".concat(issue.number, " with dependencies/required-bys and labels."));
                    // Record the update in idempotency state
                    idempotencyManager.recordIssueUpdate(issue.number, issue.expectedBody, updatedLabels);
                    _c.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var idempotencyManager, raw, data, tasks, taskGraphContent, prdState, summary, transactionId, contentHash, idToIssue, createdIssues, _loop_1, _i, tasks_1, task, _a, tasks_2, task, issue, _b, _c, sub, issue_1, summary, error_3;
        var _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    idempotencyManager = new idempotency_manager_1.IdempotencyManager();
                    raw = fs.readFileSync(TASKS_PATH, 'utf-8');
                    data = JSON.parse(raw);
                    tasks = data.master.tasks;
                    taskGraphContent = JSON.stringify(data, null, 2);
                    prdState = idempotencyManager.checkPrdState(taskGraphContent, TASKS_PATH);
                    console.log("\uD83D\uDCCA Idempotency Check: isProcessed=".concat(prdState.isProcessed, ", hasChanged=").concat(prdState.hasChanged));
                    // Skip processing if already completed and no changes
                    if (prdState.isProcessed && !prdState.hasChanged && ((_d = prdState.state) === null || _d === void 0 ? void 0 : _d.status) === 'completed') {
                        console.log('✅ Task graph already processed successfully, skipping...');
                        summary = idempotencyManager.getStateSummary();
                        console.log("\uD83D\uDCCA Current state: ".concat(summary.totalPrds, " PRDs, ").concat(summary.totalIssues, " issues tracked"));
                        return [2 /*return*/];
                    }
                    transactionId = idempotencyManager.beginTransaction();
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 14, 15, 16]);
                    // Record processing start
                    contentHash = idempotencyManager.recordPrdProcessingStart(taskGraphContent, TASKS_PATH, "task-graph-".concat(Date.now()));
                    console.log("\uD83D\uDD04 Starting processing with content hash: ".concat(contentHash.substring(0, 8), "..."));
                    idToIssue = {};
                    createdIssues = [];
                    _loop_1 = function (task) {
                        var baseIssue, parentIssue, _j, taskDependencies, _loop_2, _k, _l, sub;
                        var _m;
                        return __generator(this, function (_o) {
                            switch (_o.label) {
                                case 0:
                                    task.requiredBy = tasks.filter(function (t) { var _a; return (_a = t.dependencies) === null || _a === void 0 ? void 0 : _a.find(function (d) { return d === task.id; }); });
                                    return [4 /*yield*/, createOrGetIssue(task)];
                                case 1:
                                    baseIssue = _o.sent();
                                    _j = [__assign({}, baseIssue)];
                                    _m = {};
                                    return [4 /*yield*/, getSubIssues(baseIssue)];
                                case 2:
                                    parentIssue = __assign.apply(void 0, _j.concat([(_m.subIssues = _o.sent(), _m)]));
                                    idToIssue["".concat(task.id)] = parentIssue;
                                    taskDependencies = ((_e = task.dependencies) === null || _e === void 0 ? void 0 : _e.map(String)) || [];
                                    idempotencyManager.recordIssueCreation(parentIssue.number, String(task.id), contentHash, parentIssue.expectedBody, generateIssueLabels(task, undefined, complexityMap[String(task.id)]), taskDependencies);
                                    createdIssues.push(parentIssue.number);
                                    if (!task.subtasks) return [3 /*break*/, 6];
                                    _loop_2 = function (sub) {
                                        var subIssue, subId, subDependencies;
                                        return __generator(this, function (_p) {
                                            switch (_p.label) {
                                                case 0:
                                                    sub.requiredBy = (_f = task.subtasks) === null || _f === void 0 ? void 0 : _f.filter(function (t) { var _a; return (_a = t.dependencies) === null || _a === void 0 ? void 0 : _a.find(function (d) { return d === sub.id; }); });
                                                    return [4 /*yield*/, createOrGetIssue(sub, task, parentIssue)];
                                                case 1:
                                                    subIssue = _p.sent();
                                                    // Link subtask to parent task
                                                    return [4 /*yield*/, addSubIssue(parentIssue, subIssue)];
                                                case 2:
                                                    // Link subtask to parent task
                                                    _p.sent();
                                                    subId = "".concat(task.id, ".").concat(sub.id);
                                                    idToIssue[subId] = subIssue;
                                                    subDependencies = ((_g = sub.dependencies) === null || _g === void 0 ? void 0 : _g.map(function (depId) { return "".concat(task.id, ".").concat(depId); })) || [];
                                                    idempotencyManager.recordIssueCreation(subIssue.number, subId, contentHash, subIssue.expectedBody, generateIssueLabels(sub, task, complexityMap[subId]), subDependencies, String(task.id));
                                                    createdIssues.push(subIssue.number);
                                                    return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _k = 0, _l = task.subtasks;
                                    _o.label = 3;
                                case 3:
                                    if (!(_k < _l.length)) return [3 /*break*/, 6];
                                    sub = _l[_k];
                                    return [5 /*yield**/, _loop_2(sub)];
                                case 4:
                                    _o.sent();
                                    _o.label = 5;
                                case 5:
                                    _k++;
                                    return [3 /*break*/, 3];
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, tasks_1 = tasks;
                    _h.label = 2;
                case 2:
                    if (!(_i < tasks_1.length)) return [3 /*break*/, 5];
                    task = tasks_1[_i];
                    return [5 /*yield**/, _loop_1(task)];
                case 3:
                    _h.sent();
                    _h.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    _a = 0, tasks_2 = tasks;
                    _h.label = 6;
                case 6:
                    if (!(_a < tasks_2.length)) return [3 /*break*/, 12];
                    task = tasks_2[_a];
                    issue = idToIssue["".concat(task.id)];
                    return [4 /*yield*/, updateIssueWithDependenciesAndLabels(issue, task, undefined, idToIssue, idempotencyManager)];
                case 7:
                    _h.sent();
                    if (!task.subtasks) return [3 /*break*/, 11];
                    _b = 0, _c = task.subtasks;
                    _h.label = 8;
                case 8:
                    if (!(_b < _c.length)) return [3 /*break*/, 11];
                    sub = _c[_b];
                    issue_1 = idToIssue["".concat(task.id, ".").concat(sub.id)];
                    return [4 /*yield*/, updateIssueWithDependenciesAndLabels(issue_1, sub, task, idToIssue, idempotencyManager)];
                case 9:
                    _h.sent();
                    _h.label = 10;
                case 10:
                    _b++;
                    return [3 /*break*/, 8];
                case 11:
                    _a++;
                    return [3 /*break*/, 6];
                case 12:
                    console.log('All issues created and linked.');
                    // Wait for all pending API requests to complete
                    return [4 /*yield*/, githubApi.waitForCompletion()];
                case 13:
                    // Wait for all pending API requests to complete
                    _h.sent();
                    // Record successful completion
                    idempotencyManager.recordPrdProcessingComplete(contentHash, createdIssues);
                    // Commit transaction
                    idempotencyManager.commitTransaction();
                    console.log("\u2705 Successfully processed ".concat(createdIssues.length, " issues with idempotency tracking"));
                    summary = idempotencyManager.getStateSummary();
                    console.log("\uD83D\uDCCA Final state: ".concat(summary.totalPrds, " PRDs, ").concat(summary.totalIssues, " issues, ").concat(summary.processedPrds, " completed"));
                    return [3 /*break*/, 16];
                case 14:
                    error_3 = _h.sent();
                    console.error('❌ Error during processing:', error_3);
                    // Record failure and rollback transaction
                    if (contentHash) {
                        idempotencyManager.recordPrdProcessingFailure(contentHash, (0, platform_utils_1.formatError)(error_3));
                    }
                    // Rollback all operations
                    idempotencyManager.rollbackTransaction();
                    // Re-throw error for upstream handling
                    throw error_3;
                case 15:
                    // Clean up resources
                    githubApi.destroy();
                    // Clean up old transactions
                    idempotencyManager.cleanupOldTransactions();
                    return [7 /*endfinally*/];
                case 16: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) { return __awaiter(void 0, void 0, void 0, function () {
    var rateLimitStatus, rateLimitError_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.error('Error in main execution:', e);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, githubApi.getRateLimitStatus()];
            case 2:
                rateLimitStatus = _a.sent();
                console.error('Rate limit status:', rateLimitStatus);
                return [3 /*break*/, 4];
            case 3:
                rateLimitError_1 = _a.sent();
                console.error('Could not fetch rate limit status:', rateLimitError_1);
                return [3 /*break*/, 4];
            case 4:
                // Clean up resources
                githubApi.destroy();
                process.exit(1);
                return [2 /*return*/];
        }
    });
}); });
