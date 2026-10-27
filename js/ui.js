/**
 * UI & Rendering Layer for TaskFlow
 * Manages DOM manipulation, modals, Kanban columns,
 * accessibility (focus trapping, keyboard navigation),
 * and XSS-safe text rendering.
 */

(function (window) {
  'use strict';

  const { WORKSPACES, PRIORITIES, STATUSES, formatDisplayDate, formatRelativeTime } =
    window.TaskFlowDomain;

  class TaskFlowUI {
    constructor() {
      // DOM Elements Cache
      this.dom = {
        appContainer: document.getElementById('app-container'),
        workspaceTabs: document.getElementById('workspace-tabs'),
        activeWorkspaceBadge: document.getElementById('active-workspace-badge'),
        searchInput: document.getElementById('search-input'),
        statusFilter: document.getElementById('status-filter'),
        priorityFilter: document.getElementById('priority-filter'),
        sortSelect: document.getElementById('sort-select'),
        clearFiltersBtn: document.getElementById('clear-filters-btn'),
        filterSummary: document.getElementById('filter-summary'),
        kanbanBoard: document.getElementById('kanban-board'),
        columns: {
          'todo': document.getElementById('col-tasks-todo'),
          'in-progress': document.getElementById('col-tasks-in-progress'),
          'done': document.getElementById('col-tasks-done')
        },
        columnCounts: {
          'todo': document.getElementById('count-todo'),
          'in-progress': document.getElementById('count-in-progress'),
          'done': document.getElementById('count-done')
        },
        emptyStates: {
          'todo': document.getElementById('empty-todo'),
          'in-progress': document.getElementById('empty-in-progress'),
          'done': document.getElementById('empty-done')
        },
        openCreateModalBtn: document.getElementById('open-create-task-btn'),
        
        // Activity Feeds
        desktopActivityList: document.getElementById('desktop-activity-list'),
        mobileActivityList: document.getElementById('mobile-activity-list'),
        mobileActivityToggle: document.getElementById('mobile-activity-toggle'),
        mobileActivityPanel: document.getElementById('mobile-activity-panel'),
        mobileActivityBadge: document.getElementById('mobile-activity-badge'),

        // Modals
        taskModal: document.getElementById('task-modal'),
        taskModalTitle: document.getElementById('task-modal-title'),
        taskForm: document.getElementById('task-form'),
        taskIdInput: document.getElementById('task-id-input'),
        taskWorkspaceInput: document.getElementById('task-workspace-input'),
        taskTitleInput: document.getElementById('task-title-input'),
        taskPriorityInput: document.getElementById('task-priority-input'),
        taskStatusInput: document.getElementById('task-status-input'),
        taskDueDateInput: document.getElementById('task-due-date-input'),
        taskDescriptionInput: document.getElementById('task-description-input'),
        taskCancelBtn: document.getElementById('task-cancel-btn'),
        taskCloseBtn: document.getElementById('task-modal-close-btn'),

        // Details Modal
        detailsModal: document.getElementById('details-modal'),
        detailsCloseBtn: document.getElementById('details-modal-close-btn'),
        detailsTitle: document.getElementById('details-title'),
        detailsWorkspace: document.getElementById('details-workspace'),
        detailsStatus: document.getElementById('details-status'),
        detailsPriority: document.getElementById('details-priority'),
        detailsDueDate: document.getElementById('details-due-date'),
        detailsOverdueBadge: document.getElementById('details-overdue-badge'),
        detailsDescription: document.getElementById('details-description'),
        detailsCreated: document.getElementById('details-created'),
        detailsUpdated: document.getElementById('details-updated'),
        detailsEditBtn: document.getElementById('details-edit-btn'),
        detailsDeleteBtn: document.getElementById('details-delete-btn'),

        // Confirm Delete Modal
        deleteModal: document.getElementById('delete-modal'),
        deleteTaskName: document.getElementById('delete-task-name'),
        deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
        deleteCancelBtn: document.getElementById('delete-cancel-btn'),
        deleteCloseBtn: document.getElementById('delete-modal-close-btn'),

        // Alerts / Banner
        storageAlertBanner: document.getElementById('storage-alert-banner'),
        storageAlertMessage: document.getElementById('storage-alert-message'),
        toastContainer: document.getElementById('toast-container')
      };

      // Modal focus management tracking
      this.lastFocusedElement = null;
      this.activeModal = null;
      this.currentDetailsTaskId = null;
      this.pendingDeleteTaskId = null;

      this.initModalA11y();
    }

    /**
     * Escape key handler & focus trapping for accessibility
     */
    initModalA11y() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.activeModal) {
          this.closeAllModals();
        }

        // Trap focus inside modal
        if (e.key === 'Tab' && this.activeModal) {
          const focusable = this.activeModal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;

          const firstElem = focusable[0];
          const lastElem = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElem) {
              e.preventDefault();
              lastElem.focus();
            }
          } else {
            if (document.activeElement === lastElem) {
              e.preventDefault();
              firstElem.focus();
            }
          }
        }
      });
    }

    /**
     * Open a modal dialog with accessibility attributes
     */
    openModal(modalElement, triggerElement = null) {
      if (this.activeModal && this.activeModal !== modalElement) {
        this.closeModal(this.activeModal, false);
      }

      this.lastFocusedElement = triggerElement || document.activeElement;
      this.activeModal = modalElement;

      modalElement.classList.remove('hidden');
      modalElement.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');

      // Focus first interactive control in modal
      const firstFocusable = modalElement.querySelector(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 50);
      }
    }

    /**
     * Close modal dialog and restore focus to trigger
     */
    closeModal(modalElement, restoreFocus = true) {
      if (!modalElement) return;

      modalElement.classList.add('hidden');
      modalElement.setAttribute('aria-hidden', 'true');
      this.activeModal = null;
      document.body.classList.remove('modal-open');

      if (restoreFocus && this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
    }

    closeAllModals() {
      [this.dom.taskModal, this.dom.detailsModal, this.dom.deleteModal].forEach((modal) => {
        if (modal && !modal.classList.contains('hidden')) {
          this.closeModal(modal, true);
        }
      });
    }

    /**
     * Workspace Navigation Rendering
     */
    renderWorkspaceTabs(workspaces, activeId, taskCountsByWorkspace = {}) {
      if (!this.dom.workspaceTabs) return;
      this.dom.workspaceTabs.innerHTML = '';

      workspaces.forEach((ws) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `workspace-tab ${ws.id === activeId ? 'active' : ''}`;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', ws.id === activeId ? 'true' : 'false');
        btn.setAttribute('data-workspace-id', ws.id);

        const count = taskCountsByWorkspace[ws.id] || 0;

        btn.innerHTML = `
          <span class="ws-icon" aria-hidden="true">${ws.icon}</span>
          <span class="ws-name">${this.escapeHtml(ws.name)}</span>
          <span class="ws-badge" aria-label="${count} tasks">${count}</span>
        `;

        this.dom.workspaceTabs.appendChild(btn);
      });

      if (this.dom.activeWorkspaceBadge) {
        const current = workspaces.find((w) => w.id === activeId);
        this.dom.activeWorkspaceBadge.textContent = current ? current.name : activeId;
      }
    }

    /**
     * Helper to safely escape HTML strings for innerHTML fragments
     */
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /**
     * Render the Kanban Board
     * @param {Object} columnTasks - { todo: Task[], 'in-progress': Task[], done: Task[] }
     * @param {Boolean} hasActiveFilters - whether search/filters are active
     * @param {Function} isOverdueFn - function(task) => boolean
     */
    renderBoard(columnTasks, hasActiveFilters, isOverdueFn) {
      Object.keys(STATUSES).forEach((statusKey) => {
        const colContainer = this.dom.columns[statusKey];
        const countBadge = this.dom.columnCounts[statusKey];
        const emptyState = this.dom.emptyStates[statusKey];
        const tasks = columnTasks[statusKey] || [];

        // Update count badge
        if (countBadge) {
          countBadge.textContent = tasks.length;
        }

        if (!colContainer) return;

        // Clear existing card elements, keep drop zone ready
        colContainer.innerHTML = '';

        if (tasks.length === 0) {
          if (emptyState) {
            emptyState.classList.remove('hidden');
            const emptyText = emptyState.querySelector('.empty-text');
            if (emptyText) {
              emptyText.textContent = hasActiveFilters
                ? 'No tasks match current filters'
                : `No tasks in ${STATUSES[statusKey].label}`;
            }
          }
        } else {
          if (emptyState) {
            emptyState.classList.add('hidden');
          }

          // Append each task card
          tasks.forEach((task) => {
            const card = this.createTaskCardElement(task, isOverdueFn(task));
            colContainer.appendChild(card);
          });
        }
      });
    }

    /**
     * Construct a secure, accessible task card DOM element
     */
    createTaskCardElement(task, isOverdue) {
      const card = document.createElement('article');
      card.className = `task-card priority-${task.priority} ${isOverdue ? 'is-overdue' : ''} ${task.status === 'done' ? 'is-done' : ''}`;
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-task-id', task.id);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `Task: ${task.title}, Priority: ${task.priority}, Due: ${task.dueDate}`);

      // Card Header: Priority & Overdue Indicators + Drag Handle
      const headerDiv = document.createElement('div');
      headerDiv.className = 'card-header';

      const badgesDiv = document.createElement('div');
      badgesDiv.className = 'card-badges';

      // Priority pill
      const priorityPill = document.createElement('span');
      priorityPill.className = `badge badge-priority badge-priority-${task.priority}`;
      priorityPill.textContent = PRIORITIES[task.priority]?.label || task.priority;
      badgesDiv.appendChild(priorityPill);

      // Overdue pill
      if (isOverdue) {
        const overduePill = document.createElement('span');
        overduePill.className = 'badge badge-overdue';
        overduePill.innerHTML = `
          <svg class="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          </svg>
          Overdue
        `;
        badgesDiv.appendChild(overduePill);
      }

      // Drag Grip Icon (accessible indicator)
      const dragGrip = document.createElement('span');
      dragGrip.className = 'card-drag-grip';
      dragGrip.setAttribute('title', 'Drag to reorder or move column');
      dragGrip.innerHTML = `
        <svg class="icon grip-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
        </svg>
      `;

      headerDiv.appendChild(badgesDiv);
      headerDiv.appendChild(dragGrip);
      card.appendChild(headerDiv);

      // Card Title (Safely rendered via textContent)
      const titleElem = document.createElement('h4');
      titleElem.className = 'card-title';
      titleElem.textContent = task.title;
      card.appendChild(titleElem);

      // Description Preview (Safely rendered via textContent)
      const descElem = document.createElement('p');
      descElem.className = 'card-desc';
      const snippet = task.description.length > 100
        ? task.description.substring(0, 97) + '...'
        : task.description;
      descElem.textContent = snippet;
      card.appendChild(descElem);

      // Card Meta: Due date & status move selector
      const metaDiv = document.createElement('div');
      metaDiv.className = 'card-meta';

      const dateDiv = document.createElement('div');
      dateDiv.className = `card-date ${isOverdue ? 'date-overdue' : ''}`;
      dateDiv.innerHTML = `
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clip-rule="evenodd" />
        </svg>
        <span>${this.escapeHtml(formatDisplayDate(task.dueDate))}</span>
      `;
      metaDiv.appendChild(dateDiv);

      // Card Action Buttons
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'card-actions';

      // View details button
      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn-icon btn-view-task';
      viewBtn.setAttribute('title', 'View details');
      viewBtn.setAttribute('aria-label', `View details for ${task.title}`);
      viewBtn.setAttribute('data-task-id', task.id);
      viewBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
          <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
        </svg>
      `;
      actionsDiv.appendChild(viewBtn);

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-icon btn-edit-task';
      editBtn.setAttribute('title', 'Edit task');
      editBtn.setAttribute('aria-label', `Edit task ${task.title}`);
      editBtn.setAttribute('data-task-id', task.id);
      editBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
        </svg>
      `;
      actionsDiv.appendChild(editBtn);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-icon btn-delete-task btn-danger-hover';
      deleteBtn.setAttribute('title', 'Delete task');
      deleteBtn.setAttribute('aria-label', `Delete task ${task.title}`);
      deleteBtn.setAttribute('data-task-id', task.id);
      deleteBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
        </svg>
      `;
      actionsDiv.appendChild(deleteBtn);

      metaDiv.appendChild(actionsDiv);
      card.appendChild(metaDiv);

      // Mobile/Keyboard Status Quick Selector (Bonus accessibility helper)
      const quickMoveWrapper = document.createElement('div');
      quickMoveWrapper.className = 'card-quick-move';
      quickMoveWrapper.innerHTML = `
        <label for="move-${task.id}" class="sr-only">Change Status</label>
        <select id="move-${task.id}" class="status-quick-select" data-task-id="${task.id}" aria-label="Change status of ${this.escapeHtml(task.title)}">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      `;
      card.appendChild(quickMoveWrapper);

      return card;
    }

    /**
     * Render Activity Feed (Sidebar & Mobile Collapsible)
     */
    renderActivities(activities, getWorkspaceNameFn) {
      const renderList = (targetContainer) => {
        if (!targetContainer) return;
        targetContainer.innerHTML = '';

        if (!activities || activities.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'activity-empty';
          empty.textContent = 'No recent activity recorded yet.';
          targetContainer.appendChild(empty);
          return;
        }

        activities.forEach((act) => {
          const item = document.createElement('li');
          item.className = `activity-item activity-type-${act.type}`;

          const iconSvg = this.getActivityIcon(act.type);
          const wsName = getWorkspaceNameFn(act.workspaceId);
          const relativeTime = formatRelativeTime(act.timestamp);

          // Build item safely
          const iconSpan = document.createElement('span');
          iconSpan.className = 'activity-icon';
          iconSpan.setAttribute('aria-hidden', 'true');
          iconSpan.innerHTML = iconSvg;

          const contentDiv = document.createElement('div');
          contentDiv.className = 'activity-content';

          const msgP = document.createElement('p');
          msgP.className = 'activity-message';
          msgP.textContent = act.message; // Safe textContent prevents XSS

          const metaDiv = document.createElement('div');
          metaDiv.className = 'activity-meta';

          const wsBadge = document.createElement('span');
          wsBadge.className = `activity-ws-badge ws-badge-${act.workspaceId}`;
          wsBadge.textContent = wsName;

          const timeSpan = document.createElement('span');
          timeSpan.className = 'activity-time';
          timeSpan.textContent = relativeTime;

          metaDiv.appendChild(wsBadge);
          metaDiv.appendChild(timeSpan);

          contentDiv.appendChild(msgP);
          contentDiv.appendChild(metaDiv);

          item.appendChild(iconSpan);
          item.appendChild(contentDiv);

          targetContainer.appendChild(item);
        });
      };

      renderList(this.dom.desktopActivityList);
      renderList(this.dom.mobileActivityList);

      if (this.dom.mobileActivityBadge) {
        this.dom.mobileActivityBadge.textContent = activities.length;
      }
    }

    getActivityIcon(type) {
      switch (type) {
        case 'create':
          return `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
        case 'edit':
          return `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"/></svg>`;
        case 'delete':
          return `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>`;
        case 'status':
        default:
          return `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>`;
      }
    }

    /**
     * Populate and open Task Form Modal for Create or Edit
     */
    openTaskModal({
      isEdit = false,
      task = null,
      defaultWorkspace = 'personal',
      triggerElement = null,
      todayDateStr = ''
    }) {
      this.clearFormErrors();
      this.dom.taskForm.reset();

      if (isEdit && task) {
        this.dom.taskModalTitle.textContent = 'Edit Task';
        this.dom.taskIdInput.value = task.id;
        this.dom.taskWorkspaceInput.value = task.workspaceId;
        this.dom.taskTitleInput.value = task.title;
        this.dom.taskPriorityInput.value = task.priority;
        this.dom.taskStatusInput.value = task.status;
        this.dom.taskDueDateInput.value = task.dueDate;
        this.dom.taskDescriptionInput.value = task.description;

        // When editing an overdue task, do not lock user out: allow original due date
        // But if changing date, min should be today
        this.dom.taskDueDateInput.removeAttribute('min');
      } else {
        this.dom.taskModalTitle.textContent = 'Create New Task';
        this.dom.taskIdInput.value = '';
        this.dom.taskWorkspaceInput.value = defaultWorkspace;
        this.dom.taskTitleInput.value = '';
        this.dom.taskPriorityInput.value = 'medium';
        this.dom.taskStatusInput.value = 'todo';
        this.dom.taskDueDateInput.value = todayDateStr;
        this.dom.taskDueDateInput.setAttribute('min', todayDateStr);
        this.dom.taskDescriptionInput.value = '';
      }

      this.openModal(this.dom.taskModal, triggerElement);
    }

    /**
     * Display validation errors inline without clearing user input
     */
    showFormErrors(errors) {
      this.clearFormErrors();

      Object.keys(errors).forEach((fieldName) => {
        const errorMsg = errors[fieldName];
        const errorContainer = document.getElementById(`field-error-${fieldName}`);
        const inputField = document.querySelector(`[name="${fieldName}"]`);

        if (errorContainer) {
          errorContainer.textContent = errorMsg;
          errorContainer.classList.remove('hidden');
        }

        if (inputField) {
          inputField.classList.add('has-error');
          inputField.setAttribute('aria-invalid', 'true');
          inputField.setAttribute('aria-describedby', `field-error-${fieldName}`);
        }
      });

      // Focus first erroneous input
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const elem = document.querySelector(`[name="${firstErrorField}"]`);
        if (elem) elem.focus();
      }
    }

    clearFormErrors() {
      document.querySelectorAll('.field-error').forEach((el) => {
        el.textContent = '';
        el.classList.add('hidden');
      });
      document.querySelectorAll('.has-error').forEach((el) => {
        el.classList.remove('has-error');
        el.removeAttribute('aria-invalid');
      });
    }

    /**
     * Show Task Details Dialog
     */
    openDetailsModal(task, isOverdue, getWorkspaceNameFn, triggerElement = null) {
      if (!task) return;
      this.currentDetailsTaskId = task.id;

      this.dom.detailsTitle.textContent = task.title;
      this.dom.detailsWorkspace.textContent = getWorkspaceNameFn(task.workspaceId);
      this.dom.detailsStatus.textContent = STATUSES[task.status]?.label || task.status;
      this.dom.detailsPriority.textContent = PRIORITIES[task.priority]?.label || task.priority;
      this.dom.detailsPriority.className = `badge badge-priority badge-priority-${task.priority}`;
      this.dom.detailsDueDate.textContent = formatDisplayDate(task.dueDate);

      if (isOverdue) {
        this.dom.detailsOverdueBadge.classList.remove('hidden');
      } else {
        this.dom.detailsOverdueBadge.classList.add('hidden');
      }

      // Safe whitespace-preserving text
      this.dom.detailsDescription.textContent = task.description;

      if (this.dom.detailsCreated) {
        this.dom.detailsCreated.textContent = new Date(task.createdAt).toLocaleString();
      }
      if (this.dom.detailsUpdated) {
        this.dom.detailsUpdated.textContent = new Date(task.updatedAt).toLocaleString();
      }

      this.dom.detailsEditBtn.setAttribute('data-task-id', task.id);
      this.dom.detailsDeleteBtn.setAttribute('data-task-id', task.id);

      this.openModal(this.dom.detailsModal, triggerElement);
    }

    /**
     * Open Delete Confirmation Modal
     */
    openDeleteModal(task, triggerElement = null) {
      if (!task) return;
      this.pendingDeleteTaskId = task.id;
      this.dom.deleteTaskName.textContent = `"${task.title}"`;
      this.openModal(this.dom.deleteModal, triggerElement);
    }

    /**
     * Storage Warning Banner
     */
    showStorageAlert(message) {
      if (this.dom.storageAlertBanner && this.dom.storageAlertMessage) {
        this.dom.storageAlertMessage.textContent = message;
        this.dom.storageAlertBanner.classList.remove('hidden');
      }
    }

    hideStorageAlert() {
      if (this.dom.storageAlertBanner) {
        this.dom.storageAlertBanner.classList.add('hidden');
      }
    }

    /**
     * Brief Accessible Toast Notification
     */
    showToast(message, type = 'info') {
      if (!this.dom.toastContainer) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = message;

      this.dom.toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  window.TaskFlowUI = TaskFlowUI;
})(window);
