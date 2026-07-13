/**
 * components.js — Agency Ops UI Component Renderers
 * All functions return HTML strings for innerHTML injection.
 */

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(ts) {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(t) {
  if (!t) return 'N/A';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2,'0')} ${ampm}`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
}

function statusBadge(status) {
  const cls = status ? status.toLowerCase().replace('_','-') : 'pending';
  return `<span class="badge badge-${cls}">${status || 'UNKNOWN'}</span>`;
}

function pipelineChip(type) {
  if (!type) return '';
  const map = {
    'INTERVAL_SCHEDULED': { cls: 'interval',  label: '⏱ Scheduled' },
    'EVENT_DRIVEN':       { cls: 'event',     label: '⚡ Manual Trigger' },
    'SOCIAL_MONITOR':     { cls: 'social',    label: '📱 Social Monitor' },
  };
  const { cls, label } = map[type] || { cls: 'event', label: type };
  return `<span class="pipeline-chip ${cls}">${label}</span>`;
}

function avatarColor(name) {
  const colors = [
    'linear-gradient(135deg,#7c5cfc,#5b21b6)',
    'linear-gradient(135deg,#10b981,#065f46)',
    'linear-gradient(135deg,#f59e0b,#92400e)',
    'linear-gradient(135deg,#38bdf8,#0c4a6e)',
    'linear-gradient(135deg,#ef4444,#7f1d1d)',
  ];
  let h = 0;
  for (const c of (name || '')) h += c.charCodeAt(0);
  return colors[h % colors.length];
}

// ── Parse Markdown Checklist ──────────────────────────────────────────────────

function parseChecklist(markdown) {
  if (!markdown) return [];
  return markdown
    .split('\n')
    .filter(l => l.trim().startsWith('- [ ]') || l.trim().startsWith('- [x]'))
    .map((l, i) => ({
      id: i,
      done: l.trim().startsWith('- [x]'),
      text: l.replace(/^- \[[ x]\] /, '').trim(),
    }));
}

// ── Stat Cards ────────────────────────────────────────────────────────────────

function renderStatCard(icon, value, label, colorClass) {
  return `
    <div class="stat-card">
      <div class="stat-icon ${colorClass}">${icon}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

// ── Asset Library Components ──────────────────────────────────────────────────

const CATEGORY_META = {
  SPOTIFY:  { icon: '🎵', color: 'rgba(30,215,96,0.12)',  text: '#1ed760' },
  NEWS:     { icon: '📰', color: 'rgba(56,189,248,0.12)',  text: '#38bdf8' },
  SPECIALS: { icon: '🍽️', color: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  CMS:      { icon: '🖥️', color: 'rgba(124,92,252,0.12)', text: '#9f80ff' },
  IMAGE:    { icon: '🖼️', color: 'rgba(239,68,68,0.12)',  text: '#f87171' },
  GENERAL:  { icon: '🔗', color: 'rgba(100,100,130,0.15)','text': '#8b8fad' },
};

function categoryMeta(cat) {
  return CATEGORY_META[(cat || '').toUpperCase()] || CATEGORY_META.GENERAL;
}

function renderAssetCard(a, canDelete) {
  const meta = categoryMeta(a.category);
  const isImage = a.asset_type === 'IMAGE';
  const scopeLabel = a.agency_id ? escHtml(a.agency_name || 'Agency') : 'Global';
  const addedBy = a.added_by_name ? `Added by ${escHtml(a.added_by_name)}` : '';

  return `
    <div class="asset-card" id="asset-${a.id}">
      <div class="asset-icon" style="background:${meta.color};color:${meta.text}">${meta.icon}</div>
      <div class="asset-info">
        <div class="asset-label">${escHtml(a.label)}</div>
        <a class="asset-url" href="${escHtml(a.url)}" target="_blank" rel="noopener">${escHtml(a.url)}</a>
        ${a.notes ? `<div class="asset-notes">${escHtml(a.notes)}</div>` : ''}
        <div class="asset-meta">
          <span class="asset-cat-tag" style="background:${meta.color};color:${meta.text}">${escHtml(a.category || 'GENERAL')}</span>
          <span>${isImage ? 'Image' : 'Link'}</span>
          <span>${scopeLabel}</span>
          ${addedBy ? `<span>${addedBy}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${isImage ? `<a href="${escHtml(a.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">View</a>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escHtml(a.url)}')" title="Copy URL">Copy</button>
        ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="App.deleteAsset(${a.id})">Delete</button>` : ''}
      </div>
    </div>
  `;
}

function renderAddAssetModal(agencyId, agencyName) {
  const scopeLabel = agencyId ? `Agency: ${escHtml(agencyName)}` : 'Global Library';
  const categories = Object.keys(CATEGORY_META);
  return `
    <div class="modal-overlay" id="add-asset-modal" onclick="if(event.target===this)Components.closeModal('add-asset-modal')">
      <div class="modal">
        <div class="modal-header">
          <h3>Add Asset to ${scopeLabel}</h3>
          <button class="modal-close" onclick="Components.closeModal('add-asset-modal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Label *</label>
            <input class="form-input" id="aa-label" placeholder="e.g. Spotify Page, Weekly Specials URL" />
          </div>
          <div class="form-group">
            <label class="form-label">URL *</label>
            <input class="form-input" id="aa-url" placeholder="https://..." />
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" id="aa-type">
                <option value="LINK">Link (website / page)</option>
                <option value="IMAGE">Image (direct image URL)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" id="aa-category">
                ${categories.map(c => `<option value="${c}">${CATEGORY_META[c].icon} ${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <input class="form-input" id="aa-notes" placeholder="What is this used for?" />
          </div>
          <input type="hidden" id="aa-agency-id" value="${agencyId || ''}" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('add-asset-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.submitAddAsset()">Add Asset</button>
        </div>
      </div>
    </div>
  `;
}

// ── Service Request Card (formerly Bundle Card) ───────────────────────────────

function renderServiceRequestCard(sr, role, creators) {
  const profileCount = (sr.sub_profiles || []).length;
  const ruleCount    = (sr.routine_rules || []).length;
  const _creators    = creators || window._cachedCreators || [];

  const scheduleHtml = sr.preferred_execution_day
    ? `<span class="meta-item">📅 ${sr.preferred_execution_day} ${fmtTime(sr.preferred_execution_time)}</span>`
    : '';

  // ── Quick-assign inline dropdown (only for ADMIN + UNASSIGNED) ──
  const quickAssignHtml = (role === 'ADMIN' && sr.status === 'UNASSIGNED' && _creators.length > 0) ? `
    <div class="quick-assign-row" onclick="event.stopPropagation()">
      <span style="font-size:0.75rem;color:var(--accent-light);font-weight:600">⚡ Quick Assign</span>
      <select class="quick-assign-select" id="qa-select-${sr.id}"
        onchange="event.stopPropagation();App.quickAssignCreator(${sr.id},this.value)">
        <option value="">— Pick a creator —</option>
        ${_creators.filter(c => c.role === 'CREATOR').map(c =>
          `<option value="${c.id}">${escHtml(c.name)} (${c.active_bundles || 0} active)</option>`
        ).join('')}
      </select>
    </div>
  ` : '';

  const creatorHtml = sr.assigned_creator_id
    ? `<div class="assigned-creator-row">
         <div class="mini-avatar" style="background:${avatarColor(sr.creator_name)}">${initials(sr.creator_name)}</div>
         <span class="assigned-creator-name">${escHtml(sr.creator_name)}</span>
       </div>`
    : quickAssignHtml || `<span class="text-muted">Unassigned</span>`;

  const adminControls = role === 'ADMIN' ? `
    <div style="display:flex;gap:6px;margin-top:12px">
      ${sr.status !== 'PAUSED'
        ? `<button class="btn btn-warning btn-sm" onclick="event.stopPropagation();App.setServiceRequestStatus(${sr.id},'PAUSED')">⏸ Pause</button>`
        : `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();App.setServiceRequestStatus(${sr.id},'ASSIGNED')">▶ Resume</button>`}
      <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();App.openHotSwap(${sr.id},'${escHtml(sr.service_name)}')">🔀 Re-route</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();App.deleteServiceRequest(${sr.id})">🗑</button>
    </div>
  ` : '';

  return `
    <div class="bundle-card" onclick="App.navigate('service_requests/${sr.id}')">
      <div class="bundle-card-top">
        <div>
          <div class="bundle-card-name">${escHtml(sr.service_name)}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">🏢 ${escHtml(sr.agency_name)}</div>
          <div style="margin-top:5px">${statusBadge(sr.status)}</div>
        </div>
      </div>
      <div class="bundle-card-meta">
        <span class="meta-item">👤 ${profileCount} profiles</span>
        <span class="meta-item">📋 ${ruleCount} routines</span>
        ${scheduleHtml}
      </div>
      <div class="bundle-card-footer">
        ${creatorHtml}
        <button class="btn btn-secondary btn-sm"
          onclick="event.stopPropagation();App.openTrigger(${sr.id},'${escHtml(sr.service_name)}')">
          ⚡ Trigger
        </button>
      </div>
      ${adminControls}
    </div>
  `;
}

// ── Task Item ─────────────────────────────────────────────────────────────────

function renderTaskItem(t, role) {
  const st = (t.status || 'PENDING').toLowerCase().replace('_','-');
  const actionBtns = (role === 'CREATOR' || role === 'ADMIN') ? (() => {
    if (t.status === 'PENDING')      return `<button class="btn btn-warning btn-sm" onclick="event.stopPropagation();App.updateTaskStatus(${t.id},'IN_PROGRESS')">▶ Start</button>`;
    if (t.status === 'IN_PROGRESS')  return `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();App.updateTaskStatus(${t.id},'COMPLETED')">✓ Complete</button>`;
    return '';
  })() : '';

  return `
    <div class="task-item ${st}" onclick="App.navigate('workspace/${t.id}')">
      <div class="task-info">
        <div class="task-agency">🏢 ${escHtml(t.agency_name || 'Unknown Agency')}</div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px">${escHtml(t.service_name || 'Service Request')}</div>
        <div class="task-meta">
          <span class="task-meta-item">📅 ${fmtDateTime(t.scheduled_for_timestamp)}</span>
          <span class="task-meta-item">👤 ${t.creator_name || 'Unassigned'}</span>
          ${statusBadge(t.status)}
        </div>
      </div>
      <div class="task-actions">
        ${actionBtns}
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();App.navigate('workspace/${t.id}')">→</button>
      </div>
    </div>
  `;
}

// ── Creator Capacity Card ─────────────────────────────────────────────────────

function renderCreatorCard(u) {
  const maxBundles = 8;
  const fillPct = Math.min(100, Math.round((u.active_bundles / maxBundles) * 100));
  const fillClass = fillPct >= 75 ? 'danger' : fillPct >= 50 ? 'warning' : '';

  return `
    <div class="creator-card">
      <div class="creator-card-top">
        <div class="creator-big-avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="creator-name">${escHtml(u.name)}</div>
          <div class="creator-email">${escHtml(u.email)}</div>
          ${statusBadge(u.role)}
        </div>
      </div>
      <div class="capacity-bar-wrap">
        <div class="capacity-bar-label">
          <span>Service Requests Workload</span>
          <span>${u.active_bundles} / ${maxBundles} active</span>
        </div>
        <div class="capacity-bar">
          <div class="capacity-bar-fill ${fillClass}" style="width:${fillPct}%"></div>
        </div>
      </div>
      <div class="capacity-bar-wrap">
        <div class="capacity-bar-label">
          <span>Open Tasks</span>
          <span>${u.open_tasks}</span>
        </div>
        <div class="capacity-bar">
          <div class="capacity-bar-fill ${u.open_tasks > 6 ? 'danger' : ''}" style="width:${Math.min(100, u.open_tasks * 10)}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ── Capacity Match Card ───────────────────────────────────────────────────────

function renderMatchCard(creator, rank, selectedId) {
  const selected = creator.id === selectedId ? 'selected' : '';
  const rankClass = rank === 1 ? 'rank-1' : '';
  const labelClass = {
    'Open Slot':   'match-label-open',
    'Near-Match':  'match-label-near',
    'Fully Booked':'match-label-booked',
  }[creator.label] || 'match-label-open';

  return `
    <div class="match-card ${selected}" onclick="App.selectMatchCreator(${creator.id})" id="match-${creator.id}">
      <div class="match-rank ${rankClass}">#${rank}</div>
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <div class="creator-big-avatar" style="width:36px;height:36px;font-size:0.8rem;background:${avatarColor(creator.name)}">${initials(creator.name)}</div>
        <div class="match-info">
          <div class="match-name">${escHtml(creator.name)}</div>
          <div class="match-stats">${creator.active_bundles} requests · ${creator.open_tasks} open tasks · Score: ${creator.score}</div>
        </div>
      </div>
      <span class="match-label-badge ${labelClass}">${creator.label}</span>
    </div>
  `;
}

// ── Checklist Renderer ────────────────────────────────────────────────────────

function renderChecklist(items, taskId) {
  if (!items || items.length === 0) {
    return '<p class="text-muted">No checklist items found for this routine.</p>';
  }
  return `
    <div class="checklist" id="checklist-${taskId}">
      ${items.map(item => `
        <div class="checklist-item ${item.done ? 'done' : ''}" id="ci-${taskId}-${item.id}"
          onclick="Components.toggleChecklistItem(${taskId}, ${item.id})">
          <div class="check-box">${item.done ? '✓' : ''}</div>
          <div class="check-label">${escHtml(item.text)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function toggleChecklistItem(taskId, itemId) {
  const el = document.getElementById(`ci-${taskId}-${itemId}`);
  if (!el) return;
  el.classList.toggle('done');
  const box = el.querySelector('.check-box');
  const isDone = el.classList.contains('done');
  box.textContent = isDone ? '✓' : '';

  // Update progress
  const cl = document.getElementById(`checklist-${taskId}`);
  if (!cl) return;
  const total = cl.querySelectorAll('.checklist-item').length;
  const done  = cl.querySelectorAll('.checklist-item.done').length;
  const prog = document.getElementById(`progress-${taskId}`);
  if (prog) prog.textContent = `${done} / ${total} complete`;
}

// ── Time Block Planner (Weekly Schedule Dashboard) ───────────────────────────

function renderTimeBlockPlanner(myRequests, myTasks) {
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  
  const timelineHtml = days.map(day => {
    const dayRequests = myRequests.filter(r => (r.preferred_execution_day || '').toUpperCase() === day);
    if (dayRequests.length === 0) return '';
    
    return `
      <div class="planner-day-section">
        <div class="planner-day-header">
          <span>📅 ${day}</span>
          <small>${dayRequests.length} Scheduled Slot(s)</small>
        </div>
        <div class="planner-slots">
          ${dayRequests.map(r => {
            const currentTask = myTasks.find(t => t.service_request_id === r.id && t.status !== 'COMPLETED');
            const status = currentTask ? currentTask.status : 'NO_ACTIVE_TASK';
            const badgeHtml = currentTask ? statusBadge(currentTask.status) : `<span class="badge badge-paused">No active task</span>`;
            const taskActionHtml = currentTask 
              ? `onclick="App.navigate('workspace/${currentTask.id}')"` 
              : `onclick="App.navigate('agencies/${r.agency_id}')"`;
            
            return `
              <div class="planner-slot-card ${status.toLowerCase()}" ${taskActionHtml}>
                <div class="planner-slot-time">⏰ ${fmtTime(r.preferred_execution_time) || 'Flexible'}</div>
                <div class="planner-slot-name">${escHtml(r.agency_name)}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">${escHtml(srLabelFix(r.service_name))}</div>
                <div class="planner-slot-meta">
                  ${badgeHtml}
                  <small style="color:var(--accent-light)">View Workspace →</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="planner-timeline">
      ${timelineHtml || `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No scheduled service requests assigned to you this week.</p>
        </div>
      `}
    </div>
  `;
}

function srLabelFix(name) {
  return name.replace('Sync', 'Update').replace('sync', 'update');
}

// ── Chat Logs Feed Component ──────────────────────────────────────────────────

function renderChatLogsFeed(logs, agencyId) {
  return `
    <div class="workspace-chat-widget">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-size:0.88rem;font-weight:700">💬 Client Chat Feed</h3>
        <button class="btn btn-secondary btn-sm" onclick="App.openAddChatLog(${agencyId})">Paste Text</button>
      </div>
      <div class="chat-feed" style="max-height:280px">
        ${logs.length ? logs.map(l => `
          <div class="chat-bubble-card" style="margin-bottom:8px">
            <div class="chat-bubble-header">
              <strong>${escHtml(l.sender_name)}</strong>
              <span>${fmtDateTime(l.created_at)}</span>
            </div>
            <div class="chat-bubble-body">${escHtml(l.message_content)}</div>
          </div>
        `).join('') : `
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.75rem">
            No client updates pasted yet. Copy Slack/WhatsApp messages here.
          </div>
        `}
      </div>
    </div>
  `;
}

// ── Hot-Swap Modal ────────────────────────────────────────────────────────────

function renderHotSwapModal(srId, serviceName, creators) {
  const options = creators
    .filter(c => c.role === 'CREATOR')
    .map(c => `<option value="${c.id}">${escHtml(c.name)} (${c.active_bundles} requests, ${c.open_tasks} tasks)</option>`)
    .join('');

  return `
    <div class="modal-overlay" id="hotswap-modal" onclick="if(event.target===this)Components.closeModal('hotswap-modal')">
      <div class="modal">
        <div class="modal-header">
          <h3>Re-route: ${escHtml(serviceName)}</h3>
          <button class="modal-close" onclick="Components.closeModal('hotswap-modal')">x</button>
        </div>
        <div class="modal-body">
          <p class="text-muted">Select a creator to instantly re-route all active tasks for this request. Completed tasks are preserved for audit.</p>
          <div class="form-group">
            <label class="form-label">New Assigned Creator</label>
            <select class="form-select" id="hotswap-creator-select">
              <option value="">Select a Creator</option>
              ${options}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('hotswap-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.confirmHotSwap(${srId})">Confirm Re-route</button>
        </div>
      </div>
    </div>
  `;
}

// ── Create Agency Modal ───────────────────────────────────────────────────────

function renderCreateAgencyModal() {
  return `
    <div class="modal-overlay" id="create-agency-modal" onclick="if(event.target===this)Components.closeModal('create-agency-modal')">
      <div class="modal">
        <div class="modal-header">
          <h3>🏢 New Client Agency</h3>
          <button class="modal-close" onclick="Components.closeModal('create-agency-modal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Agency Name *</label>
            <input class="form-input" id="ca-name" placeholder="e.g. Paramount Talent Group" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('create-agency-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.submitCreateAgency()">🏢 Create Agency</button>
        </div>
      </div>
    </div>
  `;
}

// ── Create Service Request Modal (formerly Create Bundle Modal) ───────────────

function renderCreateServiceRequestModal(agencies, creators) {
  const agencyOptions = agencies.map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
  const creatorOptions = creators
    .filter(c => c.role === 'CREATOR')
    .map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`)
    .join('');

  const days = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];

  return `
    <div class="modal-overlay" id="create-sr-modal" onclick="if(event.target===this)Components.closeModal('create-sr-modal')">
      <div class="modal modal-wide">
        <div class="modal-header">
          <h3>🛠️ New Service Request</h3>
          <button class="modal-close" onclick="Components.closeModal('create-sr-modal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Client Agency *</label>
              <select class="form-select" id="csr-agency">
                <option value="">Select Agency</option>
                ${agencyOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Service Request Name *</label>
              <input class="form-input" id="csr-name" placeholder="e.g. Weekly Profile Update" />
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Preferred Execution Day</label>
              <select class="form-select" id="csr-day">
                <option value="">Select Day</option>
                ${days.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Preferred Time</label>
              <input class="form-input" type="time" id="csr-time" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Assign Creator (optional)</label>
            <select class="form-select" id="csr-creator">
              <option value="">Leave Unassigned</option>
              ${creatorOptions}
            </select>
          </div>

          <div class="divider"></div>
          <div class="flex-between" style="margin-bottom:10px">
            <strong style="font-size:0.88rem">Sub-Profiles / Talent</strong>
            <button class="btn btn-secondary btn-sm" onclick="Components.addSubProfileRow()">+ Add Profile</button>
          </div>
          <div id="sub-profiles-list" style="display:flex;flex-direction:column;gap:8px">
            ${subProfileRow(0)}
          </div>

          <div class="divider"></div>
          <div class="flex-between" style="margin-bottom:6px">
            <div>
              <strong style="font-size:0.88rem">Routine Rules</strong>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px">
                A routine rule tells the team <em>what to do</em>, <em>how often</em>, and <em>where to find the content</em>. Each rule becomes a recurring task the team can check off.
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="Components.addRoutineRuleRow()" style="flex-shrink:0;margin-left:12px">+ Add Rule</button>
          </div>
          <div id="routine-rules-list" style="display:flex;flex-direction:column;gap:10px">
            <div id="rr-empty-hint" style="text-align:center;padding:18px 12px;border:1px dashed var(--border);border-radius:var(--radius-md);color:var(--text-muted);font-size:0.8rem">
              No rules yet — click <strong>+ Add Rule</strong> to define how often the team should run this service.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('create-sr-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.submitCreateServiceRequest()">🛠️ Create Request</button>
        </div>
      </div>
    </div>
  `;
}

let _subProfileCount = 1;
let _ruleCount = 1;

function subProfileRow(idx) {
  return `
    <div id="sp-row-${idx}" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center">
      <input class="form-input" placeholder="Profile name" id="sp-name-${idx}" />
      <input class="form-input" placeholder="CMS edit URL" id="sp-url-${idx}" />
      <button class="btn btn-danger btn-icon btn-sm" onclick="document.getElementById('sp-row-${idx}').remove()">✕</button>
    </div>
  `;
}

// ── Frequency preset → cron expression converter ─────────────────────────────

const FREQ_PRESETS = [
  { value: '',              label: 'Select frequency…' },
  // x times a week
  { value: '1x_week',      label: '1× a week  (every Monday)' },
  { value: '2x_week',      label: '2× a week  (Mon & Thu)' },
  { value: '3x_week',      label: '3× a week  (Mon, Wed & Fri)' },
  // specific days
  { value: 'every_mon',    label: 'Every Monday' },
  { value: 'every_tue',    label: 'Every Tuesday' },
  { value: 'every_wed',    label: 'Every Wednesday' },
  { value: 'every_thu',    label: 'Every Thursday' },
  { value: 'every_fri',    label: 'Every Friday' },
  { value: 'every_sat',    label: 'Every Saturday' },
  { value: 'every_sun',    label: 'Every Sunday' },
  // monthly
  { value: 'monthly_1st',  label: '1st of every month' },
  { value: 'monthly_15th', label: '15th of every month' },
  // daily
  { value: 'daily',        label: 'Every day' },
];

function freqToCron(value) {
  // Returns a cron expression string or null for EVENT_DRIVEN
  const map = {
    '1x_week':      '0 9 * * 1',
    '2x_week':      '0 9 * * 1,4',
    '3x_week':      '0 9 * * 1,3,5',
    'every_mon':    '0 9 * * 1',
    'every_tue':    '0 9 * * 2',
    'every_wed':    '0 9 * * 3',
    'every_thu':    '0 9 * * 4',
    'every_fri':    '0 9 * * 5',
    'every_sat':    '0 9 * * 6',
    'every_sun':    '0 9 * * 0',
    'monthly_1st':  '0 9 1 * *',
    'monthly_15th': '0 9 15 * *',
    'daily':        '0 9 * * *',
  };
  return map[value] || null;
}

// ── Social media platform definitions ────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram',  icon: '📸' },
  { id: 'linkedin',  label: 'LinkedIn',   icon: '💼' },
  { id: 'tiktok',    label: 'TikTok',     icon: '🎵' },
  { id: 'twitter',   label: 'X / Twitter',icon: '𝕏' },
  { id: 'facebook',  label: 'Facebook',   icon: '📘' },
  { id: 'youtube',   label: 'YouTube',    icon: '▶️' },
];

let _stepCounters = {};

function routineRuleRow(idx) {
  const presetOptions = FREQ_PRESETS
    .map(p => `<option value="${p.value}">${p.label}</option>`)
    .join('');

  const platformBtns = SOCIAL_PLATFORMS.map(p => `
    <button type="button" class="platform-btn" id="rr-plat-btn-${idx}-${p.id}"
      onclick="Components.selectPlatform(${idx},'${p.id}')">
      <span class="platform-icon">${p.icon}</span>
      <span class="platform-label">${p.label}</span>
    </button>
  `).join('');

  _stepCounters[idx] = 1;

  return `
    <div id="rr-row-${idx}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;display:flex;flex-direction:column;gap:14px;background:var(--bg-elevated)">

      <!-- Run type toggle (3 options) -->
      <div class="form-group">
        <label class="form-label">How does this routine get triggered?</label>
        <div class="rule-type-toggle rule-type-toggle-3" id="rr-toggle-${idx}">
          <button type="button" class="rule-type-btn active" id="rr-btn-scheduled-${idx}"
            onclick="Components.selectRuleType(${idx},'INTERVAL_SCHEDULED')">
            <span class="rule-type-icon">📅</span>
            <span class="rule-type-label">Runs on a schedule</span>
            <span class="rule-type-sub">Auto-runs on set days</span>
          </button>
          <button type="button" class="rule-type-btn" id="rr-btn-social-${idx}"
            onclick="Components.selectRuleType(${idx},'SOCIAL_MONITOR')">
            <span class="rule-type-icon">📱</span>
            <span class="rule-type-label">Watches social media</span>
            <span class="rule-type-sub">Triggers when they post</span>
          </button>
          <button type="button" class="rule-type-btn" id="rr-btn-event-${idx}"
            onclick="Components.selectRuleType(${idx},'EVENT_DRIVEN')">
            <span class="rule-type-icon">⚡</span>
            <span class="rule-type-label">Manual trigger only</span>
            <span class="rule-type-sub">You kick it off yourself</span>
          </button>
        </div>
        <input type="hidden" id="rr-type-${idx}" value="INTERVAL_SCHEDULED" />
      </div>

      <!-- Frequency (shown for INTERVAL_SCHEDULED) -->
      <div class="form-group" id="rr-freq-grp-${idx}">
        <label class="form-label">How often should this run?</label>
        <select class="form-select" id="rr-freq-${idx}" onchange="Components.onFreqChange(${idx})">
          ${presetOptions}
        </select>
        <div id="rr-freq-hint-${idx}" style="margin-top:5px;font-size:0.73rem;color:var(--text-muted);display:none"></div>
      </div>

      <!-- Social media panel (shown for SOCIAL_MONITOR) -->
      <div id="rr-social-grp-${idx}" style="display:none;flex-direction:column;gap:12px">
        <div class="form-group">
          <label class="form-label">Which platform do they post on?</label>
          <div class="platform-picker" id="rr-platform-picker-${idx}">
            ${platformBtns}
          </div>
          <input type="hidden" id="rr-platform-${idx}" value="" />
        </div>

        <div class="form-group">
          <label class="form-label">What to watch <span style="color:var(--text-muted);font-weight:400">(Instagram only)</span></label>
          <div style="display:flex;gap:8px" id="rr-watch-type-grp-${idx}">
            <label class="watch-type-option">
              <input type="radio" name="rr-watch-${idx}" id="rr-watch-feed-${idx}" value="Feed" checked /> Feed posts
            </label>
            <label class="watch-type-option">
              <input type="radio" name="rr-watch-${idx}" id="rr-watch-stories-${idx}" value="Stories" /> Stories
            </label>
            <label class="watch-type-option">
              <input type="radio" name="rr-watch-${idx}" id="rr-watch-both-${idx}" value="Feed & Stories" /> Both
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Their handle or profile URL</label>
          <input class="form-input" placeholder="e.g. @clienthandle or https://instagram.com/clienthandle" id="rr-social-handle-${idx}" />
        </div>

        <div class="form-group">
          <label class="form-label">How often should we check for new posts?</label>
          <select class="form-select" id="rr-social-freq-${idx}" onchange="Components.onSocialFreqChange(${idx})">
            ${presetOptions}
          </select>
          <div id="rr-social-freq-hint-${idx}" style="margin-top:5px;font-size:0.73rem;color:var(--text-muted);display:none"></div>
        </div>
      </div>

      <!-- Source link (shown for INTERVAL_SCHEDULED / EVENT_DRIVEN) -->
      <div class="form-group" id="rr-src-grp-${idx}">
        <label class="form-label">Client page or content link <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
        <input class="form-input" placeholder="Paste the link the team needs to work from (e.g. Spotify page, menu page…)" id="rr-src-${idx}" />
      </div>

      <!-- Step builder -->
      <div class="form-group">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <label class="form-label" style="margin:0">Steps the team needs to complete</label>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Components.addStep(${idx})">+ Add Step</button>
        </div>
        <div id="rr-steps-${idx}" style="display:flex;flex-direction:column;gap:6px">
          <div id="rr-step-${idx}-0" style="display:flex;align-items:center;gap:8px">
            <span style="font-size:0.75rem;color:var(--text-muted);width:20px;text-align:right;flex-shrink:0">1.</span>
            <input class="form-input" placeholder="e.g. Open the Spotify page and update bio" id="rr-step-text-${idx}-0" style="flex:1" />
            <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="Components.removeStep(${idx},0)" title="Remove step">✕</button>
          </div>
        </div>
      </div>

      <div style="text-align:right;padding-top:4px;border-top:1px solid var(--border)">
        <button class="btn btn-danger btn-sm" onclick="document.getElementById('rr-row-${idx}').remove()">🗑 Remove This Rule</button>
      </div>
    </div>
  `;
}

function selectRuleType(idx, type) {
  document.getElementById(`rr-type-${idx}`).value = type;

  const freqGrp   = document.getElementById(`rr-freq-grp-${idx}`);
  const socialGrp = document.getElementById(`rr-social-grp-${idx}`);
  const srcGrp    = document.getElementById(`rr-src-grp-${idx}`);

  // Reset all buttons
  ['scheduled','social','event'].forEach(k => {
    document.getElementById(`rr-btn-${k}-${idx}`)?.classList.remove('active');
  });

  if (type === 'INTERVAL_SCHEDULED') {
    document.getElementById(`rr-btn-scheduled-${idx}`)?.classList.add('active');
    if (freqGrp)   { freqGrp.style.display = ''; }
    if (socialGrp) { socialGrp.style.display = 'none'; }
    if (srcGrp)    { srcGrp.style.display = ''; }
  } else if (type === 'SOCIAL_MONITOR') {
    document.getElementById(`rr-btn-social-${idx}`)?.classList.add('active');
    if (freqGrp)   { freqGrp.style.display = 'none'; }
    if (socialGrp) { socialGrp.style.display = 'flex'; }
    if (srcGrp)    { srcGrp.style.display = 'none'; }
  } else { // EVENT_DRIVEN
    document.getElementById(`rr-btn-event-${idx}`)?.classList.add('active');
    if (freqGrp)   { freqGrp.style.display = 'none'; }
    if (socialGrp) { socialGrp.style.display = 'none'; }
    if (srcGrp)    { srcGrp.style.display = ''; }
  }
}

function selectPlatform(ruleIdx, platformId) {
  // Update hidden value
  document.getElementById(`rr-platform-${ruleIdx}`).value = platformId;
  // Toggle button active states
  SOCIAL_PLATFORMS.forEach(p => {
    document.getElementById(`rr-plat-btn-${ruleIdx}-${p.id}`)?.classList.toggle('active', p.id === platformId);
  });
  // Show/hide the "Feed/Stories/Both" option — only relevant for Instagram
  const watchGrp = document.getElementById(`rr-watch-type-grp-${ruleIdx}`);
  if (watchGrp) watchGrp.style.display = platformId === 'instagram' ? 'flex' : 'none';
}

function onSocialFreqChange(idx) {
  const val  = document.getElementById(`rr-social-freq-${idx}`)?.value;
  const hint = document.getElementById(`rr-social-freq-hint-${idx}`);
  if (!hint) return;
  const cron = freqToCron(val);
  if (cron) {
    hint.textContent = `Will check: ${cron}`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

/** Collect social media rule fields and return { source_url, cron, instr_prefix } */
function collectSocialSource(idx) {
  const platform = document.getElementById(`rr-platform-${idx}`)?.value || '';
  const handle   = document.getElementById(`rr-social-handle-${idx}`)?.value.trim() || '';
  const watchVal = document.querySelector(`input[name="rr-watch-${idx}"]:checked`)?.value || 'Feed';
  const freq     = document.getElementById(`rr-social-freq-${idx}`)?.value || '';
  const cron     = freqToCron(freq);

  const platformMeta = SOCIAL_PLATFORMS.find(p => p.id === platform);
  const platformLabel = platformMeta ? `${platformMeta.icon} ${platformMeta.label}` : platform;

  // Encode source as a clean URL-like reference
  const source_url = handle || null;

  // Build a header that will appear at the top of the checklist
  const instr_prefix = platform
    ? `📱 Social Monitor — ${platformLabel}${platform === 'instagram' ? ` (${watchVal})` : ''}\nProfile: ${handle}\n\n`
    : '';

  return { source_url, cron, instr_prefix };
}

function addStep(ruleIdx) {
  if (!_stepCounters[ruleIdx]) _stepCounters[ruleIdx] = 1;
  const stepIdx = _stepCounters[ruleIdx]++;
  const container = document.getElementById(`rr-steps-${ruleIdx}`);
  if (!container) return;
  const stepNum = container.children.length + 1;
  const div = document.createElement('div');
  div.id = `rr-step-${ruleIdx}-${stepIdx}`;
  div.style.cssText = 'display:flex;align-items:center;gap:8px';
  div.innerHTML = `
    <span style="font-size:0.75rem;color:var(--text-muted);width:20px;text-align:right;flex-shrink:0">${stepNum}.</span>
    <input class="form-input" placeholder="Describe what needs to be done…" id="rr-step-text-${ruleIdx}-${stepIdx}" style="flex:1" />
    <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="Components.removeStep(${ruleIdx},${stepIdx})" title="Remove step">✕</button>
  `;
  container.appendChild(div);
  // Renumber all steps
  Components.renumberSteps(ruleIdx);
  document.getElementById(`rr-step-text-${ruleIdx}-${stepIdx}`)?.focus();
}

function removeStep(ruleIdx, stepIdx) {
  const el = document.getElementById(`rr-step-${ruleIdx}-${stepIdx}`);
  if (el) el.remove();
  Components.renumberSteps(ruleIdx);
}

function renumberSteps(ruleIdx) {
  const container = document.getElementById(`rr-steps-${ruleIdx}`);
  if (!container) return;
  [...container.children].forEach((row, i) => {
    const numSpan = row.querySelector('span');
    if (numSpan) numSpan.textContent = `${i + 1}.`;
  });
}

/** Collect steps from a rule row and produce a markdown checklist string */
function collectSteps(ruleIdx) {
  const container = document.getElementById(`rr-steps-${ruleIdx}`);
  if (!container) return null;
  const lines = [...container.querySelectorAll('input[id^="rr-step-text-"]')]
    .map(el => el.value.trim())
    .filter(Boolean)
    .map(t => `- [ ] ${t}`);
  return lines.length ? lines.join('\n') : null;
}

function addSubProfileRow() {
  const list = document.getElementById('sub-profiles-list');
  if (!list) return;
  const idx = _subProfileCount++;
  const div = document.createElement('div');
  div.innerHTML = subProfileRow(idx);
  list.appendChild(div.firstElementChild);
}

function addRoutineRuleRow() {
  const list = document.getElementById('routine-rules-list');
  if (!list) return;
  // Hide the empty-state hint once the first rule is added
  const hint = document.getElementById('rr-empty-hint');
  if (hint) hint.style.display = 'none';
  const idx = _ruleCount++;
  const div = document.createElement('div');
  div.innerHTML = routineRuleRow(idx);
  list.appendChild(div.firstElementChild);
}

function onRuleTypeChange(idx) {
  // legacy — kept for backwards-compat; selectRuleType is now primary
  const type = document.getElementById(`rr-type-${idx}`)?.value;
  selectRuleType(idx, type);
}

function onFreqChange(idx) {
  const val  = document.getElementById(`rr-freq-${idx}`)?.value;
  const hint = document.getElementById(`rr-freq-hint-${idx}`);
  if (!hint) return;
  const cron = freqToCron(val);
  if (cron) {
    hint.textContent = `Scheduled as: ${cron}`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

// ── Create User Modal ─────────────────────────────────────────────────────────

function renderCreateUserModal() {
  return `
    <div class="modal-overlay" id="create-user-modal" onclick="if(event.target===this)Components.closeModal('create-user-modal')">
      <div class="modal">
        <div class="modal-header">
          <h3>👤 Add Creator</h3>
          <button class="modal-close" onclick="Components.closeModal('create-user-modal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-input" id="cu-name" placeholder="e.g. Alex Rivera" />
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input class="form-input" type="email" id="cu-email" placeholder="alex@agencyops.io" />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="cu-role">
              <option value="CREATOR">Creator (Support Success Manager)</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('create-user-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.submitCreateUser()">Add Creator</button>
        </div>
      </div>
    </div>
  `;
}

// ── Add Chat Log Modal [NEW] ──────────────────────────────────────────────────

function renderAddChatLogModal(agencyId) {
  return `
    <div class="modal-overlay" id="add-chat-modal" onclick="if(event.target===this)Components.closeModal('add-chat-modal')">
      <div class="modal">
        <div class="modal-header">
          <h3>💬 Paste Client Group Chat Updates</h3>
          <button class="modal-close" onclick="Components.closeModal('add-chat-modal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Sender Name *</label>
            <input class="form-input" id="ac-sender" value="Client Team" placeholder="e.g. Client Rep, Jordan (Admin)" />
          </div>
          <div class="form-group">
            <label class="form-label">Raw Chat Message Content *</label>
            <textarea class="chat-paste-area" id="ac-content" placeholder="Paste the text messages, WhatsApp dump, or Slack block here..."></textarea>
          </div>
          <input type="hidden" id="ac-agency-id" value="${agencyId}" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('add-chat-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.submitCreateChatLog()">💾 Save Chat Log</button>
        </div>
      </div>
    </div>
  `;
}

// ── Trigger Confirm Modal ─────────────────────────────────────────────────────

function renderTriggerModal(srId, serviceName) {
  return `
    <div class="modal-overlay" id="trigger-modal" onclick="if(event.target===this)Components.closeModal('trigger-modal')">
      <div class="modal">
        <div class="modal-header">
          <h3>⚡ Trigger Pipeline</h3>
          <button class="modal-close" onclick="Components.closeModal('trigger-modal')">✕</button>
        </div>
        <div class="modal-body">
          <p>Generate a new task for request <strong>${escHtml(serviceName)}</strong> right now?</p>
          <p class="text-muted" style="margin-top:6px">This will create one <code>PENDING</code> task from all active routine rules assigned to this request.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('trigger-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.confirmTrigger(${srId})">⚡ Generate Task</button>
        </div>
      </div>
    </div>
  `;
}

// ── Scheduler Match Modal ─────────────────────────────────────────────────────

function renderSchedulerModal(results, srId) {
  const cards = results.map((c, i) => renderMatchCard(c, i + 1, null)).join('');
  return `
    <div class="modal-overlay" id="scheduler-modal" onclick="if(event.target===this)Components.closeModal('scheduler-modal')">
      <div class="modal modal-wide">
        <div class="modal-header">
          <h3>📊 Capacity Match Results</h3>
          <button class="modal-close" onclick="Components.closeModal('scheduler-modal')">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="margin-bottom:12px">Creators ranked by suitability. Select one to assign.</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${cards || '<p class="text-muted">No creators available.</p>'}
          </div>
          <input type="hidden" id="scheduler-selected-creator" value="" />
          <input type="hidden" id="scheduler-target-bundle" value="${srId || ''}" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('scheduler-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="App.confirmSchedulerAssign()">✅ Assign Selected Creator</button>
        </div>
      </div>
    </div>
  `;
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function openModal(html) {
  const mount = document.getElementById('modal-mount');
  if (mount) mount.innerHTML = html;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── XSS helper ────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.escHtml = escHtml;
window.Components = {
  renderStatCard, renderServiceRequestCard, renderTaskItem, renderCreatorCard,
  renderMatchCard, renderChecklist, toggleChecklistItem, parseChecklist,
  renderHotSwapModal, renderCreateServiceRequestModal, renderCreateUserModal,
  renderCreateAgencyModal, renderAddChatLogModal,
  renderTriggerModal, renderSchedulerModal,
  renderAssetCard, renderAddAssetModal, categoryMeta,
  renderTimeBlockPlanner, renderChatLogsFeed,
  addSubProfileRow, addRoutineRuleRow, onRuleTypeChange, onFreqChange, freqToCron,
  selectRuleType, addStep, removeStep, renumberSteps, collectSteps,
  selectPlatform, onSocialFreqChange, collectSocialSource,
  openModal, closeModal,
  fmtDate, fmtDateTime, fmtTime, initials, statusBadge, pipelineChip, avatarColor,
  subProfileRow, routineRuleRow,
  get subProfileCount() { return _subProfileCount; },
  get ruleCount() { return _ruleCount; },
  resetSubProfileCount() { _subProfileCount = 1; },
  resetRuleCount() { _ruleCount = 1; },
};
