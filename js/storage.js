/**
 * Storage Layer for TaskFlow
 * Handles all interactions with browser localStorage.
 * Includes fallback in-memory store, JSON parsing safety,
 * quota handling, and storage corruption detection.
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    TASKS: 'taskflow_tasks',
    ACTIVITIES: 'taskflow_activities',
    WORKSPACE: 'taskflow_active_workspace',
    INITIALIZED: 'taskflow_is_initialized'
  };

  // In-memory fallback if localStorage is blocked, private mode, or fails
  const memoryStore = {};
  let storageAvailable = true;
  let lastStorageError = null;
  const errorListeners = [];

  /**
   * Register a listener for storage warnings/errors
   */
  function onStorageError(callback) {
    if (typeof callback === 'function') {
      errorListeners.push(callback);
    }
  }

  function notifyStorageError(message, originalError) {
    lastStorageError = message;
    console.warn(`[TaskFlow Storage Warning]: ${message}`, originalError);
    errorListeners.forEach((listener) => {
      try {
        listener(message, originalError);
      } catch (e) {
        console.error('Error in storage error listener:', e);
      }
    });
  }

  /**
   * Check if localStorage is supported and accessible
   */
  function checkStorageAvailability() {
    try {
      const testKey = '__taskflow_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      storageAvailable = true;
      return true;
    } catch (e) {
      storageAvailable = false;
      notifyStorageError(
        'Browser local storage is not available or blocked. Changes will only persist during this session.',
        e
      );
      return false;
    }
  }

  // Initial check on load
  checkStorageAvailability();

  /**
   * Safely retrieve and parse an item from localStorage
   */
  function safeGet(key, defaultValue) {
    if (!storageAvailable) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key)
        ? memoryStore[key]
        : defaultValue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        return defaultValue;
      }
      return JSON.parse(raw);
    } catch (parseError) {
      notifyStorageError(
        `Corrupted storage detected for key "${key}". Restoring defaults to keep application stable.`,
        parseError
      );
      return defaultValue;
    }
  }

  /**
   * Safely serialize and save an item to localStorage
   */
  function safeSet(key, value) {
    if (!storageAvailable) {
      memoryStore[key] = value;
      return true;
    }

    try {
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (writeError) {
      // Could be QuotaExceededError or security restriction
      notifyStorageError(
        `Unable to save data to local storage (${writeError.name || 'Storage Error'}). Changes will remain in session memory.`,
        writeError
      );
      memoryStore[key] = value;
      return false;
    }
  }

  /**
   * Public TaskFlow Storage API
   */
  const Storage = {
    KEYS: STORAGE_KEYS,

    isAvailable() {
      return storageAvailable;
    },

    getLastError() {
      return lastStorageError;
    },

    onStorageError,

    isInitialized() {
      return safeGet(STORAGE_KEYS.INITIALIZED, false) === true;
    },

    setInitialized() {
      safeSet(STORAGE_KEYS.INITIALIZED, true);
    },

    getTasks() {
      const tasks = safeGet(STORAGE_KEYS.TASKS, null);
      return Array.isArray(tasks) ? tasks : null;
    },

    saveTasks(tasks) {
      if (!Array.isArray(tasks)) {
        console.error('saveTasks expects an array, received:', typeof tasks);
        return false;
      }
      return safeSet(STORAGE_KEYS.TASKS, tasks);
    },

    getActivities() {
      const activities = safeGet(STORAGE_KEYS.ACTIVITIES, null);
      return Array.isArray(activities) ? activities : null;
    },

    saveActivities(activities) {
      if (!Array.isArray(activities)) {
        console.error('saveActivities expects an array, received:', typeof activities);
        return false;
      }
      return safeSet(STORAGE_KEYS.ACTIVITIES, activities);
    },

    getActiveWorkspace(defaultWorkspace = 'personal') {
      const ws = safeGet(STORAGE_KEYS.WORKSPACE, defaultWorkspace);
      return ws === 'work' || ws === 'personal' ? ws : defaultWorkspace;
    },

    saveActiveWorkspace(workspaceId) {
      return safeSet(STORAGE_KEYS.WORKSPACE, workspaceId);
    },

    clearAllData() {
      try {
        if (storageAvailable) {
          window.localStorage.removeItem(STORAGE_KEYS.TASKS);
          window.localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
          window.localStorage.removeItem(STORAGE_KEYS.WORKSPACE);
          window.localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
        }
        delete memoryStore[STORAGE_KEYS.TASKS];
        delete memoryStore[STORAGE_KEYS.ACTIVITIES];
        delete memoryStore[STORAGE_KEYS.WORKSPACE];
        delete memoryStore[STORAGE_KEYS.INITIALIZED];
        return true;
      } catch (e) {
        console.error('Error clearing storage:', e);
        return false;
      }
    }
  };

  window.TaskFlowStorage = Storage;
})(window);
