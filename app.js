(() => {
  const STORAGE_KEY = 'minimalist_todos_v1';

  const CATEGORY_LABELS = {
    work: '工作',
    life: '生活',
  };

  const PRIORITY_CONFIG = {
    high: { label: 'High', weight: 3 },
    medium: { label: 'Medium', weight: 2 },
    low: { label: 'Low', weight: 1 },
  };

  const STATUS_LIST = ['todo', 'process', 'done'];

  const EMPTY_HINTS = {
    todo: '尚無待辦項目 · 可新增或拖曳至此',
    process: '將進行中的任務卡片拖曳至此',
    done: '完成的任務卡片可拖曳至此',
  };

  // DOM 元素
  const todayDateEl = document.getElementById('today-date');
  const pendingCountEl = document.getElementById('pending-count');
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoAssignee = document.getElementById('todo-assignee');
  const todoCategory = document.getElementById('todo-category');
  const todoPriority = document.getElementById('todo-priority');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const countAllEl = document.getElementById('count-all');
  const countWorkEl = document.getElementById('count-work');
  const countLifeEl = document.getElementById('count-life');
  const clearCompletedBtn = document.getElementById('clear-completed');

  const dropzones = {
    todo: document.getElementById('list-todo'),
    process: document.getElementById('list-process'),
    done: document.getElementById('list-done'),
  };

  const colCounts = {
    todo: document.getElementById('col-count-todo'),
    process: document.getElementById('col-count-process'),
    done: document.getElementById('col-count-done'),
  };

  const columns = document.querySelectorAll('.kanban-column');

  // 應用程式狀態
  let todos = loadTodos();
  let currentFilter = 'all';
  let draggedTaskId = null;

  // 初始化今日日期
  function initDate() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    todayDateEl.textContent = formatter.format(now);
  }

  // 正規化單筆資料（相容舊版資料）
  function normalizeTodo(item) {
    let status = item.status;
    if (!STATUS_LIST.includes(status)) {
      status = item.completed ? 'done' : 'todo';
    }
    const priority = PRIORITY_CONFIG[item.priority] ? item.priority : 'medium';

    return {
      ...item,
      priority,
      status,
      completed: status === 'done',
    };
  }

  // 依優先程度 (High -> Medium -> Low) 進行排序
  function sortTodosByPriority(list) {
    return list.sort((a, b) => {
      const weightA = (PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.medium).weight;
      const weightB = (PRIORITY_CONFIG[b.priority] || PRIORITY_CONFIG.medium).weight;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return 0;
    });
  }

  // 從 localStorage 載入任務
  function loadTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return sortTodosByPriority(parsed.map(normalizeTodo));
    } catch (err) {
      console.error('無法讀取本地儲存的待辦清單:', err);
      return [];
    }
  }

  // 儲存任務至 localStorage
  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (err) {
      console.error('無法寫入待辦清單至本地儲存:', err);
    }
  }

  // 新增任務（預設進入 To-do 欄位並依優先程度排序）
  function addTodo(text, assignee, category, priority) {
    const cleanText = text.trim();
    if (!cleanText) return;

    const cleanAssignee = assignee.trim();
    const validCategory = category === 'life' ? 'life' : 'work';
    const validPriority = PRIORITY_CONFIG[priority] ? priority : 'medium';

    const newTodo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      assignee: cleanAssignee,
      category: validCategory,
      priority: validPriority,
      status: 'todo',
      completed: false,
      createdAt: Date.now(),
    };

    todos.unshift(newTodo);
    sortTodosByPriority(todos);
    saveTodos();
    render();
  }

  // 更新任務欄位狀態並維持優先程度排序
  function moveTodo(taskId, targetStatus, beforeTaskId = null) {
    if (!STATUS_LIST.includes(targetStatus)) return;
    const sourceIndex = todos.findIndex((t) => t.id === taskId);
    if (sourceIndex === -1) return;

    const [movedItem] = todos.splice(sourceIndex, 1);
    movedItem.status = targetStatus;
    movedItem.completed = targetStatus === 'done';

    if (beforeTaskId && beforeTaskId !== taskId) {
      const targetIndex = todos.findIndex((t) => t.id === beforeTaskId);
      if (targetIndex !== -1) {
        todos.splice(targetIndex, 0, movedItem);
      } else {
        todos.push(movedItem);
      }
    } else {
      todos.push(movedItem);
    }

    sortTodosByPriority(todos);
    saveTodos();
    render();
  }

  // 刪除單筆任務
  function deleteTodo(id) {
    todos = todos.filter((item) => item.id !== id);
    saveTodos();
    render();
  }

  // 清除所有 Done 任務
  function clearCompleted() {
    todos = todos.filter((item) => item.status !== 'done');
    saveTodos();
    render();
  }

  // 切換分類篩選
  function setFilter(filter) {
    currentFilter = filter;
    filterTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    render();
  }

  // 建立任務卡片 DOM 節點
  function createTaskCard(item) {
    const priorityKey = PRIORITY_CONFIG[item.priority] ? item.priority : 'medium';
    const priorityInfo = PRIORITY_CONFIG[priorityKey];

    const card = document.createElement('article');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.id = item.id;
    card.dataset.status = item.status;
    card.dataset.priority = priorityKey;

    // 卡片頂部：任務名稱 + 刪除按鈕
    const topDiv = document.createElement('div');
    topDiv.className = 'card-top';

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = item.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete';
    deleteBtn.setAttribute('aria-label', `刪除「${item.text}」`);
    deleteBtn.title = '刪除任務';
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTodo(item.id);
    });

    topDiv.appendChild(textSpan);
    topDiv.appendChild(deleteBtn);

    // 卡片底部：優先程度標籤 + 分類標籤 + 負責人徽章
    const footerDiv = document.createElement('div');
    footerDiv.className = 'card-footer';

    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'card-badges';

    const priorityBadge = document.createElement('span');
    priorityBadge.className = `badge badge-priority-${priorityKey}`;
    priorityBadge.textContent = priorityInfo.label;
    priorityBadge.title = `優先程度：${priorityInfo.label}`;
    badgesDiv.appendChild(priorityBadge);

    const categoryKey = item.category === 'life' ? 'life' : 'work';
    const categoryBadge = document.createElement('span');
    categoryBadge.className = `badge badge-${categoryKey}`;
    categoryBadge.textContent = CATEGORY_LABELS[categoryKey];
    badgesDiv.appendChild(categoryBadge);

    if (item.assignee) {
      const assigneeBadge = document.createElement('span');
      assigneeBadge.className = 'badge badge-assignee';
      assigneeBadge.textContent = `👤 ${item.assignee}`;
      assigneeBadge.title = `負責人：${item.assignee}`;
      badgesDiv.appendChild(assigneeBadge);
    }

    footerDiv.appendChild(badgesDiv);

    card.appendChild(topDiv);
    card.appendChild(footerDiv);

    // 綁定卡片拖曳事件
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = item.id;
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
      }
    });

    card.addEventListener('dragend', () => {
      draggedTaskId = null;
      card.classList.remove('dragging');
      columns.forEach((col) => col.classList.remove('drag-over'));
    });

    return card;
  }

  // 計算拖曳放下時位於哪張卡片之前
  function getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll('.task-card:not(.dragging)'),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  // 初始化三個欄位的拖放監聽器
  function initDragAndDrop() {
    columns.forEach((column) => {
      const targetStatus = column.dataset.status;
      const dropzone = dropzones[targetStatus];

      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', (e) => {
        if (!column.contains(e.relatedTarget)) {
          column.classList.remove('drag-over');
        }
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');

        const taskId =
          draggedTaskId ||
          (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
        if (!taskId) return;

        const afterElement = getDragAfterElement(dropzone, e.clientY);
        const beforeTaskId = afterElement ? afterElement.dataset.id : null;

        moveTodo(taskId, targetStatus, beforeTaskId);
      });
    });
  }

  // 渲染三個欄位與統計數字
  function render() {
    sortTodosByPriority(todos);

    const doneCount = todos.filter((t) => t.status === 'done').length;
    const activeCount = todos.length - doneCount;
    const workCount = todos.filter((t) => t.category === 'work').length;
    const lifeCount = todos.filter((t) => t.category === 'life').length;

    pendingCountEl.textContent = activeCount;
    countAllEl.textContent = todos.length;
    countWorkEl.textContent = workCount;
    countLifeEl.textContent = lifeCount;

    clearCompletedBtn.hidden = doneCount === 0;

    // 依工作/生活篩選
    const filtered = todos.filter((item) => {
      if (currentFilter === 'all') return true;
      return item.category === currentFilter;
    });

    // 分別渲染 To-do, Process, Done 三欄
    STATUS_LIST.forEach((status) => {
      const zone = dropzones[status];
      const countEl = colCounts[status];
      const itemsInColumn = filtered.filter((item) => item.status === status);

      countEl.textContent = itemsInColumn.length;
      zone.innerHTML = '';

      if (itemsInColumn.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'column-empty';
        emptyDiv.textContent = EMPTY_HINTS[status];
        zone.appendChild(emptyDiv);
      } else {
        itemsInColumn.forEach((item) => {
          zone.appendChild(createTaskCard(item));
        });
      }
    });
  }

  // 綁定表單與篩選事件
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTodo(
      todoInput.value,
      todoAssignee.value,
      todoCategory.value,
      todoPriority.value
    );
    todoInput.value = '';
    todoAssignee.value = '';
    todoPriority.value = 'medium';
    todoInput.focus();
  });

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setFilter(tab.dataset.filter);
    });
  });

  clearCompletedBtn.addEventListener('click', clearCompleted);

  // 啟動應用
  initDate();
  initDragAndDrop();
  render();
})();
