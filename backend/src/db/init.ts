import 'dotenv/config';
import pg from 'pg';

/**
 * Initialize database tables directly via SQL.
 * This replaces drizzle-kit push/migrate for production.
 */
async function initDatabase() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Initializing database tables...');

  await pool.query(`
    -- Organizations
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      logo_url TEXT,
      primary_color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
      secondary_color VARCHAR(7) NOT NULL DEFAULT '#1e1b4b',
      accent_color VARCHAR(7) NOT NULL DEFAULT '#f59e0b',
      timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Vienna',
      locale VARCHAR(5) NOT NULL DEFAULT 'de',
      core_hours_start VARCHAR(5),
      core_hours_end VARCHAR(5),
      break_after_minutes INTEGER NOT NULL DEFAULT 360,
      break_duration_minutes INTEGER NOT NULL DEFAULT 30,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      avatar_url TEXT,
      department VARCHAR(100),
      position VARCHAR(100),
      phone VARCHAR(50),
      supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vacation_days_per_year INTEGER NOT NULL DEFAULT 25,
      weekly_target_hours NUMERIC(5,2) NOT NULL DEFAULT 40.00,
      is_active BOOLEAN NOT NULL DEFAULT true,
      refresh_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
    CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);

    -- User Module Permissions
    CREATE TABLE IF NOT EXISTS user_module_permissions (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id VARCHAR(50) NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (user_id, module_id)
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      module_id VARCHAR(50),
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

    -- Time Entries
    CREATE TABLE IF NOT EXISTS time_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      clock_in TIMESTAMPTZ NOT NULL,
      clock_out TIMESTAMPTZ,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      auto_break_applied BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      corrected_by UUID REFERENCES users(id) ON DELETE SET NULL,
      correction_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, clock_in);
    CREATE INDEX IF NOT EXISTS idx_time_entries_org ON time_entries(org_id);

    -- Leave Types
    CREATE TABLE IF NOT EXISTS leave_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
      deducts_vacation BOOLEAN NOT NULL DEFAULT true,
      requires_approval BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Leave Requests
    CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      half_day_start BOOLEAN NOT NULL DEFAULT false,
      half_day_end BOOLEAN NOT NULL DEFAULT false,
      business_days INTEGER NOT NULL,
      reason TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
      decided_at TIMESTAMPTZ,
      decision_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

    -- Public Holidays
    CREATE TABLE IF NOT EXISTS public_holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_public_holidays_org_date ON public_holidays(org_id, date);

    -- Calendar Events
    CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      location VARCHAR(300),
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      all_day BOOLEAN NOT NULL DEFAULT false,
      recurrence_rule TEXT,
      color VARCHAR(7),
      visibility VARCHAR(20) NOT NULL DEFAULT 'private',
      source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
      source_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON calendar_events(org_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_at, end_at);

    -- Calendar Event Attendees
    CREATE TABLE IF NOT EXISTS calendar_event_attendees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Forum Groups
    CREATE TABLE IF NOT EXISTS community_forum_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      icon VARCHAR(50),
      color VARCHAR(7) DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Forums
    CREATE TABLE IF NOT EXISTS community_forums (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL REFERENCES community_forum_groups(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      is_announcement BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      post_count INTEGER NOT NULL DEFAULT 0,
      last_post_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Posts
    CREATE TABLE IF NOT EXISTS community_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      forum_id UUID REFERENCES community_forums(id) ON DELETE SET NULL,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      post_type VARCHAR(20) NOT NULL DEFAULT 'post',
      background VARCHAR(50),
      media_urls JSONB DEFAULT '[]',
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_community_posts_org ON community_posts(org_id);
    CREATE INDEX IF NOT EXISTS idx_community_posts_forum ON community_posts(forum_id);

    -- Community Comments
    CREATE TABLE IF NOT EXISTS community_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      parent_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Reactions (replaces community_likes)
    CREATE TABLE IF NOT EXISTS community_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
      comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
      reaction_type VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_post ON community_reactions(post_id);

    -- Community Polls
    CREATE TABLE IF NOT EXISTS community_polls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      multiple_choice BOOLEAN NOT NULL DEFAULT false,
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS community_poll_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      poll_id UUID NOT NULL REFERENCES community_polls(id) ON DELETE CASCADE,
      text VARCHAR(300) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS community_poll_votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      option_id UUID NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Bookmarks
    CREATE TABLE IF NOT EXISTS community_bookmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Follows
    CREATE TABLE IF NOT EXISTS community_follows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Community Profiles
    CREATE TABLE IF NOT EXISTS community_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT,
      headline VARCHAR(200),
      social_links JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      priority VARCHAR(20) NOT NULL DEFAULT 'medium',
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      due_date DATE,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(org_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

    -- Task Comments
    CREATE TABLE IF NOT EXISTS task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- File Uploads
    CREATE TABLE IF NOT EXISTS file_uploads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- AI Providers
    CREATE TABLE IF NOT EXISTS ai_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(30) NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- AI Assistants
    CREATE TABLE IF NOT EXISTS ai_assistants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      description TEXT,
      avatar_url TEXT,
      model VARCHAR(100) NOT NULL,
      system_prompt TEXT,
      temperature NUMERIC(3,2) DEFAULT 0.70,
      max_tokens INTEGER DEFAULT 2048,
      tone VARCHAR(50) DEFAULT 'professional',
      language VARCHAR(10) DEFAULT 'de',
      opening_message TEXT,
      forbidden_topics JSONB DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_assistants_org ON ai_assistants(org_id);

    -- AI Assistant Assignments
    CREATE TABLE IF NOT EXISTS ai_assistant_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assistant_id UUID NOT NULL REFERENCES ai_assistants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- AI Chat Sessions
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assistant_id UUID NOT NULL REFERENCES ai_assistants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(300),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- AI Chat Messages
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_chat_messages(session_id);

    -- Courses
    CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      is_published BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Course Modules
    CREATE TABLE IF NOT EXISTS course_modules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Course Lessons
    CREATE TABLE IF NOT EXISTS course_lessons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      content_type VARCHAR(20) NOT NULL DEFAULT 'text',
      text_content TEXT,
      video_url TEXT,
      video_duration_seconds INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Course Enrollments
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    -- Lesson Progress
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed BOOLEAN NOT NULL DEFAULT false,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Webhooks
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      url TEXT NOT NULL,
      secret_encrypted TEXT NOT NULL,
      events JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_triggered_at TIMESTAMPTZ,
      fail_count VARCHAR(10) NOT NULL DEFAULT '0',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- API Keys
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix VARCHAR(12) NOT NULL,
      scopes JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Webhook Deliveries
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event VARCHAR(100) NOT NULL,
      payload JSONB,
      status_code VARCHAR(5),
      response_body TEXT,
      success BOOLEAN NOT NULL DEFAULT false,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- CRM Contacts
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      position VARCHAR(100),
      company_id UUID,
      notes TEXT,
      tags JSONB DEFAULT '[]',
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- CRM Companies
    CREATE TABLE IF NOT EXISTS crm_companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(300) NOT NULL,
      website VARCHAR(500),
      industry VARCHAR(100),
      size VARCHAR(50),
      address TEXT,
      phone VARCHAR(50),
      notes TEXT,
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add FK after both tables exist
    ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL;

    -- CRM Deals
    CREATE TABLE IF NOT EXISTS crm_deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      value NUMERIC(12,2),
      currency VARCHAR(3) DEFAULT 'EUR',
      stage VARCHAR(50) NOT NULL DEFAULT 'lead',
      probability INTEGER DEFAULT 0,
      contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
      company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      expected_close_date TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- CRM Activities
    CREATE TABLE IF NOT EXISTS crm_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
      deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
      company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // === Migrations: Add columns to existing tables ===
  console.log('Running migrations...');

  const migrations = [
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) NOT NULL DEFAULT 'post'`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS background VARCHAR(50)`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`,
    // Drop old columns that no longer exist (ignore errors)
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e: any) {
      // Ignore "already exists" errors
      if (!e.message?.includes('already exists')) {
        console.log('Migration note:', e.message);
      }
    }
  }

  console.log('Database tables initialized successfully.');
  await pool.end();
}

initDatabase().catch((err) => {
  console.error('Database init failed:', err);
  process.exit(1);
});
