/**
 * Tasks & Domain Logic Layer for TaskFlow
 * Manages tasks collection, activity logs, validation rules,
 * filtering, sorting, and initial default seed data.
 */

(function (window) {
  'use strict';

  const WORKSPACES = [
    { id: 'personal', name: 'Personal', icon: '👤' },
    { id: 'work', name: 'Work', icon: '💼' }
  ];

  const PRIORITIES = {
    low: { id: 'low', label: 'Low', color: 'emerald' },
    medium: { id: 'medium', label: 'Medium', color: 'amber' },
    high: { id: 'high', label: 'High', color: 'rose' }
  };

  const STATUSES = {
    'todo': { id: 'todo', label: 'To Do', columnTitle: 'To Do' },
    'in-progress': { id: 'in-progress', label: 'In Progress', columnTitle: 'In Progress' },
    'done': { id: 'done', label: 'Done', columnTitle: 'Done' }
  };

  /**
   * Helper to get local date in YYYY-MM-DD format
   * Avoids UTC timezone shifts where late evenings flip to tomorrow in UTC.
   */
  function getLocalTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a local YYYY-MM-DD string to a readable date format
   */
  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        return dateObj.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  /**
   * Relative/friendly time for activity feed
   */
  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  }

  /**
   * Generates a unique, collision-resistant task ID
   */
  function generateId(prefix = 'task') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * TaskManager Class
   */
  class TaskManager {
    constructor(storage) {
      this.storage = storage;
      this.tasks = [];
      this.activities = [];
      this.activeWorkspaceId = 'personal';

      this.init();
    }

    /**
     * Initialize state from storage or seed defaults
     */
    init() {
      // 1. Restore active workspace
      this.activeWorkspaceId = this.storage.getActiveWorkspace('personal');

      // 2. Check if user data exists or first-time load
      const isInit = this.storage.isInitialized();
      const storedTasks = this.storage.getTasks();
      const storedActivities = this.storage.getActivities();

      if (!isInit || storedTasks === null) {
        // First run: seed defaults
        this.seedInitialData();
      } else {
        // Subsequent runs: restore exactly what is saved, even if empty array!
        this.tasks = Array.isArray(storedTasks) ? storedTasks : [];
        this.activities = Array.isArray(storedActivities) ? storedActivities : [];
      }
    }

    /**
     * Seeds initial tasks and activities when app is launched for the first time
     */
    seedInitialData() {
      const today = getLocalTodayDate();
      
      // Calculate sample offset dates
      const calcOffsetDate = (offsetDays) => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const now = new Date();
      const t1 = new Date(now.getTime() - 25 * 60000).toISOString();
      const t2 = new Date(now.getTime() - 15 * 60000).toISOString();
      const t3 = new Date(now.getTime() - 10 * 60000).toISOString();
      const t4 = new Date(now.getTime() - 5 * 60000).toISOString();
      const t5 = new Date(now.getTime() - 1 * 60000).toISOString();

      this.tasks = [
        // Work Workspace
        {
          id: generateId('task'),
          workspaceId: 'work',
          title: 'Implement drag-and-drop Kanban board',
          description: 'Add HTML5 drag and drop support across columns with persistent state updates and smooth visual transitions.',
          priority: 'high',
          status: 'in-progress',
          dueDate: calcOffsetDate(1),
          createdAt: t1,
          updatedAt: t2
        },
        {
          id: generateId('task'),
          workspaceId: 'work',
          title: 'Validate form inputs & timezone dates',
          description: 'Ensure trim checks for whitespace, reject past dates on creation, and preserve local date format without UTC skew.',
          priority: 'high',
          status: 'done',
          dueDate: calcOffsetDate(0),
          createdAt: t1,
          updatedAt: t3
        },
        {
          id: generateId('task'),
          workspaceId: 'work',
          title: 'Prepare assignment documentation & README',
          description: 'Document architectural decisions, local running instructions, and localStorage browser origin boundaries for interview evaluation.',
          priority: 'medium',
          status: 'todo',
          dueDate: calcOffsetDate(3),
          createdAt: t2,
          updatedAt: t2
        },
        // Personal Workspace
        {
          id: generateId('task'),
          workspaceId: 'personal',
          title: 'System design interview prep',
          description: 'Review distributed caching, database indexing strategies, and front-end state management patterns.',
          priority: 'high',
          status: 'in-progress',
          dueDate: calcOffsetDate(2),
          createdAt: t3,
          updatedAt: t4
        },
        {
          id: generateId('task'),
          workspaceId: 'personal',
          title: 'Update developer portfolio showcase',
          description: 'Showcase recent vanilla JavaScript projects, clean CSS architecture, and accessibility considerations.',
          priority: 'medium',
          status: 'todo',
          dueDate: calcOffsetDate(5),
          createdAt: t4,
          updatedAt: t4
        },
        {
          id: generateId('task'),
          workspaceId: 'personal',
          title: 'Register domain for side project',
          description: 'Purchase custom .dev domain and configure DNS records for the personal portfolio host.',
          priority: 'low',
          status: 'done',
          dueDate: calcOffsetDate(0),
          createdAt: t1,
          updatedAt: t5
        }
      ];

      this.activities = [
        {
          id: generateId('act'),
          taskTitle: 'Register domain for side project',
          message: 'Register domain for side project marked as Done',
          type: 'status',
          workspaceId: 'personal',
          timestamp: t5
        },
        {
          id: generateId('act'),
          taskTitle: 'System design interview prep',
          message: 'System design interview prep moved to In Progress',
          type: 'status',
          workspaceId: 'personal',
          timestamp: t4
        },
        {
          id: generateId('act'),
          taskTitle: 'Validate form inputs & timezone dates',
          message: 'Validate form inputs & timezone dates marked as Done',
          type: 'status',
          workspaceId: 'work',
          timestamp: t3
        },
        {
          id: generateId('act'),
          taskTitle: 'Implement drag-and-drop Kanban board',
          message: 'Implement drag-and-drop Kanban board moved to In Progress',
          type: 'status',
          workspaceId: 'work',
          timestamp: t2
        },
        {
          id: generateId('act'),
          taskTitle: 'Prepare assignment documentation & README',
          message: 'Prepare assignment documentation & README created',
          type: 'create',
          workspaceId: 'work',
          timestamp: t1
        }
      ];

      this.storage.saveTasks(this.tasks);
      this.storage.saveActivities(this.activities);
      this.storage.setInitialized();
    }

    /**
     * Persist current state
     */
    saveTasksToStorage() {
      return this.storage.saveTasks(this.tasks);
    }

    saveActivitiesToStorage() {
      return this.storage.saveActivities(this.activities);
    }

    /**
     * Workspace Management
     */
    getWorkspaces() {
      return WORKSPACES;
    }

    getActiveWorkspaceId() {
      return this.activeWorkspaceId;
    }

    setActiveWorkspaceId(workspaceId) {
      if (WORKSPACES.some((w) => w.id === workspaceId)) {
        this.activeWorkspaceId = workspaceId;
        this.storage.saveActiveWorkspace(workspaceId);
        return true;
      }
      return false;
    }

    getWorkspaceName(workspaceId) {
      const ws = WORKSPACES.find((w) => w.id === workspaceId);
      return ws ? ws.name : workspaceId;
    }

    /**
     * Validation Logic
     * @param {Object} data - Raw task input fields
     * @param {Object|null} existingTask - If updating, existing task instance
     * @returns {Object} { isValid: boolean, errors: Object, cleanData: Object }
     */
    validateTask(data, existingTask = null) {
      const errors = {};
      const cleanData = {};
      const today = getLocalTodayDate();

      // 1. Title validation
      const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
      if (!rawTitle) {
        errors.title = 'Title is required and cannot be empty or whitespace only.';
      } else if (rawTitle.length > 120) {
        errors.title = 'Title must be 120 characters or fewer.';
      } else {
        cleanData.title = rawTitle;
      }

      // 2. Description validation
      const rawDescription = typeof data.description === 'string' ? data.description.trim() : '';
      if (!rawDescription) {
        errors.description = 'Description is required and cannot be empty or whitespace only.';
      } else if (rawDescription.length > 2000) {
        errors.description = 'Description must be 2000 characters or fewer.';
      } else {
        cleanData.description = rawDescription;
      }

      // 3. Workspace validation
      const rawWorkspace = data.workspaceId || this.activeWorkspaceId;
      if (!WORKSPACES.some((w) => w.id === rawWorkspace)) {
        errors.workspaceId = 'Please select a valid workspace.';
      } else {
        cleanData.workspaceId = rawWorkspace;
      }

      // 4. Priority validation
      const rawPriority = data.priority;
      if (!PRIORITIES[rawPriority]) {
        errors.priority = 'Priority is required. Please choose Low, Medium, or High.';
      } else {
        cleanData.priority = rawPriority;
      }

      // 5. Status validation
      const rawStatus = data.status;
      if (!STATUSES[rawStatus]) {
        errors.status = 'Status is required. Please choose To Do, In Progress, or Done.';
      } else {
        cleanData.status = rawStatus;
      }

      // 6. Due date validation
      const rawDueDate = typeof data.dueDate === 'string' ? data.dueDate.trim() : '';
      if (!rawDueDate) {
        errors.dueDate = 'Due date is required.';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)) {
        errors.dueDate = 'Due date must be in YYYY-MM-DD format.';
      } else {
        // Past date check
        const isEditing = existingTask !== null;
        const dueDateChanged = isEditing ? rawDueDate !== existingTask.dueDate : true;

        if (dueDateChanged && rawDueDate < today) {
          errors.dueDate = 'Due date cannot be earlier than today.';
        } else {
          cleanData.dueDate = rawDueDate;
        }
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        cleanData
      };
    }

    /**
     * Check if a task is overdue
     */
    isOverdue(task) {
      if (!task || task.status === 'done' || !task.dueDate) {
        return false;
      }
      return task.dueDate < getLocalTodayDate();
    }

    /**
     * Activity Feed Logging
     * Keeps newest 5 actions across both workspaces
     */
    logActivity({ taskTitle, message, type, workspaceId }) {
      const newActivity = {
        id: generateId('act'),
        taskTitle,
        message,
        type, // 'create' | 'edit' | 'delete' | 'status'
        workspaceId,
        timestamp: new Date().toISOString()
      };

      // Add to front, keep latest 5 actions
      this.activities.unshift(newActivity);
      if (this.activities.length > 5) {
        this.activities = this.activities.slice(0, 5);
      }

      this.saveActivitiesToStorage();
      return newActivity;
    }

    getRecentActivities() {
      return [...this.activities];
    }

    /**
     * CRUD Task Operations
     */
    getTaskById(id) {
      return this.tasks.find((t) => t.id === id) || null;
    }

    getAllTasks() {
      return [...this.tasks];
    }

    createTask(rawInput) {
      const validation = this.validateTask(rawInput, null);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      const nowIso = new Date().toISOString();
      const newTask = {
        id: generateId('task'),
        workspaceId: validation.cleanData.workspaceId,
        title: validation.cleanData.title,
        description: validation.cleanData.description,
        priority: validation.cleanData.priority,
        status: validation.cleanData.status,
        dueDate: validation.cleanData.dueDate,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      this.tasks.push(newTask);
      this.saveTasksToStorage();

      this.logActivity({
        taskTitle: newTask.title,
        message: `${newTask.title} created`,
        type: 'create',
        workspaceId: newTask.workspaceId
      });

      return { success: true, task: newTask };
    }

    updateTask(id, rawInput) {
      const existingIndex = this.tasks.findIndex((t) => t.id === id);
      if (existingIndex === -1) {
        return { success: false, errors: { general: 'Task not found.' } };
      }

      const existingTask = this.tasks[existingIndex];
      const validation = this.validateTask(rawInput, existingTask);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      const oldStatus = existingTask.status;
      const newStatus = validation.cleanData.status;
      const statusChanged = oldStatus !== newStatus;

      const updatedTask = {
        ...existingTask,
        workspaceId: validation.cleanData.workspaceId,
        title: validation.cleanData.title,
        description: validation.cleanData.description,
        priority: validation.cleanData.priority,
        status: newStatus,
        dueDate: validation.cleanData.dueDate,
        updatedAt: new Date().toISOString()
      };

      this.tasks[existingIndex] = updatedTask;
      this.saveTasksToStorage();

      // Log activity
      if (statusChanged) {
        const statusLabel = STATUSES[newStatus]?.label || newStatus;
        const msg = newStatus === 'done'
          ? `${updatedTask.title} marked as Done`
          : `${updatedTask.title} moved to ${statusLabel}`;
        this.logActivity({
          taskTitle: updatedTask.title,
          message: msg,
          type: 'status',
          workspaceId: updatedTask.workspaceId
        });
      } else {
        this.logActivity({
          taskTitle: updatedTask.title,
          message: `${updatedTask.title} updated`,
          type: 'edit',
          workspaceId: updatedTask.workspaceId
        });
      }

      return { success: true, task: updatedTask };
    }

    updateTaskStatus(id, newStatus) {
      if (!STATUSES[newStatus]) {
        return { success: false, error: 'Invalid status value.' };
      }

      const task = this.getTaskById(id);
      if (!task) {
        return { success: false, error: 'Task not found.' };
      }

      if (task.status === newStatus) {
        return { success: true, task }; // No change needed
      }

      task.status = newStatus;
      task.updatedAt = new Date().toISOString();
      this.saveTasksToStorage();

      const statusLabel = STATUSES[newStatus]?.label || newStatus;
      const msg = newStatus === 'done'
        ? `${task.title} marked as Done`
        : `${task.title} moved to ${statusLabel}`;

      this.logActivity({
        taskTitle: task.title,
        message: msg,
        type: 'status',
        workspaceId: task.workspaceId
      });

      return { success: true, task };
    }

    deleteTask(id) {
      const existingIndex = this.tasks.findIndex((t) => t.id === id);
      if (existingIndex === -1) {
        return { success: false, error: 'Task not found.' };
      }

      const [removedTask] = this.tasks.splice(existingIndex, 1);
      this.saveTasksToStorage();

      this.logActivity({
        taskTitle: removedTask.title,
        message: `${removedTask.title} deleted`,
        type: 'delete',
        workspaceId: removedTask.workspaceId
      });

      return { success: true, task: removedTask };
    }

    /**
     * Filter & Sort Tasks within active workspace
     * @param {Object} options
     *   - workspaceId: string
     *   - search: string (case-insensitive title or description)
     *   - status: 'all' | 'todo' | 'in-progress' | 'done'
     *   - priority: 'all' | 'low' | 'medium' | 'high'
     *   - sortBy: 'earliest' | 'latest'
     */
    getFilteredTasks({
      workspaceId = this.activeWorkspaceId,
      search = '',
      status = 'all',
      priority = 'all',
      sortBy = 'earliest'
    } = {}) {
      const normalizedSearch = search.trim().toLowerCase();

      // 1. Workspace filter
      let result = this.tasks.filter((task) => task.workspaceId === workspaceId);

      // 2. Search filter (title & description, case-insensitive)
      if (normalizedSearch) {
        result = result.filter((task) => {
          const titleMatch = (task.title || '').toLowerCase().includes(normalizedSearch);
          const descMatch = (task.description || '').toLowerCase().includes(normalizedSearch);
          return titleMatch || descMatch;
        });
      }

      // 3. Status filter
      if (status && status !== 'all') {
        result = result.filter((task) => task.status === status);
      }

      // 4. Priority filter
      if (priority && priority !== 'all') {
        result = result.filter((task) => task.priority === priority);
      }

      // 5. Due date sorting (earliest first vs latest first)
      result.sort((a, b) => {
        const dateA = a.dueDate || '';
        const dateB = b.dueDate || '';

        let cmp = 0;
        if (sortBy === 'latest') {
          cmp = dateB.localeCompare(dateA);
        } else {
          // 'earliest' default
          cmp = dateA.localeCompare(dateB);
        }

        // Secondary stable sort by createdAt
        if (cmp === 0) {
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        return cmp;
      });

      return result;
    }
  }

  // Export to window
  window.TaskFlowDomain = {
    WORKSPACES,
    PRIORITIES,
    STATUSES,
    getLocalTodayDate,
    formatDisplayDate,
    formatRelativeTime,
    TaskManager
  };
})(window);
