/**
 * seed.js — Agency Ops demo data seeder
 * Run: node seed.js
 *
 * Seeds: 4 users, 5 agencies, service requests, routine rules, sub-profiles, assets, chat logs, and tasks.
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

async function seed() {
  const dbPath = path.join(__dirname, 'agencyops.db');
  
  // Clean start: remove old SQLite database file to ensure new schema is applied
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
      // Also delete WAL and SHM files if present
      if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
      if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
      console.log('🧹 Cleaned existing SQLite database files.');
    } catch (e) {
      console.warn('Warning: Could not remove old db file:', e.message);
    }
  }

  await db.init();
  console.log('🌱  Seeding Agency Ops database...\n');

  // ── 1. Users ─────────────────────────────────────────────────────────────────
  const users = [
    { name: 'Jordan Reyes',   email: 'jordan@agencyops.io',  role: 'ADMIN'   },
    { name: 'Mia Chen',       email: 'mia@agencyops.io',     role: 'CREATOR' },
    { name: 'DeShawn Morris', email: 'deshawn@agencyops.io', role: 'CREATOR' },
    { name: 'Priya Kapoor',   email: 'priya@agencyops.io',   role: 'CREATOR' },
  ];

  const userIds = {};
  for (const u of users) {
    const { lastID, rows } = await db.query(
      'INSERT INTO users (name, email, role) VALUES ($1, $2, $3)',
      [u.name, u.email, u.role]
    );
    const id = lastID || (rows[0] && rows[0].id);
    userIds[u.email] = id;
    console.log(`  ✔ User: ${u.name} (${u.role})`);
  }

  // ── 2. Agencies ──────────────────────────────────────────────────────────────
  const agencies = [
    { name: 'Elite Talent Group' },
    { name: 'Coastal Restaurant Group' },
    { name: 'NorthStar Sports Agency' },
    { name: 'Apex Modeling LLC' },
    { name: 'Bloom PR Agency' }
  ];

  const agencyIds = {};
  for (const a of agencies) {
    const { lastID, rows } = await db.query(
      'INSERT INTO agencies (name) VALUES ($1)',
      [a.name]
    );
    const id = lastID || (rows[0] && rows[0].id);
    agencyIds[a.name] = id;
    console.log(`  ✔ Agency: ${a.name}`);
  }

  // ── 3. Service Requests & Profiles / Rules ────────────────────────────────────
  const serviceRequests = [
    {
      agency_name: 'Elite Talent Group',
      service_name: 'Weekly Profile Events Sync',
      status: 'ASSIGNED',
      creator_email: 'mia@agencyops.io',
      preferred_execution_day: 'FRIDAY',
      preferred_execution_time: '17:00',
      sub_profiles: [
        { profile_name: 'Marcus Bell',    internal_cms_edit_url: 'https://cms.internal/profile/1001' },
        { profile_name: 'Sofia Alvarez',  internal_cms_edit_url: 'https://cms.internal/profile/1002' },
        { profile_name: 'Tyler Brooks',   internal_cms_edit_url: 'https://cms.internal/profile/1003' },
      ],
      routine_rules: [
        {
          pipeline_type: 'INTERVAL_SCHEDULED',
          source_url: 'https://elitetalentgroup.com/events',
          cron_interval_expression: '0 8 * * 5',
          execution_instructions: `## Weekly Profile Events Update\n- [ ] Open source URL and scan for new bookings\n- [ ] Navigate to each profile CMS link below\n- [ ] Update the upcoming events section with new dates\n- [ ] Upload any new headshot images if provided\n- [ ] Set availability status to "Available" if no conflicts\n- [ ] Save changes and confirm publish timestamp\n- [ ] Reply to agency contact confirming completion`,
        },
      ],
    },
    {
      agency_name: 'Coastal Restaurant Group',
      service_name: 'Weekly Menu & Specials Sync',
      status: 'ASSIGNED',
      creator_email: 'deshawn@agencyops.io',
      preferred_execution_day: 'MONDAY',
      preferred_execution_time: '09:00',
      sub_profiles: [
        { profile_name: 'Harbor Bites — Downtown',  internal_cms_edit_url: 'https://cms.internal/venue/2001' },
        { profile_name: 'Harbor Bites — Westside',  internal_cms_edit_url: 'https://cms.internal/venue/2002' },
        { profile_name: 'The Salt Room',            internal_cms_edit_url: 'https://cms.internal/venue/2003' },
      ],
      routine_rules: [
        {
          pipeline_type: 'INTERVAL_SCHEDULED',
          source_url: 'https://coastalrg.com/weekly-specials',
          cron_interval_expression: '0 9 * * 1',
          execution_instructions: `## Weekly Menu & Specials Sync\n- [ ] Pull this week's specials from the source URL\n- [ ] Log into each venue CMS profile\n- [ ] Update "Weekly Specials" section with new items and pricing\n- [ ] Verify hours of operation are accurate\n- [ ] Update reservation link if changed\n- [ ] Mark as complete in Agency Ops`,
        },
      ],
    },
    {
      agency_name: 'Coastal Restaurant Group',
      service_name: 'New Event Pub Sync',
      status: 'ASSIGNED',
      creator_email: 'deshawn@agencyops.io',
      preferred_execution_day: 'MONDAY',
      preferred_execution_time: '11:00',
      sub_profiles: [
        { profile_name: 'The Salt Room',            internal_cms_edit_url: 'https://cms.internal/venue/2003' },
      ],
      routine_rules: [
        {
          pipeline_type: 'EVENT_DRIVEN',
          source_url: 'https://coastalrg.com/events',
          cron_interval_expression: null,
          execution_instructions: `## Event-Driven: New Event Published\n- [ ] Monitor the source URL for new event listings\n- [ ] Create an event entry in each relevant venue CMS\n- [ ] Add event images and descriptions\n- [ ] Confirm event date, time, and capacity\n- [ ] Notify account manager once live`,
        },
      ],
    },
    {
      agency_name: 'NorthStar Sports Agency',
      service_name: 'Bi-Weekly Roster & Stats Update',
      status: 'ASSIGNED',
      creator_email: 'priya@agencyops.io',
      preferred_execution_day: 'WEDNESDAY',
      preferred_execution_time: '14:00',
      sub_profiles: [
        { profile_name: 'Andre Washington (QB)', internal_cms_edit_url: 'https://cms.internal/athlete/3001' },
        { profile_name: 'Layla Kim (Track)',      internal_cms_edit_url: 'https://cms.internal/athlete/3002' },
      ],
      routine_rules: [
        {
          pipeline_type: 'INTERVAL_SCHEDULED',
          source_url: 'https://northstarsports.com/roster',
          cron_interval_expression: '0 14 * * 3',
          execution_instructions: `## Bi-Weekly Roster & Stats Update\n- [ ] Pull latest stats from source URL\n- [ ] Update player bios and recent performance data in CMS\n- [ ] Add any new press mentions or media coverage links\n- [ ] Confirm contract status fields are current\n- [ ] Run image sync if new media assets were received\n- [ ] Verify social links are up to date`,
        },
      ],
    },
    {
      agency_name: 'Apex Modeling LLC',
      service_name: 'Portfolio Image Sync',
      status: 'PAUSED',
      creator_email: null,
      preferred_execution_day: 'THURSDAY',
      preferred_execution_time: '11:00',
      sub_profiles: [
        { profile_name: 'Camille Rousseau', internal_cms_edit_url: 'https://cms.internal/model/4001' },
      ],
      routine_rules: [
        {
          pipeline_type: 'INTERVAL_SCHEDULED',
          source_url: 'https://apexmodeling.com/portfolio',
          cron_interval_expression: '0 11 * * 4',
          execution_instructions: `## Portfolio Image Sync\n- [ ] Download latest portfolio images from source\n- [ ] Compress and upload to CMS media library\n- [ ] Update portfolio gallery order\n- [ ] Verify featured image is current headshot`,
        },
      ],
    },
    {
      agency_name: 'Bloom PR Agency',
      service_name: 'Press Release Sync',
      status: 'UNASSIGNED',
      creator_email: null,
      preferred_execution_day: 'FRIDAY',
      preferred_execution_time: '10:00',
      sub_profiles: [
        { profile_name: 'Bloom PR — Newsroom',    internal_cms_edit_url: 'https://cms.internal/pr/5001' },
      ],
      routine_rules: [
        {
          pipeline_type: 'EVENT_DRIVEN',
          source_url: 'https://bloompr.com/press-releases',
          cron_interval_expression: null,
          execution_instructions: `## Press Release Sync\n- [ ] Check source URL for new press releases\n- [ ] Create a press entry in the Newsroom CMS\n- [ ] Tag relevant clients from Client Hub\n- [ ] Upload PDF if provided\n- [ ] Notify the account lead`,
        },
      ],
    },
  ];

  for (const sr of serviceRequests) {
    const agencyId = agencyIds[sr.agency_name];
    const creatorId = sr.creator_email ? userIds[sr.creator_email] : null;

    const { lastID, rows } = await db.query(
      `INSERT INTO service_requests (agency_id, service_name, status, assigned_creator_id, preferred_execution_day, preferred_execution_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [agencyId, sr.service_name, sr.status, creatorId, sr.preferred_execution_day, sr.preferred_execution_time]
    );
    const serviceRequestId = lastID || (rows[0] && rows[0].id);
    console.log(`  ✔ Service Request: ${sr.service_name} for ${sr.agency_name} [${sr.status}]`);

    for (const p of sr.sub_profiles) {
      await db.query(
        'INSERT INTO agency_sub_profiles (service_request_id, profile_name, internal_cms_edit_url) VALUES ($1, $2, $3)',
        [serviceRequestId, p.profile_name, p.internal_cms_edit_url]
      );
    }

    for (const r of sr.routine_rules) {
      await db.query(
        `INSERT INTO routine_rules (service_request_id, pipeline_type, source_url, execution_instructions, cron_interval_expression)
         VALUES ($1, $2, $3, $4, $5)`,
        [serviceRequestId, r.pipeline_type, r.source_url, r.execution_instructions, r.cron_interval_expression]
      );
    }

    // Seed tasks
    if (sr.status === 'ASSIGNED' && creatorId) {
      const past = new Date();
      past.setDate(past.getDate() - 7);

      await db.query(
        `INSERT INTO agency_tasks (service_request_id, assigned_to_creator_id, status, scheduled_for_timestamp, started_at, completed_at)
         VALUES ($1, $2, 'COMPLETED', $3, $4, $5)`,
        [serviceRequestId, creatorId, past.toISOString(),
          new Date(past.getTime() + 900000).toISOString(),
          new Date(past.getTime() + 3600000).toISOString()]
      );

      const next = new Date();
      next.setDate(next.getDate() + 3);
      await db.query(
        `INSERT INTO agency_tasks (service_request_id, assigned_to_creator_id, status, scheduled_for_timestamp)
         VALUES ($1, $2, 'PENDING', $3)`,
        [serviceRequestId, creatorId, next.toISOString()]
      );
      console.log(`     + 1 COMPLETED task + 1 PENDING task`);
    }
  }

  // ── 4. Agency-Specific Assets ────────────────────────────────────────────────
  const assets = [
    {
      agency_name: 'Elite Talent Group',
      label: 'Official Spotify Music Portal',
      url: 'https://open.spotify.com/artist/elite-talent',
      type: 'LINK',
      category: 'SPOTIFY',
      notes: 'Sync artist bios, upcoming singles, and weekly streaming numbers from here.'
    },
    {
      agency_name: 'Coastal Restaurant Group',
      label: 'Main Branding & Food Asset Pack',
      url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
      type: 'IMAGE',
      category: 'IMAGE',
      notes: 'High-res photos of venue interiors and signature dishes used for weekly promos.'
    },
    {
      agency_name: 'NorthStar Sports Agency',
      label: 'Athletics Roster News Desk',
      url: 'https://espn.com/college-sports/tracker',
      type: 'LINK',
      category: 'NEWS',
      notes: 'Scan this dashboard for injury reports or trade announcements relating to layla and andre.'
    }
  ];

  // Also add one global asset
  await db.query(
    `INSERT INTO agency_assets (agency_id, added_by_user_id, asset_type, label, url, category, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [null, userIds['jordan@agencyops.io'], 'LINK', 'Universal Support Portal', 'https://support.internal.agencyops.io', 'CMS', 'Internal wiki guide on routine executions and SOPs']
  );
  console.log(`  ✔ Global Asset: Universal Support Portal`);

  for (const a of assets) {
    const agencyId = agencyIds[a.agency_name];
    await db.query(
      `INSERT INTO agency_assets (agency_id, added_by_user_id, asset_type, label, url, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [agencyId, userIds['jordan@agencyops.io'], a.type, a.label, a.url, a.category, a.notes]
    );
    console.log(`  ✔ Asset: ${a.label} for ${a.agency_name}`);
  }

  // ── 5. Agency Chat / Text Logs ────────────────────────────────────────────────
  const chatLogs = [
    {
      agency_name: 'Elite Talent Group',
      sender: 'Jordan Reyes (Admin)',
      content: 'Jordan: Hi team! Client texted: "Marcus Bell got a guest booking for a drama next week. Need to update his events page to show NYC guest appearance on July 14. Here is the link to the show: https://theater-tickets.example.com". Mia, please make sure this is updated on Marcus\'s events listing during your Friday sync!'
    },
    {
      agency_name: 'Coastal Restaurant Group',
      sender: 'Client Team',
      content: 'Coastal Team: Hey, updates for the menu: Lobster roll is back on specials for $24. Also, adding a cocktail promo: "Ocean Breeze" for $12. Can you update the Downtown & Westside location CMS menus before Monday morning?'
    },
    {
      agency_name: 'NorthStar Sports Agency',
      sender: 'Client Team',
      content: 'NorthStar Rep: Layla Kim set a personal best of 11.23 seconds in the 100m sprint yesterday! We need to add this to her athletic profile events stats. Also add the Oregon Invitational link to her bio references.'
    }
  ];

  for (const c of chatLogs) {
    const agencyId = agencyIds[c.agency_name];
    await db.query(
      `INSERT INTO agency_chat_logs (agency_id, added_by_user_id, sender_name, message_content)
       VALUES ($1, $2, $3, $4)`,
      [agencyId, userIds['jordan@agencyops.io'], c.sender, c.content]
    );
    console.log(`  ✔ Chat Log: copy-pasted text added for ${c.agency_name}`);
  }

  console.log('\n✅  Seed complete!\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
