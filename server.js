/**
 * server.js — Agency Ops Express API Server
 * Relational tables: agencies, service_requests, agency_sub_profiles, routine_rules, agency_tasks, agency_assets, agency_chat_logs
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(ts) {
  return ts ? new Date(ts).toISOString() : null;
}

function parseCronToNextTimestamp(expr) {
  const now = new Date();
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(Date.now() + 7 * 86400000).toISOString();

  const [min, hour, , , dow] = parts;
  const targetHour = hour === '*' ? 0 : parseInt(hour, 10);
  const targetMin  = min  === '*' ? 0 : parseInt(min,  10);
  const targetDow  = dow  === '*' ? -1 : parseInt(dow, 10); // 0=Sun..6=Sat

  const d = new Date();
  d.setHours(targetHour, targetMin, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);

  if (targetDow !== -1) {
    while (d.getDay() !== targetDow) {
      d.setDate(d.getDate() + 1);
    }
  }
  return d.toISOString();
}

// ─── USERS ────────────────────────────────────────────────────────────────────

// GET /api/users — list creators with workload stats
app.get('/api/users', async (req, res) => {
  try {
    const { rows: users } = await db.query('SELECT * FROM users ORDER BY id');
    const { rows: requestCounts } = await db.query(`
      SELECT assigned_creator_id, COUNT(*) as sr_count
      FROM service_requests
      WHERE status = 'ASSIGNED'
      GROUP BY assigned_creator_id
    `);
    const { rows: taskCounts } = await db.query(`
      SELECT assigned_to_creator_id, COUNT(*) as task_count
      FROM agency_tasks
      WHERE status IN ('PENDING','IN_PROGRESS')
      GROUP BY assigned_to_creator_id
    `);

    const requestMap = Object.fromEntries(requestCounts.map(r => [r.assigned_creator_id, parseInt(r.sr_count)]));
    const taskMap = Object.fromEntries(taskCounts.map(r => [r.assigned_to_creator_id, parseInt(r.task_count)]));

    const enriched = users.map(u => ({
      ...u,
      active_bundles: requestMap[u.id] || 0, // Keep active_bundles key in JSON for frontend backward-compatibility
      open_tasks: taskMap[u.id] || 0,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role = 'CREATOR' } = req.body;
    const { lastID, rows } = await db.query(
      'INSERT INTO users (name, email, role) VALUES ($1, $2, $3)',
      [name, email, role]
    );
    const id = lastID || (rows[0] && rows[0].id);
    const { rows: [user] } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AGENCIES ─────────────────────────────────────────────────────────────────

// GET /api/agencies
app.get('/api/agencies', async (req, res) => {
  try {
    const { rows: agencies } = await db.query(`
      SELECT a.*,
             (SELECT COUNT(*) FROM service_requests sr WHERE sr.agency_id = a.id) as service_requests_count,
             (SELECT COUNT(*) FROM agency_chat_logs cl WHERE cl.agency_id = a.id) as chat_logs_count
      FROM agencies a
      ORDER BY a.name ASC
    `);
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agencies/:id — detail view with child requests, assets, and chat logs
app.get('/api/agencies/:id', async (req, res) => {
  try {
    const { rows: [agency] } = await db.query('SELECT * FROM agencies WHERE id = $1', [req.params.id]);
    if (!agency) return res.status(404).json({ error: 'Agency not found' });

    // Fetch Service Requests
    const { rows: requests } = await db.query(`
      SELECT sr.*, u.name as creator_name
      FROM service_requests sr
      LEFT JOIN users u ON sr.assigned_creator_id = u.id
      WHERE sr.agency_id = $1
      ORDER BY sr.id DESC
    `, [agency.id]);

    const enrichedRequests = await Promise.all(requests.map(async r => {
      const { rows: profiles } = await db.query(
        'SELECT * FROM agency_sub_profiles WHERE service_request_id = $1', [r.id]);
      const { rows: rules } = await db.query(
        'SELECT * FROM routine_rules WHERE service_request_id = $1', [r.id]);
      return { ...r, sub_profiles: profiles, routine_rules: rules };
    }));

    // Fetch Assets
    const { rows: assets } = await db.query(`
      SELECT ba.*, u.name as added_by_name
      FROM agency_assets ba
      LEFT JOIN users u ON ba.added_by_user_id = u.id
      WHERE ba.agency_id = $1 OR ba.agency_id IS NULL
      ORDER BY ba.created_at DESC
    `, [agency.id]);

    // Fetch Chat Logs
    const { rows: chatLogs } = await db.query(`
      SELECT cl.*, u.name as added_by_name
      FROM agency_chat_logs cl
      LEFT JOIN users u ON cl.added_by_user_id = u.id
      WHERE cl.agency_id = $1
      ORDER BY cl.created_at DESC
    `, [agency.id]);

    res.json({
      ...agency,
      service_requests: enrichedRequests,
      assets,
      chat_logs: chatLogs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agencies
app.post('/api/agencies', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Agency name is required' });
    const { lastID, rows } = await db.query('INSERT INTO agencies (name) VALUES ($1)', [name]);
    const id = lastID || (rows[0] && rows[0].id);
    const { rows: [agency] } = await db.query('SELECT * FROM agencies WHERE id = $1', [id]);
    res.status(201).json(agency);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/agencies/:id
app.delete('/api/agencies/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM agencies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SERVICE REQUESTS ─────────────────────────────────────────────────────────

// GET /api/service_requests
app.get('/api/service_requests', async (req, res) => {
  try {
    const { rows: requests } = await db.query(`
      SELECT sr.*, a.name as agency_name, u.name as creator_name, u.email as creator_email
      FROM service_requests sr
      JOIN agencies a ON sr.agency_id = a.id
      LEFT JOIN users u ON sr.assigned_creator_id = u.id
      ORDER BY sr.id DESC
    `);

    const enriched = await Promise.all(requests.map(async r => {
      const { rows: profiles } = await db.query(
        'SELECT * FROM agency_sub_profiles WHERE service_request_id = $1', [r.id]);
      const { rows: rules } = await db.query(
        'SELECT * FROM routine_rules WHERE service_request_id = $1', [r.id]);
      return { ...r, sub_profiles: profiles, routine_rules: rules };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/service_requests/:id
app.get('/api/service_requests/:id', async (req, res) => {
  try {
    const { rows: [reqRow] } = await db.query(`
      SELECT sr.*, a.name as agency_name, u.name as creator_name
      FROM service_requests sr
      JOIN agencies a ON sr.agency_id = a.id
      LEFT JOIN users u ON sr.assigned_creator_id = u.id
      WHERE sr.id = $1
    `, [req.params.id]);
    if (!reqRow) return res.status(404).json({ error: 'Service Request not found' });

    const { rows: profiles } = await db.query(
      'SELECT * FROM agency_sub_profiles WHERE service_request_id = $1', [reqRow.id]);
    const { rows: rules } = await db.query(
      'SELECT * FROM routine_rules WHERE service_request_id = $1', [reqRow.id]);

    res.json({ ...reqRow, sub_profiles: profiles, routine_rules: rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/service_requests — create with sub-profiles and rules
app.post('/api/service_requests', async (req, res) => {
  try {
    const {
      agency_id,
      service_name,
      status = 'UNASSIGNED',
      assigned_creator_id = null,
      preferred_execution_day = null,
      preferred_execution_time = null,
      sub_profiles = [],
      routine_rules = [],
    } = req.body;

    if (!agency_id || !service_name) {
      return res.status(400).json({ error: 'agency_id and service_name are required' });
    }

    const { lastID, rows } = await db.query(
      `INSERT INTO service_requests (agency_id, service_name, status, assigned_creator_id, preferred_execution_day, preferred_execution_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [agency_id, service_name, status, assigned_creator_id, preferred_execution_day, preferred_execution_time]
    );
    const serviceRequestId = lastID || (rows[0] && rows[0].id);

    for (const p of sub_profiles) {
      await db.query(
        'INSERT INTO agency_sub_profiles (service_request_id, profile_name, internal_cms_edit_url) VALUES ($1, $2, $3)',
        [serviceRequestId, p.profile_name, p.internal_cms_edit_url]
      );
    }

    for (const r of routine_rules) {
      await db.query(
        `INSERT INTO routine_rules (service_request_id, pipeline_type, source_url, execution_instructions, cron_interval_expression)
         VALUES ($1, $2, $3, $4, $5)`,
        [serviceRequestId, r.pipeline_type, r.source_url || null, r.execution_instructions || null, r.cron_interval_expression || null]
      );
    }

    const { rows: [created] } = await db.query('SELECT * FROM service_requests WHERE id = $1', [serviceRequestId]);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/service_requests/:id
app.put('/api/service_requests/:id', async (req, res) => {
  try {
    const { service_name, preferred_execution_day, preferred_execution_time } = req.body;
    await db.query(
      `UPDATE service_requests SET service_name=$1, preferred_execution_day=$2, preferred_execution_time=$3 WHERE id=$4`,
      [service_name, preferred_execution_day, preferred_execution_time, req.params.id]
    );
    const { rows: [sr] } = await db.query('SELECT * FROM service_requests WHERE id=$1', [req.params.id]);
    res.json(sr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/service_requests/:id
app.delete('/api/service_requests/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM service_requests WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/service_requests/:id/status — transition status and cascade PENDING tasks
app.patch('/api/service_requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['UNASSIGNED', 'ASSIGNED', 'PAUSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    await db.query('UPDATE service_requests SET status=$1 WHERE id=$2', [status, req.params.id]);

    if (status === 'PAUSED') {
      await db.query(
        `UPDATE agency_tasks SET status='PAUSED' WHERE service_request_id=$1 AND status='PENDING'`,
        [req.params.id]
      );
    }
    if (status === 'ASSIGNED') {
      await db.query(
        `UPDATE agency_tasks SET status='PENDING' WHERE service_request_id=$1 AND status='PAUSED'`,
        [req.params.id]
      );
    }

    const { rows: [sr] } = await db.query('SELECT * FROM service_requests WHERE id=$1', [req.params.id]);
    res.json(sr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/service_requests/:id/route — atomic hot-swap
app.post('/api/service_requests/:id/route', async (req, res) => {
  try {
    const { new_creator_id } = req.body;
    const srId = req.params.id;

    // Validate creator
    const { rows: [creator] } = await db.query('SELECT * FROM users WHERE id=$1', [new_creator_id]);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    await db.transaction(async () => {
      await db.query(
        'UPDATE service_requests SET assigned_creator_id=$1, status=$2 WHERE id=$3',
        [new_creator_id, 'ASSIGNED', srId]
      );
      await db.query(
        `UPDATE agency_tasks SET assigned_to_creator_id=$1
         WHERE service_request_id=$2 AND status IN ('PENDING','IN_PROGRESS','PAUSED')`,
        [new_creator_id, srId]
      );
    });

    const { rows: [sr] } = await db.query(`
      SELECT sr.*, a.name as agency_name, u.name as creator_name
      FROM service_requests sr
      JOIN agencies a ON sr.agency_id = a.id
      LEFT JOIN users u ON sr.assigned_creator_id = u.id
      WHERE sr.id=$1`, [srId]);

    res.json({ success: true, service_request: sr, routed_to: creator });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TASKS ────────────────────────────────────────────────────────────────────

// GET /api/tasks — filterable
app.get('/api/tasks', async (req, res) => {
  try {
    const { creator_id, status, service_request_id } = req.query;
    let sql = `
      SELECT t.*, a.name as agency_name, sr.service_name, u.name as creator_name
      FROM agency_tasks t
      JOIN service_requests sr ON t.service_request_id = sr.id
      JOIN agencies a ON sr.agency_id = a.id
      LEFT JOIN users u ON t.assigned_to_creator_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (creator_id) { params.push(creator_id); sql += ` AND t.assigned_to_creator_id=$${params.length}`; }
    if (status)     { params.push(status);     sql += ` AND t.status=$${params.length}`; }
    if (service_request_id) { params.push(service_request_id); sql += ` AND t.service_request_id=$${params.length}`; }
    sql += ' ORDER BY t.scheduled_for_timestamp ASC';

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id — gets single task with rules, sub-profiles, AND agency chat logs
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const { rows: [task] } = await db.query(`
      SELECT t.*, a.id as agency_id, a.name as agency_name, sr.service_name, sr.preferred_execution_day, u.name as creator_name
      FROM agency_tasks t
      JOIN service_requests sr ON t.service_request_id = sr.id
      JOIN agencies a ON sr.agency_id = a.id
      LEFT JOIN users u ON t.assigned_to_creator_id = u.id
      WHERE t.id=$1
    `, [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { rows: rules } = await db.query('SELECT * FROM routine_rules WHERE service_request_id=$1', [task.service_request_id]);
    const { rows: profiles } = await db.query('SELECT * FROM agency_sub_profiles WHERE service_request_id=$1', [task.service_request_id]);
    
    // Fetch parent agency chat logs so creator can see briefs in workspace
    const { rows: chatLogs } = await db.query(`
      SELECT cl.*, u.name as added_by_name
      FROM agency_chat_logs cl
      LEFT JOIN users u ON cl.added_by_user_id = u.id
      WHERE cl.agency_id = $1
      ORDER BY cl.created_at DESC
      LIMIT 8
    `, [task.agency_id]);

    res.json({ ...task, routine_rules: rules, sub_profiles: profiles, chat_logs: chatLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();

    if (status === 'IN_PROGRESS') {
      await db.query(
        `UPDATE agency_tasks SET status='IN_PROGRESS', started_at=$1 WHERE id=$2`,
        [now, req.params.id]
      );
    } else if (status === 'COMPLETED') {
      await db.query(
        `UPDATE agency_tasks SET status='COMPLETED', completed_at=$1 WHERE id=$2`,
        [now, req.params.id]
      );
    } else {
      await db.query(`UPDATE agency_tasks SET status=$1 WHERE id=$2`, [status, req.params.id]);
    }

    const { rows: [task] } = await db.query('SELECT * FROM agency_tasks WHERE id=$1', [req.params.id]);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/generate — auto-generate tasks
app.post('/api/tasks/generate', async (req, res) => {
  try {
    const { service_request_id } = req.query;
    let sql = `
      SELECT rr.*, sr.assigned_creator_id, sr.id as srid
      FROM routine_rules rr
      JOIN service_requests sr ON rr.service_request_id = sr.id
      WHERE sr.status = 'ASSIGNED' AND rr.pipeline_type = 'INTERVAL_SCHEDULED' AND rr.cron_interval_expression IS NOT NULL
    `;
    const params = [];
    if (service_request_id) { params.push(service_request_id); sql += ` AND sr.id=$${params.length}`; }

    const { rows: rules } = await db.query(sql, params);
    const created = [];

    for (const rule of rules) {
      const ts = parseCronToNextTimestamp(rule.cron_interval_expression);
      const { lastID, rows } = await db.query(
        `INSERT INTO agency_tasks (service_request_id, assigned_to_creator_id, status, scheduled_for_timestamp)
         VALUES ($1, $2, 'PENDING', $3)`,
        [rule.srid, rule.assigned_creator_id, ts]
      );
      const taskId = lastID || (rows[0] && rows[0].id);
      created.push({ task_id: taskId, service_request_id: rule.srid, scheduled_for: ts });
    }

    res.json({ generated: created.length, tasks: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SCHEDULER / CAPACITY MATCHING ───────────────────────────────────────────

// GET /api/scheduler/match
app.get('/api/scheduler/match', async (req, res) => {
  try {
    const { day, time } = req.query;
    const { rows: creators } = await db.query(`SELECT * FROM users WHERE role='CREATOR'`);
    const { rows: requests }  = await db.query(`
      SELECT assigned_creator_id, preferred_execution_day, preferred_execution_time
      FROM service_requests WHERE status='ASSIGNED'
    `);
    const { rows: taskCounts } = await db.query(`
      SELECT assigned_to_creator_id, COUNT(*) as cnt
      FROM agency_tasks WHERE status IN ('PENDING','IN_PROGRESS')
      GROUP BY assigned_to_creator_id
    `);
    const taskMap = Object.fromEntries(taskCounts.map(r => [r.assigned_to_creator_id, parseInt(r.cnt)]));

    function timeToMinutes(t) {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    const requestedMin = timeToMinutes(time);

    const scored = creators.map(creator => {
      const myRequests = requests.filter(r => r.assigned_creator_id == creator.id);
      const activeRequests = myRequests.length;
      const openTasks = taskMap[creator.id] || 0;

      let overlapPenalty = 0;
      if (day && time) {
        const conflicts = myRequests.filter(r => {
          const sameDay = r.preferred_execution_day === day.toUpperCase();
          const diffMin = Math.abs(timeToMinutes(r.preferred_execution_time) - requestedMin);
          return sameDay && diffMin < 120; // 2 hour slot conflict
        });
        overlapPenalty = conflicts.length;
      }

      const score = (activeRequests * 10) + (openTasks * 2) + (overlapPenalty * 100);

      let label = 'Open Slot';
      if (overlapPenalty > 0 && score < 120) label = 'Near-Match';
      else if (overlapPenalty > 0 || score >= 120) label = 'Fully Booked';

      return {
        ...creator,
        active_bundles: activeRequests, // Map to active_bundles key for frontend backward-compatibility
        open_tasks: openTasks,
        overlap_conflicts: overlapPenalty,
        score,
        label,
      };
    });

    scored.sort((a, b) => a.score !== b.score ? a.score - b.score : a.active_bundles - b.active_bundles);

    res.json(scored);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ASSETS ──────────────────────────────────────────────────────────────────

// GET /api/assets — get assets for agency or globally
app.get('/api/assets', async (req, res) => {
  try {
    const { agency_id, global: isGlobal } = req.query;
    let sql = `
      SELECT ba.*, u.name as added_by_name, a.name as agency_name
      FROM agency_assets ba
      LEFT JOIN users u ON ba.added_by_user_id = u.id
      LEFT JOIN agencies a ON ba.agency_id = a.id
      WHERE 1=1
    `;
    const params = [];
    if (agency_id) {
      params.push(agency_id);
      sql += ` AND (ba.agency_id=$${params.length} OR ba.agency_id IS NULL)`;
    } else if (isGlobal === 'true') {
      sql += ` AND ba.agency_id IS NULL`;
    }
    sql += ' ORDER BY ba.created_at DESC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assets
app.post('/api/assets', async (req, res) => {
  try {
    const {
      agency_id = null,
      added_by_user_id = null,
      asset_type = 'LINK',
      label,
      url,
      category = 'GENERAL',
      notes = null,
    } = req.body;

    if (!label || !url) return res.status(400).json({ error: 'label and url are required' });

    const { lastID, rows } = await db.query(
      `INSERT INTO agency_assets (agency_id, added_by_user_id, asset_type, label, url, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [agency_id || null, added_by_user_id || null, asset_type, label, url, category, notes]
    );
    const id = lastID || (rows[0] && rows[0].id);
    const { rows: [asset] } = await db.query(`
      SELECT ba.*, u.name as added_by_name FROM agency_assets ba
      LEFT JOIN users u ON ba.added_by_user_id = u.id WHERE ba.id=$1`, [id]);
    res.status(201).json(asset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/assets/:id
app.delete('/api/assets/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM agency_assets WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CHAT LOGS ───────────────────────────────────────────────────────────────

// GET /api/agencies/:agencyId/chat_logs
app.get('/api/agencies/:agencyId/chat_logs', async (req, res) => {
  try {
    const { rows: logs } = await db.query(`
      SELECT cl.*, u.name as added_by_name
      FROM agency_chat_logs cl
      LEFT JOIN users u ON cl.added_by_user_id = u.id
      WHERE cl.agency_id = $1
      ORDER BY cl.created_at DESC
    `, [req.params.agencyId]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agencies/:agencyId/chat_logs
app.post('/api/agencies/:agencyId/chat_logs', async (req, res) => {
  try {
    const { added_by_user_id, sender_name, message_content } = req.body;
    if (!sender_name || !message_content) {
      return res.status(400).json({ error: 'sender_name and message_content are required' });
    }
    const { lastID, rows } = await db.query(`
      INSERT INTO agency_chat_logs (agency_id, added_by_user_id, sender_name, message_content)
      VALUES ($1, $2, $3, $4)
    `, [req.params.agencyId, added_by_user_id || null, sender_name, message_content]);
    const id = lastID || (rows[0] && rows[0].id);
    const { rows: [log] } = await db.query(`
      SELECT cl.*, u.name as added_by_name FROM agency_chat_logs cl
      LEFT JOIN users u ON cl.added_by_user_id = u.id WHERE cl.id=$1`, [id]);
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Catch-all: serve SPA ─────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Startup ──────────────────────────────────────────────────────────────────

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀  Agency Ops running → http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
