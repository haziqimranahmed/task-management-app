/**
 * Application Orchestrator for TaskFlow
 * Initializes application modules, binds event listeners,
 * coordinates Kanban board filtering, drag-and-drop,
 * and user interactions.
 */

(document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const Storage = window.TaskFlowStorage;
  const Domain = window.TaskFlowDomain;
  const UIClass = window.TaskFlowUI;

  // Initialize Core Services
  const taskManager = new Domain.TaskManager(Storage);
  const ui = new UIClass();

  // Active Filter & Sort State
  const filterState = {
    search: '',
    status: 'all',
    priority: 'all',
    sortBy: 'earliest' // 'earliest' | 'latest'
  };

  /**
   * Calculate task counts per workspace for badges
   */
  function getWorkspaceTaskCounts() {
    const all = taskManager.getAllTasks();
    const counts = {};
    Domain.WORKSPACES.forEach((ws) => {
      counts[ws.id] = all.filter((t) => t.workspaceId === ws.id).length;
    });
    return counts;
  }

  /**
   * Main render function - keeps all views in sync
   */
  function renderApp() {
    const activeWs = taskManager.getActiveWorkspaceId();

    // 1. Workspace Tabs & Badge
    ui.renderWorkspaceTabs(
      Domain.WORKSPACES,
      activeWs,
      getWorkspaceTaskCounts()
    );

    // 2. Filter & Sort Tasks for active workspace
    const filteredTasks = taskManager.getFilteredTasks({
      workspaceId: activeWs,
      search: filterState.search,
      status: filterState.status,
      priority: filterState.priority,
      sortBy: filterState.sortBy
    });

    // 3. Bucket tasks into status columns
    const columnTasks = {
      'todo': [],
      'in-progress': [],
      'done': []
    };

    filteredTasks.forEach((task) => {
      if (columnTasks[task.status]) {
        columnTasks[task.status].push(task);
      }
    });

    const hasActiveFilters = Boolean(
      filterState.search ||
      filterState.status !== 'all' ||
      filterState.priority !== 'all'
    );

    // 4. Render Kanban Board
    ui.renderBoard(
      columnTasks,
      hasActiveFilters,
      (task) => taskManager.isOverdue(task)
    );

    // 5. Render Activity Feeds (Sidebar & Mobile Collapsible)
    ui.renderActivities(
      taskManager.getRecentActivities(),
      (wsId) => taskManager.getWorkspaceName(wsId)
    );

    // 6. Update Filter Summary / Clear Button state
    if (ui.dom.clearFiltersBtn) {
      if (hasActiveFilters || filterState.sortBy !== 'earliest') {
        ui.dom.clearFiltersBtn.classList.remove('hidden');
      } else {
        ui.dom.clearFiltersBtn.classList.add('hidden');
      }
    }
  }

  /**
   * Wire UI Event Listeners
   */
  function bindEventListeners() {
    // 1. Storage error banner listener
    Storage.onStorageError((message) => {
      ui.showStorageAlert(message);
    });

    // Dismiss banner button
    const alertDismissBtn = document.getElementById('storage-alert-dismiss');
    if (alertDismissBtn) {
      alertDismissBtn.addEventListener('click', () => {
        ui.hideStorageAlert();
      });
    }

    // 2. Workspace Navigation Switch
    if (ui.dom.workspaceTabs) {
      ui.dom.workspaceTabs.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.workspace-tab');
        if (!tabBtn) return;

        const targetWsId = tabBtn.getAttribute('data-workspace-id');
        if (targetWsId && targetWsId !== taskManager.getActiveWorkspaceId()) {
          taskManager.setActiveWorkspaceId(targetWsId);
          renderApp();
          ui.showToast(`Switched to ${taskManager.getWorkspaceName(targetWsId)} workspace`, 'info');
        }
      });
    }

    // 3. Search input (instant real-time filter)
    if (ui.dom.searchInput) {
      ui.dom.searchInput.addEventListener('input', (e) => {
        filterState.search = e.target.value;
        renderApp();
      });
    }

    // 4. Status filter select
    if (ui.dom.statusFilter) {
      ui.dom.statusFilter.addEventListener('change', (e) => {
        filterState.status = e.target.value;
        renderApp();
      });
    }

    // 5. Priority filter select
    if (ui.dom.priorityFilter) {
      ui.dom.priorityFilter.addEventListener('change', (e) => {
        filterState.priority = e.target.value;
        renderApp();
      });
    }

    // 6. Sort Select
    if (ui.dom.sortSelect) {
      ui.dom.sortSelect.addEventListener('change', (e) => {
        filterState.sortBy = e.target.value;
        renderApp();
      });
    }

    // 7. Clear Filters Button
    if (ui.dom.clearFiltersBtn) {
      ui.dom.clearFiltersBtn.addEventListener('click', () => {
        filterState.search = '';
        filterState.status = 'all';
        filterState.priority = 'all';
        filterState.sortBy = 'earliest';

        if (ui.dom.searchInput) ui.dom.searchInput.value = '';
        if (ui.dom.statusFilter) ui.dom.statusFilter.value = 'all';
        if (ui.dom.priorityFilter) ui.dom.priorityFilter.value = 'all';
        if (ui.dom.sortSelect) ui.dom.sortSelect.value = 'earliest';

        renderApp();
        ui.showToast('All filters reset', 'info');
      });
    }

    // 8. Open Create Task Modal
    if (ui.dom.openCreateModalBtn) {
      ui.dom.openCreateModalBtn.addEventListener('click', () => {
        ui.openTaskModal({
          isEdit: false,
          defaultWorkspace: taskManager.getActiveWorkspaceId(),
          triggerElement: ui.dom.openCreateModalBtn,
          todayDateStr: Domain.getLocalTodayDate()
        });
      });
    }

    // 9. Task Form Submit (Create / Edit)
    if (ui.dom.taskForm) {
      ui.dom.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const taskId = ui.dom.taskIdInput.value.trim();
        const isEdit = Boolean(taskId);

        const formData = {
          workspaceId: ui.dom.taskWorkspaceInput.value,
          title: ui.dom.taskTitleInput.value,
          priority: ui.dom.taskPriorityInput.value,
          status: ui.dom.taskStatusInput.value,
          dueDate: ui.dom.taskDueDateInput.value,
          description: ui.dom.taskDescriptionInput.value
        };

        if (isEdit) {
          const result = taskManager.updateTask(taskId, formData);
          if (!result.success) {
            ui.showFormErrors(result.errors);
            return;
          }
          ui.closeModal(ui.dom.taskModal);
          renderApp();
          ui.showToast('Task updated successfully', 'success');

          // If details modal was open for this task, refresh it
          if (ui.currentDetailsTaskId === taskId && !ui.dom.detailsModal.classList.contains('hidden')) {
            const updated = taskManager.getTaskById(taskId);
            ui.openDetailsModal(
              updated,
              taskManager.isOverdue(updated),
              (wsId) => taskManager.getWorkspaceName(wsId)
            );
          }
        } else {
          const result = taskManager.createTask(formData);
          if (!result.success) {
            ui.showFormErrors(result.errors);
            return;
          }
          ui.closeModal(ui.dom.taskModal);
          renderApp();
          ui.showToast('Task created successfully', 'success');
        }
      });
    }

    // Task Form Cancel & Close
    if (ui.dom.taskCancelBtn) {
      ui.dom.taskCancelBtn.addEventListener('click', () => {
        ui.closeModal(ui.dom.taskModal);
      });
    }
    if (ui.dom.taskCloseBtn) {
      ui.dom.taskCloseBtn.addEventListener('click', () => {
        ui.closeModal(ui.dom.taskModal);
      });
    }

    // 10. Kanban Board Delegated Clicks (View, Edit, Delete, Quick Move)
    if (ui.dom.kanbanBoard) {
      ui.dom.kanbanBoard.addEventListener('click', (e) => {
        const target = e.target;

        // View Details
        const viewBtn = target.closest('.btn-view-task');
        if (viewBtn) {
          const taskId = viewBtn.getAttribute('data-task-id');
          const task = taskManager.getTaskById(taskId);
          if (task) {
            ui.openDetailsModal(
              task,
              taskManager.isOverdue(task),
              (wsId) => taskManager.getWorkspaceName(wsId),
              viewBtn
            );
          }
          return;
        }

        // Edit Task
        const editBtn = target.closest('.btn-edit-task');
        if (editBtn) {
          const taskId = editBtn.getAttribute('data-task-id');
          const task = taskManager.getTaskById(taskId);
          if (task) {
            ui.openTaskModal({
              isEdit: true,
              task,
              triggerElement: editBtn,
              todayDateStr: Domain.getLocalTodayDate()
            });
          }
          return;
        }

        // Delete Task (Open confirmation modal)
        const deleteBtn = target.closest('.btn-delete-task');
        if (deleteBtn) {
          const taskId = deleteBtn.getAttribute('data-task-id');
          const task = taskManager.getTaskById(taskId);
          if (task) {
            ui.openDeleteModal(task, deleteBtn);
          }
          return;
        }
      });

      // Quick Move Dropdown change (Accessible status change for keyboard/mobile)
      ui.dom.kanbanBoard.addEventListener('change', (e) => {
        const select = e.target.closest('.status-quick-select');
        if (select) {
          const taskId = select.getAttribute('data-task-id');
          const newStatus = select.value;
          const result = taskManager.updateTaskStatus(taskId, newStatus);
          if (result.success) {
            renderApp();
            ui.showToast(`Task status updated to ${Domain.STATUSES[newStatus]?.label || newStatus}`, 'success');
          }
        }
      });
    }

    // 11. Details Modal Actions (Edit, Delete, Close)
    if (ui.dom.detailsCloseBtn) {
      ui.dom.detailsCloseBtn.addEventListener('click', () => {
        ui.closeModal(ui.dom.detailsModal);
      });
    }

    if (ui.dom.detailsEditBtn) {
      ui.dom.detailsEditBtn.addEventListener('click', () => {
        const taskId = ui.dom.detailsEditBtn.getAttribute('data-task-id');
        const task = taskManager.getTaskById(taskId);
        if (task) {
          ui.closeModal(ui.dom.detailsModal, false);
          ui.openTaskModal({
            isEdit: true,
            task,
            triggerElement: ui.dom.detailsEditBtn,
            todayDateStr: Domain.getLocalTodayDate()
          });
        }
      });
    }

    if (ui.dom.detailsDeleteBtn) {
      ui.dom.detailsDeleteBtn.addEventListener('click', () => {
        const taskId = ui.dom.detailsDeleteBtn.getAttribute('data-task-id');
        const task = taskManager.getTaskById(taskId);
        if (task) {
          ui.closeModal(ui.dom.detailsModal, false);
          ui.openDeleteModal(task, ui.dom.detailsDeleteBtn);
        }
      });
    }

    // 12. Delete Confirmation Modal Actions
    if (ui.dom.deleteConfirmBtn) {
      ui.dom.deleteConfirmBtn.addEventListener('click', () => {
        const taskId = ui.pendingDeleteTaskId;
        if (taskId) {
          const res = taskManager.deleteTask(taskId);
          ui.closeModal(ui.dom.deleteModal);
          renderApp();
          if (res.success) {
            ui.showToast('Task deleted successfully', 'success');
          }
        }
      });
    }

    if (ui.dom.deleteCancelBtn) {
      ui.dom.deleteCancelBtn.addEventListener('click', () => {
        ui.closeModal(ui.dom.deleteModal);
      });
    }
    if (ui.dom.deleteCloseBtn) {
      ui.dom.deleteCloseBtn.addEventListener('click', () => {
        ui.closeModal(ui.dom.deleteModal);
      });
    }

    // 13. Mobile Activity Panel Toggle
    if (ui.dom.mobileActivityToggle && ui.dom.mobileActivityPanel) {
      ui.dom.mobileActivityToggle.addEventListener('click', () => {
        const isExpanded = ui.dom.mobileActivityToggle.getAttribute('aria-expanded') === 'true';
        ui.dom.mobileActivityToggle.setAttribute('aria-expanded', !isExpanded);
        ui.dom.mobileActivityPanel.classList.toggle('is-open', !isExpanded);
      });
    }

    // 14. HTML5 Drag and Drop Support
    initDragAndDrop();
  }

  /**
   * HTML5 Drag and Drop Kanban Implementation
   */
  function initDragAndDrop() {
    let draggedTaskId = null;

    // Attach listeners on board container using event delegation
    if (!ui.dom.kanbanBoard) return;

    // Drag Start
    ui.dom.kanbanBoard.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;

      draggedTaskId = card.getAttribute('data-task-id');
      card.classList.add('is-dragging');

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
      }
    });

    // Drag End
    ui.dom.kanbanBoard.addEventListener('dragend', (e) => {
      const card = e.target.closest('.task-card');
      if (card) {
        card.classList.remove('is-dragging');
      }
      draggedTaskId = null;

      // Clean up drag-over classes
      document.querySelectorAll('.kanban-column').forEach((col) => {
        col.classList.remove('drag-over');
      });
    });

    // Setup column drop zones
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', (e) => {
        // Prevent flickering when hovering over child elements
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('drag-over');
        }
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const taskId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : draggedTaskId;
        const targetStatus = col.getAttribute('data-status');

        if (taskId && targetStatus) {
          const task = taskManager.getTaskById(taskId);
          if (task && task.status !== targetStatus) {
            const res = taskManager.updateTaskStatus(taskId, targetStatus);
            if (res.success) {
              renderApp();
              ui.showToast(
                `Moved to ${Domain.STATUSES[targetStatus]?.label || targetStatus}`,
                'success'
              );
            }
          }
        }
      });
    });
  }

  // Bind Events & Initial Render
  bindEventListeners();
  renderApp();
}));
