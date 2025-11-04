-- eDNA Biodiversity Platform Database Schema
-- PostgreSQL initialization script

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE user_role AS ENUM ('guest', 'researcher', 'institutional_admin', 'system_admin');
CREATE TYPE oauth_provider AS ENUM ('google', 'orcid', 'github');
CREATE TYPE project_visibility AS ENUM ('private', 'shared', 'public');
CREATE TYPE collaborator_role AS ENUM ('viewer', 'editor', 'admin');
CREATE TYPE file_type AS ENUM ('fasta', 'fastq', 'sam', 'bam');
CREATE TYPE upload_status AS ENUM ('uploading', 'completed', 'failed');
CREATE TYPE analysis_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE notification_type AS ENUM ('analysis_completed', 'analysis_failed', 'file_uploaded', 'project_shared', 'system_announcement');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    orcid_id VARCHAR(19),
    institution VARCHAR(255),
    role user_role DEFAULT 'researcher' NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    user_agent TEXT,
    ip_address INET,
    is_active BOOLEAN DEFAULT true NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- OAuth accounts table
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider oauth_provider NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(provider, provider_id)
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visibility project_visibility DEFAULT 'private' NOT NULL,
    is_public BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Project collaborators table
CREATE TABLE project_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role collaborator_role DEFAULT 'viewer' NOT NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID NOT NULL,
    UNIQUE(project_id, user_id)
);

-- Uploaded files table
CREATE TABLE uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type file_type NOT NULL,
    upload_status upload_status DEFAULT 'uploading' NOT NULL,
    checksum VARCHAR(64),
    metadata JSONB,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Analysis jobs table
CREATE TABLE analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_ids UUID[] NOT NULL,
    status analysis_status DEFAULT 'queued' NOT NULL,
    parameters JSONB NOT NULL,
    results JSONB,
    progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_details JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Species identifications table
CREATE TABLE species_identifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    sequence_id VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255) NOT NULL,
    common_name VARCHAR(255),
    taxonomy JSONB NOT NULL,
    abundance INTEGER NOT NULL,
    relative_abundance NUMERIC(10,6),
    confidence NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    hit_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_institution ON users(institution);

-- Sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- OAuth
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider);

-- Projects
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_visibility ON projects(visibility);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_name_gin ON projects USING gin(name gin_trgm_ops);

-- Collaborators
CREATE INDEX idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX idx_project_collaborators_user_id ON project_collaborators(user_id);

-- Files
CREATE INDEX idx_uploaded_files_project_id ON uploaded_files(project_id);
CREATE INDEX idx_uploaded_files_file_type ON uploaded_files(file_type);
CREATE INDEX idx_uploaded_files_upload_status ON uploaded_files(upload_status);
CREATE INDEX idx_uploaded_files_uploaded_by ON uploaded_files(uploaded_by);
CREATE INDEX idx_uploaded_files_created_at ON uploaded_files(created_at);

-- Analysis jobs
CREATE INDEX idx_analysis_jobs_project_id ON analysis_jobs(project_id);
CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX idx_analysis_jobs_created_by ON analysis_jobs(created_by);
CREATE INDEX idx_analysis_jobs_created_at ON analysis_jobs(created_at);

-- Species identifications
CREATE INDEX idx_species_identifications_analysis_id ON species_identifications(analysis_id);
CREATE INDEX idx_species_identifications_scientific_name ON species_identifications(scientific_name);
CREATE INDEX idx_species_identifications_confidence ON species_identifications(confidence);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_accounts_updated_at BEFORE UPDATE ON oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploaded_files_updated_at BEFORE UPDATE ON uploaded_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_jobs_updated_at BEFORE UPDATE ON analysis_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create row-level security policies (RLS)
-- Enable RLS on tables that need it
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects
CREATE POLICY project_access_policy ON projects
    FOR ALL TO authenticated_users
    USING (
        owner_id = current_user_id() OR
        id IN (
            SELECT project_id FROM project_collaborators
            WHERE user_id = current_user_id()
        ) OR
        is_public = true
    );

-- RLS policies for uploaded files
CREATE POLICY file_access_policy ON uploaded_files
    FOR ALL TO authenticated_users
    USING (
        project_id IN (
            SELECT id FROM projects WHERE
            owner_id = current_user_id() OR
            id IN (
                SELECT project_id FROM project_collaborators
                WHERE user_id = current_user_id()
            ) OR
            is_public = true
        )
    );

-- Create a function to get current user ID (will be implemented with JWT)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULL; -- This will be implemented with JWT authentication
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin user (optional - for initial setup)
-- This will be created through the application, not here

-- Create sample data (optional - for development)
-- This will be created through seed scripts

-- Create views for common queries
CREATE VIEW project_summary AS
SELECT
    p.id,
    p.name,
    p.description,
    p.visibility,
    p.created_at,
    p.updated_at,
    u.first_name || ' ' || u.last_name as owner_name,
    u.institution as owner_institution,
    COUNT(DISTINCT f.id) as file_count,
    COUNT(DISTINCT a.id) as analysis_count,
    COALESCE(SUM(f.file_size), 0) as total_file_size
FROM projects p
JOIN users u ON p.owner_id = u.id
LEFT JOIN uploaded_files f ON p.id = f.project_id
LEFT JOIN analysis_jobs a ON p.id = a.project_id
GROUP BY p.id, u.first_name, u.last_name, u.institution;

-- Create analysis summary view
CREATE VIEW analysis_summary AS
SELECT
    a.id,
    a.status,
    a.progress,
    a.created_at,
    a.started_at,
    a.completed_at,
    p.name as project_name,
    u.first_name || ' ' || u.last_name as creator_name,
    COUNT(DISTINCT si.id) as species_count,
    COALESCE(SUM(si.abundance), 0) as total_sequences
FROM analysis_jobs a
JOIN projects p ON a.project_id = p.id
JOIN users u ON a.created_by = u.id
LEFT JOIN species_identifications si ON a.id = si.analysis_id
GROUP BY a.id, p.name, u.first_name, u.last_name;

-- Grant permissions to the application user
-- These will be set based on the actual database user created
-- GRANT CONNECT ON DATABASE edna_platform TO edna_app;
-- GRANT USAGE ON SCHEMA public TO edna_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edna_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edna_app;

-- Create stored procedures for common operations
CREATE OR REPLACE FUNCTION create_project(
    p_name VARCHAR(255),
    p_description TEXT,
    p_owner_id UUID,
    p_visibility project_visibility DEFAULT 'private'
)
RETURNS UUID AS $$
DECLARE
    project_id UUID;
BEGIN
    INSERT INTO projects (name, description, owner_id, visibility)
    VALUES (p_name, p_description, p_owner_id, p_visibility)
    RETURNING id INTO project_id;

    RETURN project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_projects(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    visibility project_visibility,
    owner_name VARCHAR(201),
    file_count BIGINT,
    analysis_count BIGINT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.description,
        p.visibility,
        u.first_name || ' ' || u.last_name as owner_name,
        COUNT(DISTINCT f.id)::BIGINT as file_count,
        COUNT(DISTINCT a.id)::BIGINT as analysis_count,
        p.created_at,
        p.updated_at
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    LEFT JOIN uploaded_files f ON p.id = f.project_id
    LEFT JOIN analysis_jobs a ON p.id = a.project_id
    WHERE p.owner_id = p_user_id OR
          p.id IN (
              SELECT project_id FROM project_collaborators
              WHERE user_id = p_user_id
          )
    GROUP BY p.id, u.first_name, u.last_name
    ORDER BY p.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Database version and migration tracking
CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Insert initial migration
INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');

-- Create audit logging function (optional)
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Log changes to audit table (if implemented)
    -- This is a placeholder for audit functionality
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;