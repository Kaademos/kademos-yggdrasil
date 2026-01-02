-- Asgard Database Initialization Script
-- OWASP A01:2025 - Broken Access Control + SSRF
-- Creates schema for HR portal with intentional IDOR and SQLi vulnerabilities

-- ============================================================================
-- TABLE: employees
-- Stores employee/user records for the HR system
-- ============================================================================
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  role VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: documents
-- HR documents with intentional IDOR vulnerability (no owner check)
-- ============================================================================
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  owner_id INTEGER REFERENCES employees(id),
  access_level VARCHAR(50) DEFAULT 'private',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: secrets
-- Stores sensitive secrets including the realm flag
-- Only accessible via SSRF through internal metadata service
-- ============================================================================
CREATE TABLE secrets (
  id SERIAL PRIMARY KEY,
  secret_type VARCHAR(100) NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  secret_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: access_logs (optional - for realism)
-- Tracks document access attempts
-- ============================================================================
CREATE TABLE access_logs (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  document_id INTEGER REFERENCES documents(id),
  action VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA: Employees (15 users across departments)
-- ============================================================================
INSERT INTO employees (username, name, department, role, email) VALUES
  ('thor.odinson', 'Thor Odinson', 'Security', 'Guard Captain', 'thor@asgard.realm'),
  ('heimdall.watch', 'Heimdall', 'Security', 'Sentinel', 'heimdall@asgard.realm'),
  ('freya.magic', 'Freya', 'Magic', 'Sorceress', 'freya@asgard.realm'),
  ('tyr.justice', 'Tyr', 'Justice', 'Judge', 'tyr@asgard.realm'),
  ('frigga.queen', 'Frigga', 'Administration', 'Queen Regent', 'frigga@asgard.realm'),
  ('balder.light', 'Balder', 'Diplomacy', 'Ambassador', 'balder@asgard.realm'),
  ('hodr.shadow', 'Hodr', 'Archives', 'Librarian', 'hodr@asgard.realm'),
  ('bragi.lore', 'Bragi', 'Archives', 'Historian', 'bragi@asgard.realm'),
  ('idunn.life', 'Idunn', 'Medical', 'Healer', 'idunn@asgard.realm'),
  ('forseti.peace', 'Forseti', 'Justice', 'Mediator', 'forseti@asgard.realm'),
  ('sif.warrior', 'Sif', 'Security', 'Shield Maiden', 'sif@asgard.realm'),
  ('vali.youth', 'Vali', 'Training', 'Combat Instructor', 'vali@asgard.realm'),
  ('vidar.silent', 'Vidar', 'Intelligence', 'Spy', 'vidar@asgard.realm'),
  ('ullr.hunt', 'Ullr', 'Reconnaissance', 'Tracker', 'ullr@asgard.realm'),
  ('odin.allfather', 'Odin Allfather', 'Administration', 'King', 'odin@asgard.realm');

-- ============================================================================
-- SEED DATA: Documents (25+ documents with varying access levels)
-- Documents 1-20: Regular employee documents
-- Documents 21-25: Admin documents with sensitive info
-- ============================================================================

-- Regular employee documents
INSERT INTO documents (title, content, owner_id, access_level) VALUES
  ('Security Patrol Schedule', 'Week 1 schedule: Morning patrol - Thor, Evening patrol - Heimdall', 1, 'department'),
  ('Guard Training Manual', 'Basic combat techniques and defensive protocols for new guards.', 2, 'public'),
  ('Magic Research Notes', 'Preliminary findings on enchantment stability in Bifrost energy.', 3, 'private'),
  ('Legal Case Files Q4', 'Summary of resolved disputes and pending judicial reviews.', 4, 'private'),
  ('Palace Event Planning', 'Upcoming feast preparations and guest list management.', 5, 'department'),
  ('Diplomatic Mission Report', 'Recent visit to Alfheim - trade agreements and cultural exchange.', 6, 'private'),
  ('Archive Catalog Update', 'New acquisitions: 47 scrolls from the Vanir library exchange.', 7, 'public'),
  ('Historical Battle Records', 'Analysis of the Battle of Vanaheim - strategic lessons learned.', 8, 'public'),
  ('Healing Garden Inventory', 'Current stock of medicinal herbs and potion ingredients.', 9, 'department'),
  ('Mediation Guidelines', 'Best practices for conflict resolution in inter-realm disputes.', 10, 'public'),
  ('Weapon Maintenance Log', 'Quarterly inspection results for palace armory.', 11, 'department'),
  ('Combat Training Syllabus', 'Advanced techniques for Einherjar warriors - 12 week program.', 12, 'department'),
  ('Intelligence Briefing', 'Surveillance report on suspicious activity near the bifrost.', 13, 'private'),
  ('Reconnaissance Map Update', 'New trails discovered in Jotunheim border regions.', 14, 'private'),
  ('Employee Benefits Guide', 'Healthcare, housing, and mead hall privileges for palace staff.', 15, 'public'),
  ('Security Incident Report', 'Minor breach at west gate - resolved, no casualties.', 1, 'department'),
  ('Magic Safety Protocols', 'Updated guidelines for handling unstable enchantments.', 3, 'public'),
  ('Court Session Minutes', 'Record of rulings from the last justice assembly.', 4, 'public'),
  ('Palace Supply Requisition', 'Quarterly orders for food, supplies, and equipment.', 5, 'department'),
  ('Cultural Exchange Program', 'Proposal for student exchange with Vanaheim scholars.', 6, 'private'),

-- Sensitive admin documents (targets for IDOR exploitation)
  ('System Architecture Overview', 'Internal network topology: Main palace systems connected via Yggdrasil-Net. Critical services: HR Portal (port 3000), Internal Metadata Service (port 9090, localhost only). Metadata endpoint: http://localhost:9090/metadata/secrets', 15, 'admin'),
  ('HR Admin Access Guide', 'Administrative functions: Employee management requires role=admin. Document access should verify owner_id but currently lacks authorization checks (IDOR vulnerability). Search function uses string concatenation (SQLi risk).', 15, 'admin'),
  ('Security Audit Findings', 'CRITICAL: Odin-View screenshot service accepts arbitrary URLs without validation. RISK: Internal services accessible via SSRF. MITIGATION: Pending implementation of URL allowlist.', 15, 'admin'),
  ('Database Credentials', 'PostgreSQL: hr_admin / [REDACTED]. Tables: employees, documents, secrets, access_logs. Admin note: Secrets table contains realm flag for progression tracking.', 15, 'admin'),
  ('Internal API Documentation', 'Metadata Service (localhost:9090): GET /metadata/secrets returns system secrets including realm flag. NOTE: Service not exposed externally but accessible via screenshot service SSRF.', 15, 'admin');

-- ============================================================================
-- SEED DATA: Secrets (Flag and system secrets)
-- ============================================================================
INSERT INTO secrets (secret_type, secret_key, secret_value) VALUES
  ('flag', 'asgard_master_key', 'YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}'),
  ('api_key', 'bifrost_gateway', 'BF-KEY-2025-RAINBOW-BRIDGE-ACCESS'),
  ('system', 'metadata_service_url', 'http://localhost:9090'),
  ('system', 'encryption_key', 'ASG-ENC-GOLDEN-HALLS-PROTECTION');

-- ============================================================================
-- SEED DATA: Access Logs (sample activity for realism)
-- ============================================================================
INSERT INTO access_logs (employee_id, document_id, action) VALUES
  (1, 1, 'view'),
  (2, 2, 'view'),
  (3, 3, 'edit'),
  (15, 21, 'view'),
  (15, 22, 'view'),
  (13, 13, 'view');

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_access_level ON documents(access_level);
CREATE INDEX idx_employees_username ON employees(username);
CREATE INDEX idx_secrets_type ON secrets(secret_type);

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================
COMMENT ON TABLE documents IS 'HR documents with intentional IDOR vulnerability - owner_id check missing';
COMMENT ON TABLE secrets IS 'System secrets accessible only via SSRF through internal metadata service';
COMMENT ON COLUMN documents.owner_id IS 'VULNERABLE: Access control should check this but currently does not (IDOR)';

-- ============================================================================
-- Database initialization complete
-- ============================================================================
