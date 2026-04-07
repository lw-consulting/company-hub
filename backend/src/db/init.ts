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

    -- Community Posts
    CREATE TABLE IF NOT EXISTS community_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      media_urls JSONB DEFAULT '[]',
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_community_posts_org ON community_posts(org_id);

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

    -- Community Likes
    CREATE TABLE IF NOT EXISTS community_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
      comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  `);

  console.log('Database tables initialized successfully.');
  await pool.end();
}

initDatabase().catch((err) => {
  console.error('Database init failed:', err);
  process.exit(1);
});
