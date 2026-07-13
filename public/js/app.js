/**
 * app.js — Agency Ops SPA Controller
 * Hash-based routing, view rendering, state management.
 */

const App = (() => {
  // ── State ──────────────────────────────────────────────────
  let state = {
    role: 'ADMIN',
    currentView: 'dashboard',
    currentUser: { name: 'Jordan Reyes', email: 'jordan@agencyops.io', role: 'ADMIN', initials: 'JR' },
    bundles: [], // service requests internally mapped to bundles
    tasks: [],
    users: [],
    agencies: [],
    selectedMatchCreator: null,
    pendingHotSwapBundleId: null,
    pendingTriggerBundleId: null,
    schedulerBundleId: null,
  };

  // ── Toast Notifications ────────────────────────────────────
  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: '💬' };
    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.innerHTML = `<span class="toast-icon">${icons[type]||'💬'}</span><span class="toast-msg">${msg}</span>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }

  // ── Navigation ─────────────────────────────────────────────
  function navigate(viewPath) {
    window.location.hash = viewPath;
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const parts = hash.split('/');
    const view = parts[0];
    const param = parts[1];
    state.currentView = view;

    // Update nav active link state
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    switch (view) {
      case 'dashboard':        renderDashboard(); break;
      case 'agencies':         param ? renderAgencyDetail(param) : renderAgencies(); break;
      case 'service_requests':  param ? renderServiceRequestDetail(param) : renderAgencies(); break;
      case 'tasks':            renderTasks(); break;
      case 'workspace':        param ? renderWorkspace(param) : renderTasks(); break;
      case 'assets':           renderAssets(); break;
      case 'capacity':         renderCapacity(); break;
      case 'creators':         renderCreators(); break;
      default:                 renderDashboard();
    }
  }

  // ── Role Switcher ──────────────────────────────────────────
  function switchRole(role) {
    state.role = role;
    document.getElementById('role-admin')?.classList.toggle('active', role === 'ADMIN');
    document.getElementById('role-creator')?.classList.toggle('active', role === 'CREATOR');

    if (role === 'ADMIN') {
      state.currentUser = { name: 'Jordan Reyes', email: 'jordan@agencyops.io', role: 'ADMIN', initials: 'JR' };
    } else {
      state.currentUser = { name: 'Mia Chen', email: 'mia@agencyops.io', role: 'CREATOR', initials: 'MC' };
    }

    // Update sidebar profile card details
    const avatar = document.getElementById('sidebar-user-avatar');
    const nameLabel = document.getElementById('sidebar-user-name');
    const roleLabel = document.getElementById('sidebar-user-role');
    if (avatar) {
      avatar.textContent = state.currentUser.initials;
      avatar.style.background = Components.avatarColor(state.currentUser.name);
    }
    if (nameLabel) nameLabel.textContent = state.currentUser.name;
    if (roleLabel) roleLabel.textContent = state.currentUser.role;

    // Show/hide admin links
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = role === 'ADMIN' ? '' : 'none';
    });

    // Re-route current view
    handleRoute();
  }

  // ── Update Sidebar Badges ──────────────────────────────────
  function updateBadges() {
    const unassigned = state.bundles.filter(b => b.status === 'UNASSIGNED').length;
    const pending = state.tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
    const badgeT = document.getElementById('badge-tasks');
    const badgeN = document.getElementById('notif-badge');
    
    if (badgeT) {
      badgeT.textContent = pending || '';
      badgeT.style.display = pending > 0 ? 'inline-block' : 'none';
    }
    if (badgeN) {
      badgeN.textContent = unassigned || '0';
      badgeN.style.opacity = unassigned > 0 ? '1' : '0.4';
    }
  }

  // ── Shared Data Loaders ────────────────────────────────────
  async function loadAll() {
    [state.bundles, state.tasks, state.users, state.agencies] = await Promise.all([
      API.getServiceRequests(),
      API.getTasks(),
      API.getUsers(),
      API.getAgencies(),
    ]);
    updateBadges();
  }

  // ─────────────────────────────────────────────────────────────
  // ── VIEWS ─────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────

  // ── Dashboard (Role-specific layout) ─────────────────────────
  async function renderDashboard() {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    await loadAll();

    const me = state.users.find(u => u.email === state.currentUser.email);

    if (state.role === 'CREATOR') {
      // ── Creator Workflow & Time-Block view ──
      const myRequests = state.bundles.filter(r => r.assigned_creator_id === me?.id && r.status === 'ASSIGNED');
      const myTasks = state.tasks.filter(t => t.assigned_to_creator_id === me?.id);
      const activeTasks = myTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');

      vc.innerHTML = `
        <div class="page-header">
          <div>
            <h1>Creator Workspace Planner</h1>
            <p>Welcome back, ${escHtml(state.currentUser.name)}. Focus on scheduled time blocks below.</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns: 2fr 1fr; gap: 24px; align-items: start">
          <div>
            <div class="card">
              <div class="card-header">
                <h2>📅 Weekly Support Time-Blocks</h2>
              </div>
              <div class="card-body" style="padding: 16px">
                ${Components.renderTimeBlockPlanner(myRequests, myTasks)}
              </div>
            </div>
          </div>

          <div>
            <div class="card" style="margin-bottom: 20px">
              <div class="card-header">
                <h2>📈 Active Workload</h2>
              </div>
              <div class="card-body" style="display:flex; flex-direction:column; gap:12px">
                <div class="flex-between">
                  <span class="text-muted">Assigned Requests</span>
                  <strong>${myRequests.length} active</strong>
                </div>
                <div class="flex-between">
                  <span class="text-muted">Open Tasks</span>
                  <strong style="color: var(--warning)">${activeTasks.length} pending</strong>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <h2>🔔 Pending Checklist Actions</h2>
              </div>
              <div class="card-body" style="display:flex; flex-direction:column; gap:8px; padding:12px">
                ${activeTasks.length
                  ? activeTasks.map(t => Components.renderTaskItem(t, state.role)).join('')
                  : '<p class="text-muted" style="text-align:center;padding:12px;font-size:0.8rem">All caught up!</p>'}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // ── Admin Dashboard view ──
      const total = state.bundles.length;
      const assigned = state.bundles.filter(b => b.status === 'ASSIGNED').length;
      const unassigned = state.bundles.filter(b => b.status === 'UNASSIGNED').length;
      const paused = state.bundles.filter(b => b.status === 'PAUSED').length;
      const pending = state.tasks.filter(t => t.status === 'PENDING').length;
      const inProg = state.tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const completed = state.tasks.filter(t => t.status === 'COMPLETED').length;

      const recentTasks = [...state.tasks]
        .sort((a,b) => new Date(b.scheduled_for_timestamp) - new Date(a.scheduled_for_timestamp))
        .slice(0, 5);

      const recentRequests = [...state.bundles].slice(0, 4);

      vc.innerHTML = `
        <div class="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Platform metrics and support routines overview</p>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-secondary" onclick="App.openSchedulerCapacity()">📊 Capacity Match</button>
            <button class="btn btn-primary" onclick="App.openCreateServiceRequest()">+ Service Request</button>
          </div>
        </div>

        <div class="stats-grid">
          ${Components.renderStatCard('🛠️', total, 'Service Requests', 'violet')}
          ${Components.renderStatCard('✅', assigned, 'Active Assigned', 'green')}
          ${Components.renderStatCard('⏳', unassigned, 'Needs Assignment', 'amber')}
          ${Components.renderStatCard('⏸', paused, 'Paused Requests', 'blue')}
          ${Components.renderStatCard('🔄', inProg, 'Tasks In-Progress', 'amber')}
          ${Components.renderStatCard('✓', completed, 'Tasks Completed', 'green')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
          <div class="card">
            <div class="card-header">
              <h2>Recent Routine Tasks</h2>
              <a href="#tasks" class="btn btn-secondary btn-sm">View All</a>
            </div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:8px;padding:16px">
              ${recentTasks.length
                ? recentTasks.map(t => Components.renderTaskItem(t, state.role)).join('')
                : '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks yet</p></div>'}
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h2>Recent Service Requests</h2>
              <a href="#agencies" class="btn btn-secondary btn-sm">Browse Agencies</a>
            </div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:12px;padding:16px">
              ${recentRequests.length
                ? recentRequests.map(sr => Components.renderServiceRequestCard(sr, state.role)).join('')
                : '<div class="empty-state"><div class="empty-icon">🛠️</div><p>No service requests yet</p></div>'}
            </div>
          </div>
        </div>
      `;
    }
  }

  // ── Agencies Browse ──────────────────────────────────────────
  async function renderAgencies() {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    await loadAll();

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Client Agencies</h1>
          <p>Organize resources, copy WhatsApp/groupchats, and manage service requests per agency.</p>
        </div>
        ${state.role === 'ADMIN' ? `
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" onclick="App.openCreateAgency()">+ New Agency</button>
          <button class="btn btn-primary" onclick="App.openCreateServiceRequest()">+ Service Request</button>
        </div>` : ''}
      </div>

      <div class="content-grid" id="agencies-grid">
        ${state.agencies.map(a => `
          <div class="card" onclick="App.navigate('agencies/${a.id}')" style="cursor:pointer; transition: transform var(--transition)">
            <div class="card-header" style="border:none; padding-bottom:0">
              <h2 style="font-size:1.1rem">🏢 ${escHtml(a.name)}</h2>
              ${state.role === 'ADMIN' ? `
                <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();App.deleteAgency(${a.id})">🗑</button>
              ` : ''}
            </div>
            <div class="card-body" style="display:flex; gap:16px; font-size:0.83rem; color:var(--text-secondary)">
              <span>🛠️ ${a.service_requests_count} Service Requests</span>
              <span>💬 ${a.chat_logs_count} Chat Logs</span>
            </div>
          </div>
        `).join('') || '<div class="empty-state" style="grid-column: 1/-1"><div class="empty-icon">🏢</div><p>No agencies added yet.</p></div>'}
      </div>
    `;
  }

  // ── Agency Detail View (incorporates Requests, Assets & Chat copy-paste) ────
  async function renderAgencyDetail(id) {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();

    const [agency, users] = await Promise.all([
      API.getAgency(id),
      API.getUsers(),
    ]);
    state.users = users;

    const visibleRequests = state.role === 'CREATOR'
      ? agency.service_requests.filter(r => r.status !== 'ASSIGNED')
      : agency.service_requests;

    const canDelete = state.role === 'ADMIN';

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-secondary btn-sm" style="margin-bottom:10px" onclick="App.navigate('agencies')">← Back to Agencies</button>
          <h1>🏢 ${escHtml(agency.name)}</h1>
          <p>Agency Workspace &bull; Service assets, groupchat briefings, and routines</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="App.openAddChatLog(${agency.id})">💬 Paste Chat Text</button>
          <button class="btn btn-secondary" onclick="App.openAddAsset(${agency.id}, '${escHtml(agency.name)}')">🔗 Add Asset</button>
          ${state.role === 'ADMIN' ? `<button class="btn btn-primary" onclick="App.openCreateServiceRequest(${agency.id})">+ Service Request</button>` : ''}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 2fr 1.2fr; gap: 22px; align-items: start; margin-bottom:22px">
        <!-- Left: Service Requests & Chat logs -->
        <div style="display:flex; flex-direction:column; gap:22px">
          <div class="card">
            <div class="card-header">
              <h2>🛠️ Active Service Requests (${visibleRequests.length})</h2>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:12px">
              ${visibleRequests.map(sr => Components.renderServiceRequestCard(sr, state.role)).join('')
                || '<p class="text-muted">No service requests configured for this agency.</p>'}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2>💬 Pasted Groupchat Transcripts (${agency.chat_logs.length})</h2>
            </div>
            <div class="card-body">
              ${Components.renderChatLogsFeed(agency.chat_logs, agency.id)}
            </div>
          </div>
        </div>

        <!-- Right: Assets -->
        <div>
          <div class="card">
            <div class="card-header">
              <h2>🔗 Agency Assets</h2>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:10px">
              ${agency.assets.map(a => Components.renderAssetCard(a, canDelete)).join('')
                || '<p class="text-muted">No assets stored. Add image URLs or client website links for sync routines.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Service Request Detail View (formerly Bundle Detail) ────────────────────
  async function renderServiceRequestDetail(id) {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    const [sr, users] = await Promise.all([API.getServiceRequest(id), API.getUsers()]);
    state.users = users;

    const tasks = await API.getTasks({ service_request_id: id });

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-secondary btn-sm" style="margin-bottom:10px" onclick="App.navigate('agencies/${sr.agency_id}')">← Back to Agency</button>
          <h1>${escHtml(sr.service_name)}</h1>
          <p>
            ${Components.statusBadge(sr.status)} 
            &bull; Agency: <strong>${escHtml(sr.agency_name)}</strong>
            ${sr.preferred_execution_day ? ` &bull; 📅 ${sr.preferred_execution_day} at ${Components.fmtTime(sr.preferred_execution_time)}` : ''}
          </p>
        </div>
        ${state.role === 'ADMIN' ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="App.openHotSwap(${sr.id},'${escHtml(sr.service_name)}')">🔀 Re-route Creator</button>
          <button class="btn btn-secondary" onclick="App.openTrigger(${sr.id},'${escHtml(sr.service_name)}')">⚡ Trigger Tasks</button>
          ${sr.status !== 'PAUSED'
            ? `<button class="btn btn-warning" onclick="App.setServiceRequestStatus(${sr.id},'PAUSED')">⏸ Pause</button>`
            : `<button class="btn btn-success" onclick="App.setServiceRequestStatus(${sr.id},'ASSIGNED')">▶ Resume</button>`}
        </div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:22px">
        <div class="card">
          <div class="card-header"><h2>👤 Sub-Profiles / Talent (${sr.sub_profiles.length})</h2></div>
          <div class="card-body">
            <div class="profile-link-list">
              ${sr.sub_profiles.map(p => `
                <div class="profile-link-item">
                  <span class="profile-link-name">${escHtml(p.profile_name)}</span>
                  <a href="${escHtml(p.internal_cms_edit_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open CMS</a>
                </div>
              `).join('') || '<p class="text-muted">No profiles linked.</p>'}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h2>📋 Routine Checklist Blueprint (${sr.routine_rules.length})</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
            ${sr.routine_rules.map(r => `
              <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  ${Components.pipelineChip(r.pipeline_type)}
                  ${r.cron_interval_expression ? `<code style="font-size:0.73rem;color:var(--accent-light);font-family:'JetBrains Mono',monospace">${escHtml(r.cron_interval_expression)}</code>` : ''}
                </div>
                ${r.source_url ? `
                  <div class="source-link-card" style="margin-bottom:8px">
                    <span class="source-link-url">${escHtml(r.source_url)}</span>
                    <a href="${escHtml(r.source_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open →</a>
                  </div>` : ''}
                <p style="font-size:0.75rem;color:var(--text-muted);white-space:pre-line">${escHtml((r.execution_instructions||''))}</p>
              </div>
            `).join('') || '<p class="text-muted">No instructions configured.</p>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>✅ Execution Ledger Tasks (${tasks.length})</h2>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:8px;padding:16px">
          ${tasks.map(t => Components.renderTaskItem(t, state.role)).join('')
            || '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks spawned yet.</p></div>'}
        </div>
      </div>
    `;
  }

  // ── Task Queue ─────────────────────────────────────────────
  async function renderTasks() {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    await loadAll();

    let tasks = state.tasks;
    if (state.role === 'CREATOR') {
      const me = state.users.find(u => u.email === state.currentUser.email);
      if (me) tasks = tasks.filter(t => t.assigned_to_creator_id === me.id);
    }

    const statuses = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'];

    function renderFiltered(filter) {
      const filtered = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);
      document.getElementById('task-list').innerHTML = filtered.length
        ? filtered.map(t => Components.renderTaskItem(t, state.role)).join('')
        : '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks in this category.</p></div>';
      document.querySelectorAll('.task-filter-tab').forEach(el =>
        el.classList.toggle('active', el.dataset.filter === filter));
    }

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Routine Task Queue</h1>
          <p>${state.role === 'CREATOR' ? 'Your active scheduled runs' : 'Platform active execution tasks'}</p>
        </div>
        ${state.role === 'ADMIN' ? `<button class="btn btn-secondary" onclick="App.generateAllTasks()">⚡ Generate Tasks</button>` : ''}
      </div>
      <div class="tabs">
        ${statuses.map(s => `
          <button class="tab-btn task-filter-tab ${s==='ALL'?'active':''}" data-filter="${s}"
            onclick="App._taskFilter('${s}')">${s} (${s==='ALL'?tasks.length:tasks.filter(t=>t.status===s).length})</button>
        `).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px" id="task-list">
        ${tasks.map(t => Components.renderTaskItem(t, state.role)).join('')
          || '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks found.</p></div>'}
      </div>
    `;
    App._taskFilter = renderFiltered;
  }

  // ── Creator Workspace Checklist ────────────────────────────
  async function renderWorkspace(taskId) {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    const task = await API.getTask(taskId);

    const rules = task.routine_rules || [];
    const profiles = task.sub_profiles || [];
    const allInstructions = rules.map(r => r.execution_instructions || '').join('\n');
    const checklist = Components.parseChecklist(allInstructions);
    const total = checklist.length;
    const done  = checklist.filter(i => i.done).length;
    const sourceUrl = rules.find(r => r.source_url)?.source_url;

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-secondary btn-sm" style="margin-bottom:10px" onclick="history.back()">← Back</button>
          <h1>${escHtml(task.agency_name)}: ${escHtml(task.service_name)}</h1>
          <p>Task Execution #${task.id} &bull; Status: ${Components.statusBadge(task.status)} &bull; Scheduled: ${Components.fmtDateTime(task.scheduled_for_timestamp)}</p>
        </div>
        <div style="display:flex;gap:8px">
          ${task.status === 'PENDING'
            ? `<button class="btn btn-warning" onclick="App.updateTaskStatus(${task.id},'IN_PROGRESS')">▶ Start Task</button>`
            : task.status === 'IN_PROGRESS'
            ? `<button class="btn btn-success" onclick="App.updateTaskStatus(${task.id},'COMPLETED')">✓ Mark Complete</button>`
            : ''}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 2fr 1.2fr; gap:22px; align-items:start">
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-header">
              <h2>📋 Execution Checklist</h2>
              <span id="progress-${task.id}" style="font-size:0.8rem;color:var(--text-secondary)">${done} / ${total} complete</span>
            </div>
            <div class="card-body">
              ${Components.renderChecklist(checklist, task.id)}
            </div>
          </div>

          ${sourceUrl ? `
          <div class="card" style="margin-bottom:16px">
            <div class="card-header"><h2>🔗 Source Data URL</h2></div>
            <div class="card-body">
              <div class="source-link-card">
                <span class="source-link-url">${escHtml(sourceUrl)}</span>
                <a href="${escHtml(sourceUrl)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Open Link</a>
              </div>
            </div>
          </div>` : ''}

          <div class="card">
            <div class="card-header"><h2>👥 Sub-Profiles / CMS Links</h2></div>
            <div class="card-body">
              <div class="profile-link-list">
                ${profiles.map(p => `
                  <div class="profile-link-item">
                    <div>
                      <div class="profile-link-name">${escHtml(p.profile_name)}</div>
                      <div class="profile-link-url">${escHtml(p.internal_cms_edit_url)}</div>
                    </div>
                    <a href="${escHtml(p.internal_cms_edit_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Open CMS</a>
                  </div>
                `).join('') || '<p class="text-muted">No profiles linked.</p>'}
              </div>
            </div>
          </div>
        </div>

        <div>
          <!-- Groupchat briefings directly in Workspace so creators can view WhatsApp dumps -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-header"><h2>💬 Client Groupchat Updates</h2></div>
            <div class="card-body" style="padding:12px">
              ${Components.renderChatLogsFeed(task.chat_logs || [], task.agency_id)}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h2>📊 Execution Metadata</h2></div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
              <div class="flex-between">
                <span class="text-muted">Status</span>
                ${Components.statusBadge(task.status)}
              </div>
              <div class="flex-between">
                <span class="text-muted">Assigned Operator</span>
                <strong style="font-size:0.85rem">${escHtml(task.creator_name || 'Unassigned')}</strong>
              </div>
              <div class="flex-between">
                <span class="text-muted">Scheduled</span>
                <strong style="font-size:0.85rem">${Components.fmtDateTime(task.scheduled_for_timestamp)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Asset Library (Global browse) ──────────────────────────
  async function renderAssets(agencyId, agencyName) {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    await loadAll();

    const assets = await API.getAssets(agencyId ? { agency_id: agencyId } : {});

    // For Creators, filter assets to only show their assigned agencies' assets (plus global assets)
    let visibleAssets = assets;
    if (state.role === 'CREATOR') {
      const me = state.users.find(u => u.email === state.currentUser.email);
      const myRequests = state.bundles.filter(r => r.assigned_creator_id === me?.id);
      const myAgencyIds = [...new Set(myRequests.map(r => r.agency_id))];
      visibleAssets = assets.filter(a => !a.agency_id || myAgencyIds.includes(a.agency_id));
    }

    const globalAssets = visibleAssets.filter(a => !a.agency_id);
    const agencyAssets = visibleAssets.filter(a => a.agency_id);
    const canDelete = state.role === 'ADMIN';

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Global Asset Library</h1>
          <p>${agencyId ? `Resources for ${escHtml(agencyName || 'selected agency')}` : 'All shared client URLs, templates, and imagery references'}</p>
        </div>
        <button class="btn btn-primary" onclick="App.openAddAsset(${agencyId || 'null'}, '${escHtml(agencyName || '')}')">+ Add Asset</button>
      </div>

      ${agencyAssets.length ? `
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><h2>Agency Specific Assets (${agencyAssets.length})</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            ${agencyAssets.map(a => Components.renderAssetCard(a, canDelete)).join('')}
          </div>
        </div>` : ''}

      <div class="card">
        <div class="card-header">
          <h2>Global Shared Assets (${globalAssets.length})</h2>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
          ${globalAssets.length
            ? globalAssets.map(a => Components.renderAssetCard(a, canDelete)).join('')
            : '<div class="empty-state"><div class="empty-icon">🔗</div><p>No global assets yet. Add assets to help support syncing routines.</p></div>'}
        </div>
      </div>
    `;
  }

  function openAddAsset(agencyId, agencyName) {
    Components.openModal(Components.renderAddAssetModal(agencyId, agencyName));
  }

  async function submitAddAsset() {
    const label    = document.getElementById('aa-label')?.value.trim();
    const url      = document.getElementById('aa-url')?.value.trim();
    const type     = document.getElementById('aa-type')?.value;
    const category = document.getElementById('aa-category')?.value;
    const notes    = document.getElementById('aa-notes')?.value.trim() || null;
    const agencyId = document.getElementById('aa-agency-id')?.value || null;

    if (!label || !url) { toast('Label and URL are required', 'error'); return; }

    const me = state.users.find(u => u.email === state.currentUser.email);

    try {
      await API.createAsset({
        agency_id: agencyId || null,
        added_by_user_id: me?.id || null,
        asset_type: type,
        label,
        url,
        category,
        notes,
      });
      Components.closeModal('add-asset-modal');
      toast(`Asset "${label}" added`, 'success');
      if (state.currentView === 'agencies' && agencyId) {
        renderAgencyDetail(agencyId);
      } else {
        renderAssets(agencyId);
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteAsset(id) {
    try {
      await API.deleteAsset(id);
      const el = document.getElementById(`asset-${id}`);
      if (el) el.remove();
      toast('Asset removed', 'info');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Creator Capacity (Admin only) ───────────────────────────
  async function renderCapacity() {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    await loadAll();

    const creators = state.users.filter(u => u.role === 'CREATOR');

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Creator Capacity</h1>
          <p>Real-time workload and schedule availability across all Support Success Managers</p>
        </div>
        <button class="btn btn-primary" onclick="App.openSchedulerCapacity()">📊 Schedule Matcher</button>
      </div>
      <div class="content-grid">
        ${creators.map(u => Components.renderCreatorCard(u)).join('')
          || '<div class="empty-state"><div class="empty-icon">👥</div><p>No creators found.</p></div>'}
      </div>
    `;
  }

  // ── Creators list management ───────────────────────────────
  async function renderCreators() {
    const vc = document.getElementById('view-container');
    vc.innerHTML = shimmerPage();
    await loadAll();

    vc.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Creators</h1>
          <p>System operators and workload managers</p>
        </div>
        <button class="btn btn-primary" onclick="App.openCreateUser()">+ Add Creator</button>
      </div>
      <div class="content-grid">
        ${state.users.map(u => `
          <div class="creator-card">
            <div class="creator-card-top">
              <div class="creator-big-avatar" style="background:${Components.avatarColor(u.name)}">${Components.initials(u.name)}</div>
              <div style="flex:1;min-width:0">
                <div class="creator-name">${escHtml(u.name)}</div>
                <div class="creator-email">${escHtml(u.email)}</div>
                ${Components.statusBadge(u.role)}
              </div>
              <button class="btn btn-danger btn-sm btn-icon" onclick="App.deleteUser(${u.id})">🗑</button>
            </div>
            <div class="flex-gap" style="font-size:0.8rem;color:var(--text-secondary)">
              <span>🛠️ ${u.active_bundles || 0} active request(s)</span>
              <span>&bull;</span>
              <span>✅ ${u.open_tasks || 0} open task(s)</span>
            </div>
          </div>
        `).join('') || '<div class="empty-state"><div class="empty-icon">👥</div><p>No users yet.</p></div>'}
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // ── ACTIONS ───────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────

  async function updateTaskStatus(taskId, newStatus) {
    try {
      await API.updateTask(taskId, { status: newStatus });
      toast(`Task marked ${newStatus.replace('_',' ')}`, 'success');
      handleRoute();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function setServiceRequestStatus(srId, status) {
    try {
      await API.setServiceRequestStatus(srId, status);
      toast(`Request ${status === 'PAUSED' ? 'paused' : 'resumed'}`, 'success');
      handleRoute();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteServiceRequest(id) {
    if (!confirm('Delete this service request and all its routine rules?')) return;
    try {
      await API.deleteServiceRequest(id);
      toast('Service request deleted', 'info');
      handleRoute();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteUser(id) {
    if (!confirm('Remove this creator?')) return;
    try {
      await API.deleteUser(id);
      toast('Creator removed', 'info');
      renderCreators();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function generateAllTasks() {
    try {
      const result = await API.generateTasks();
      toast(`Generated ${result.generated} task(s)`, 'success');
      renderTasks();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Hot-Swap Routing ───────────────────────────────────────
  async function openHotSwap(srId, serviceName) {
    state.pendingHotSwapBundleId = srId;
    const users = await API.getUsers();
    Components.openModal(Components.renderHotSwapModal(srId, serviceName, users));
  }

  async function confirmHotSwap(srId) {
    const select = document.getElementById('hotswap-creator-select');
    const creatorId = select?.value;
    if (!creatorId) { toast('Please select a creator', 'error'); return; }
    try {
      const result = await API.hotSwapServiceRequest(srId, creatorId);
      Components.closeModal('hotswap-modal');
      toast(`Re-routed → ${result.routed_to.name}`, 'success');
      handleRoute();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Trigger Manual Pipeline ────────────────────────────────
  function openTrigger(srId, serviceName) {
    state.pendingTriggerBundleId = srId;
    Components.openModal(Components.renderTriggerModal(srId, serviceName));
  }

  async function confirmTrigger(srId) {
    try {
      const result = await API.generateTasks(srId);
      Components.closeModal('trigger-modal');
      toast(`Generated ${result.generated} task(s) for routine`, 'success');
      handleRoute();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Create Client Agency ───────────────────────────────────
  function openCreateAgency() {
    Components.openModal(Components.renderCreateAgencyModal());
  }

  async function submitCreateAgency() {
    const name = document.getElementById('ca-name')?.value.trim();
    if (!name) { toast('Agency name is required', 'error'); return; }
    try {
      await API.createAgency({ name });
      Components.closeModal('create-agency-modal');
      toast(`Agency "${name}" created`, 'success');
      renderAgencies();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteAgency(id) {
    if (!confirm('Delete this agency and all its requests, assets, and chat briefs?')) return;
    try {
      await API.deleteAgency(id);
      toast('Agency deleted', 'info');
      renderAgencies();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Create Service Request ──────────────────────────────────
  async function openCreateServiceRequest(prefilledAgencyId = null) {
    const [agencies, users] = await Promise.all([
      API.getAgencies(),
      API.getUsers()
    ]);
    Components.resetSubProfileCount();
    Components.resetRuleCount();
    Components.openModal(Components.renderCreateServiceRequestModal(agencies, users));
    
    if (prefilledAgencyId) {
      const select = document.getElementById('csr-agency');
      if (select) select.value = prefilledAgencyId;
    }
  }

  async function submitCreateServiceRequest() {
    const agency_id = document.getElementById('csr-agency')?.value;
    const service_name = document.getElementById('csr-name')?.value.trim();
    const day = document.getElementById('csr-day')?.value;
    const time = document.getElementById('csr-time')?.value;
    const creator = document.getElementById('csr-creator')?.value;

    if (!agency_id || !service_name) { toast('Agency and request name are required', 'error'); return; }

    const sub_profiles = [];
    document.querySelectorAll('[id^="sp-name-"]').forEach(el => {
      const idx = el.id.replace('sp-name-', '');
      const urlEl = document.getElementById(`sp-url-${idx}`);
      if (el.value.trim() && urlEl?.value.trim()) {
        sub_profiles.push({ profile_name: el.value.trim(), internal_cms_edit_url: urlEl.value.trim() });
      }
    });

    const routine_rules = [];
    document.querySelectorAll('[id^="rr-type-"]').forEach(el => {
      const idx  = el.id.replace('rr-type-', '');
      const type = el.value;

      let src, cron, instr;

      if (type === 'SOCIAL_MONITOR') {
        const social = Components.collectSocialSource(idx);
        src   = social.source_url;
        cron  = social.cron;
        const steps = Components.collectSteps(idx);
        instr = social.instr_prefix + (steps || '');
      } else {
        src   = document.getElementById(`rr-src-${idx}`)?.value.trim() || null;
        const freq = document.getElementById(`rr-freq-${idx}`)?.value || null;
        cron  = type === 'EVENT_DRIVEN' ? null : Components.freqToCron(freq);
        instr = Components.collectSteps(idx);
      }

      routine_rules.push({ pipeline_type: type, source_url: src || null, cron_interval_expression: cron, execution_instructions: instr });
    });

    try {
      await API.createServiceRequest({
        agency_id,
        service_name,
        status: creator ? 'ASSIGNED' : 'UNASSIGNED',
        assigned_creator_id: creator || null,
        preferred_execution_day: day || null,
        preferred_execution_time: time || null,
        sub_profiles,
        routine_rules,
      });
      Components.closeModal('create-sr-modal');
      toast(`Service Request "${service_name}" created`, 'success');
      if (state.currentView === 'agencies') {
        renderAgencyDetail(agency_id);
      } else {
        renderDashboard();
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Chat Logs Copy-Paste Actions ───────────────────────────
  function openAddChatLog(agencyId) {
    Components.openModal(Components.renderAddChatLogModal(agencyId));
  }

  async function submitCreateChatLog() {
    const sender = document.getElementById('ac-sender')?.value.trim();
    const content = document.getElementById('ac-content')?.value.trim();
    const agencyId = document.getElementById('ac-agency-id')?.value;

    if (!sender || !content || !agencyId) {
      toast('Sender and raw text content are required', 'error');
      return;
    }

    const me = state.users.find(u => u.email === state.currentUser.email);

    try {
      await API.createChatLog(agencyId, {
        sender_name: sender,
        message_content: content,
        added_by_user_id: me?.id || null
      });
      Components.closeModal('add-chat-modal');
      toast('Chat updates pasted successfully', 'success');
      
      if (state.currentView === 'workspace') {
        // Refresh workspace
        const hash = window.location.hash.split('/');
        renderWorkspace(hash[1]);
      } else {
        renderAgencyDetail(agencyId);
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Create User ────────────────────────────────────────────
  function openCreateUser() {
    Components.openModal(Components.renderCreateUserModal());
  }

  async function submitCreateUser() {
    const name  = document.getElementById('cu-name')?.value.trim();
    const email = document.getElementById('cu-email')?.value.trim();
    const role  = document.getElementById('cu-role')?.value;
    if (!name || !email) { toast('Name and email are required', 'error'); return; }
    try {
      await API.createUser({ name, email, role });
      Components.closeModal('create-user-modal');
      toast(`${name} added`, 'success');
      renderCreators();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Capacity Matcher ───────────────────────────────────────
  async function openSchedulerCapacity() {
    const day  = prompt('Preferred execution day (e.g. FRIDAY):', 'FRIDAY');
    if (!day) return;
    const time = prompt('Preferred time (e.g. 17:00):', '17:00');
    if (!time) return;

    try {
      const results = await API.matchSchedule(day, time);
      state.selectedMatchCreator = null;
      Components.openModal(Components.renderSchedulerModal(results, null));
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function selectMatchCreator(creatorId) {
    state.selectedMatchCreator = creatorId;
    document.getElementById('scheduler-selected-creator').value = creatorId;
    document.querySelectorAll('.match-card').forEach(el => {
      el.classList.toggle('selected', el.id === `match-${creatorId}`);
    });
  }

  async function confirmSchedulerAssign() {
    const creatorId = state.selectedMatchCreator;
    const srId  = document.getElementById('scheduler-target-bundle')?.value;
    if (!creatorId) { toast('Please select a creator first', 'error'); return; }
    if (!srId)  {
      Components.closeModal('scheduler-modal');
      toast('Creator noted. Open a request detail and use Re-route to assign.', 'info');
      return;
    }
    try {
      const result = await API.hotSwapServiceRequest(srId, creatorId);
      Components.closeModal('scheduler-modal');
      toast(`Assigned to ${result.routed_to.name}`, 'success');
      handleRoute();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Shimmer placeholder ────────────────────────────────────
  function shimmerPage() {
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="shimmer shimmer-block" style="height:40px;width:40%"></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          ${[1,2,3,4].map(()=>`<div class="shimmer shimmer-block" style="height:90px"></div>`).join('')}
        </div>
        <div class="shimmer shimmer-block" style="height:300px"></div>
      </div>
    `;
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    window.addEventListener('hashchange', handleRoute);
    switchRole('ADMIN'); // Default to Admin simulator view on load
  }

  return {
    init, navigate, switchRole, handleRoute,
    updateTaskStatus, setServiceRequestStatus, deleteServiceRequest, deleteUser, generateAllTasks,
    openHotSwap, confirmHotSwap,
    openTrigger, confirmTrigger,
    openCreateServiceRequest, submitCreateServiceRequest,
    openCreateUser, submitCreateUser,
    openSchedulerCapacity, selectMatchCreator, confirmSchedulerAssign,
    openAddAsset, submitAddAsset, deleteAsset, renderAssets,
    openCreateAgency, submitCreateAgency, deleteAgency,
    openAddChatLog, submitCreateChatLog,
    _bundleFilter: null,
    _taskFilter: null,
  };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
