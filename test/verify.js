/**
 * Automated Verification Script for TaskFlow
 * Tests all core domain functions, edge cases, validation,
 * overdue handling, localStorage corruption fallback, and filtering.
 */

// 1. Mock Browser Environment
const localStorageMock = (function () {
  let store = {};
  let failWrites = false;
  return {
    getItem: (key) => (store[key] !== undefined ? store[key] : null),
    setItem: (key, val) => {
      if (failWrites) throw new Error('QuotaExceededError');
      store[key] = String(val);
    },
    removeItem: (key) => delete store[key],
    clear: () => (store = {}),
    _setFailWrites: (val) => (failWrites = val),
    _rawStore: () => store
  };
})();

global.window = {
  localStorage: localStorageMock
};
global.localStorage = localStorageMock;

// Load app scripts
require('../js/storage.js');
require('../js/tasks.js');

const Storage = global.window.TaskFlowStorage;
const Domain = global.window.TaskFlowDomain;
const { TaskManager, getLocalTodayDate } = Domain;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('--- RUNNING TASKFLOW AUTOMATED TEST SUITE ---\n');

// TEST 1: Initial Default Seed Data
console.log('Test Group 1: Default Initialization & Workspace Separation');
const tm = new TaskManager(Storage);
const allTasks = tm.getAllTasks();
assert(allTasks.length === 6, 'Initial tasks seeded with exactly 6 tasks (3 Personal, 3 Work)');
assert(tm.getActiveWorkspaceId() === 'personal', 'Default workspace is "personal"');

const personalTasks = tm.getFilteredTasks({ workspaceId: 'personal' });
const workTasks = tm.getFilteredTasks({ workspaceId: 'work' });
assert(personalTasks.length === 3, 'Personal workspace has 3 initial tasks');
assert(workTasks.length === 3, 'Work workspace has 3 initial tasks');
assert(personalTasks.every(t => t.workspaceId === 'personal'), 'Personal tasks have workspaceId === "personal"');
assert(workTasks.every(t => t.workspaceId === 'work'), 'Work tasks have workspaceId === "work"');

// TEST 2: Activity Feed
console.log('\nTest Group 2: Activity Logging');
const activities = tm.getRecentActivities();
assert(activities.length === 5, 'Activity log maintains exactly latest 5 entries');
assert(activities[0].timestamp >= activities[4].timestamp, 'Activities are sorted newest first');
assert(activities.every(a => a.workspaceId && a.message), 'All activity logs contain workspaceId and human-readable message');

// TEST 3: Validation Edge Cases
console.log('\nTest Group 3: Form Validation');
const emptyRes = tm.createTask({
  title: '   ',
  description: '   ',
  dueDate: '',
  priority: '',
  status: ''
});
assert(emptyRes.success === false, 'Rejects empty / whitespace-only task');
assert(emptyRes.errors.title !== undefined, 'Errors contain title error');
assert(emptyRes.errors.description !== undefined, 'Errors contain description error');
assert(emptyRes.errors.dueDate !== undefined, 'Errors contain dueDate error');
assert(emptyRes.errors.priority !== undefined, 'Errors contain priority error');
assert(emptyRes.errors.status !== undefined, 'Errors contain status error');

// Past due date rejection on CREATE
const pastDateRes = tm.createTask({
  title: 'Test Past Date',
  description: 'Valid description',
  dueDate: '2020-01-01',
  priority: 'high',
  status: 'todo',
  workspaceId: 'personal'
});
assert(pastDateRes.success === false, 'Rejects past due date on new task creation');
assert(pastDateRes.errors.dueDate === 'Due date cannot be earlier than today.', 'Gives correct past due date error');

// Valid creation
const today = getLocalTodayDate();
const validCreate = tm.createTask({
  title: 'Finish Assignment Verification',
  description: 'Verify all criteria against project specifications.',
  dueDate: today,
  priority: 'high',
  status: 'todo',
  workspaceId: 'personal'
});
assert(validCreate.success === true, 'Successfully created valid task');
const createdTask = validCreate.task;
assert(createdTask.id.startsWith('task_'), 'Created task has unique ID');
assert(tm.getTaskById(createdTask.id) !== null, 'Task is retrievable by ID');

// Check that activity was logged for creation
const latestAct = tm.getRecentActivities()[0];
assert(latestAct.message === 'Finish Assignment Verification created', 'Activity logged: "Finish Assignment Verification created"');
assert(latestAct.workspaceId === 'personal', 'Activity labeled with "personal" workspace');

// TEST 4: Overdue Task Rules
console.log('\nTest Group 4: Overdue Task Behavior');
// Create a mock overdue task directly in array to test editing behavior
const mockOverdueTask = {
  id: 'task_overdue_test',
  workspaceId: 'personal',
  title: 'Old overdue task',
  description: 'This task was created in the past',
  dueDate: '2025-01-01',
  priority: 'medium',
  status: 'todo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
tm.tasks.push(mockOverdueTask);

assert(tm.isOverdue(mockOverdueTask) === true, 'Task before today is identified as overdue');

// Rule: allow editing other fields of an existing overdue task without forcing due date change!
const editOverdueWithoutDateChange = tm.updateTask(mockOverdueTask.id, {
  title: 'Old overdue task (Renamed)',
  description: 'Updated description without changing due date',
  dueDate: '2025-01-01', // kept same
  priority: 'high',
  status: 'in-progress',
  workspaceId: 'personal'
});
assert(
  editOverdueWithoutDateChange.success === true,
  'Allows editing overdue task when due date is kept unchanged'
);

// But if user attempts to change due date to another past date, reject!
const editOverdueToAnotherPastDate = tm.updateTask(mockOverdueTask.id, {
  title: 'Old overdue task',
  description: 'Updated description',
  dueDate: '2024-05-01', // changed to another past date
  priority: 'high',
  status: 'in-progress',
  workspaceId: 'personal'
});
assert(
  editOverdueToAnotherPastDate.success === false,
  'Rejects changing overdue task due date to another past date'
);

// If completed, task is NOT overdue
mockOverdueTask.status = 'done';
assert(tm.isOverdue(mockOverdueTask) === false, 'Completed ("done") task is not marked as overdue');

// TEST 5: Status Updates & Activity
console.log('\nTest Group 5: Status Updates');
const statusChangeRes = tm.updateTaskStatus(createdTask.id, 'done');
assert(statusChangeRes.success === true, 'Status updated successfully');
assert(createdTask.status === 'done', 'Task status is now done');
const statusAct = tm.getRecentActivities()[0];
assert(
  statusAct.message === 'Finish Assignment Verification marked as Done',
  'Status change logged: "Finish Assignment Verification marked as Done"'
);

// Status change to In Progress
tm.updateTaskStatus(createdTask.id, 'in-progress');
const progressAct = tm.getRecentActivities()[0];
assert(
  progressAct.message === 'Finish Assignment Verification moved to In Progress',
  'Status change logged: "Finish Assignment Verification moved to In Progress"'
);

// TEST 6: Search, Filters & Sorting
console.log('\nTest Group 6: Search, Filters & Sorting');
const searchByTitle = tm.getFilteredTasks({
  workspaceId: 'personal',
  search: 'ASSIGNMENT' // case-insensitive
});
assert(searchByTitle.length >= 1, 'Search finds task by title ignoring case');

const searchByDesc = tm.getFilteredTasks({
  workspaceId: 'personal',
  search: 'criteria' // in description
});
assert(searchByDesc.length >= 1, 'Search finds task by description');

const priorityFilter = tm.getFilteredTasks({
  workspaceId: 'personal',
  priority: 'high'
});
assert(priorityFilter.every(t => t.priority === 'high'), 'Priority filter returns only high priority tasks');

const statusFilter = tm.getFilteredTasks({
  workspaceId: 'personal',
  status: 'in-progress'
});
assert(statusFilter.every(t => t.status === 'in-progress'), 'Status filter returns only in-progress tasks');

// Due date sorting
const earliestSorted = tm.getFilteredTasks({
  workspaceId: 'personal',
  sortBy: 'earliest'
});
for (let i = 0; i < earliestSorted.length - 1; i++) {
  assert(
    earliestSorted[i].dueDate <= earliestSorted[i + 1].dueDate,
    `Earliest sort order preserved at index ${i}`
  );
}

const latestSorted = tm.getFilteredTasks({
  workspaceId: 'personal',
  sortBy: 'latest'
});
for (let i = 0; i < latestSorted.length - 1; i++) {
  assert(
    latestSorted[i].dueDate >= latestSorted[i + 1].dueDate,
    `Latest sort order preserved at index ${i}`
  );
}

// TEST 7: Delete & Deletion Persistence
console.log('\nTest Group 7: Delete & Persistence');
const deleteRes = tm.deleteTask(createdTask.id);
assert(deleteRes.success === true, 'Task deleted successfully');
assert(tm.getTaskById(createdTask.id) === null, 'Deleted task is no longer in task list');

const deleteAct = tm.getRecentActivities()[0];
assert(
  deleteAct.message === 'Finish Assignment Verification deleted',
  'Delete action logged in recent activity'
);

// Simulate Page Refresh
const reloadedTm = new TaskManager(Storage);
assert(reloadedTm.getTaskById(createdTask.id) === null, 'Deleted task stays deleted after refresh!');
assert(
  reloadedTm.getRecentActivities()[0].message === 'Finish Assignment Verification deleted',
  'Recent activities restored correctly after refresh'
);

// TEST 8: Storage Corruption / Fallback Recovery
console.log('\nTest Group 8: Storage Corruption & In-Memory Fallback');
let errorNotified = false;
Storage.onStorageError(() => {
  errorNotified = true;
});

// Corrupt localStorage JSON
localStorageMock.setItem(Storage.KEYS.TASKS, '{{invalid-json--');
const safeTasks = Storage.getTasks();
assert(safeTasks === null, 'Gracefully returns null/default on corrupted JSON without throwing');
assert(errorNotified === true, 'Storage error listener notified of corruption');

// Test Quota exceeded / unavailable storage fallback
localStorageMock._setFailWrites(true);
const fallbackSaveRes = Storage.saveTasks([{ id: 'fallback_1', title: 'Fallback Test' }]);
assert(fallbackSaveRes === false, 'Returns false on storage quota error without crashing');

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
