-- NIDAVELLIR Database Schema
-- Dwarven Forge Artifact Catalog
-- OWASP A05:2025 - Injection (SQL Injection via UNION)

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS secrets CASCADE;
DROP TABLE IF EXISTS artifacts CASCADE;
DROP TABLE IF EXISTS forge_masters CASCADE;

-- Public artifacts table (search target)
CREATE TABLE artifacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rarity VARCHAR(50) NOT NULL, -- Common, Uncommon, Rare, Legendary
  forge_date DATE NOT NULL,
  forge_master VARCHAR(100),
  material VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- SPOILER: Protected secrets table - should not be accessible via normal queries
-- VULNERABLE: Can be accessed via UNION SELECT injection
CREATE TABLE secrets (
  id SERIAL PRIMARY KEY,
  realm VARCHAR(50) NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  security_level VARCHAR(20) DEFAULT 'CLASSIFIED',
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP
);

-- Forge masters table (decoy, not used in exploit but adds realism)
CREATE TABLE forge_masters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  rank VARCHAR(50),
  years_experience INTEGER
);

-- Insert sample artifacts (10 items for realistic catalog)
INSERT INTO artifacts (name, description, rarity, forge_date, forge_master, material) VALUES
('Mjolnir Replica', 'A faithful reproduction of Thor''s legendary hammer', 'Legendary', '2024-01-15', 'Brok', 'Uru Metal'),
('Dragonscale Sword', 'Blade forged from ancient dragon scales', 'Rare', '2024-02-20', 'Sindri', 'Dragon Steel'),
('Iron Helm', 'Standard issue helmet for warriors', 'Common', '2024-03-10', 'Eitri', 'Iron'),
('Gleaming Shield', 'A polished shield that reflects light', 'Uncommon', '2024-03-15', 'Brok', 'Bronze'),
('Runic Dagger', 'Small blade inscribed with protective runes', 'Rare', '2024-04-01', 'Sindri', 'Mithril'),
('Leather Bracers', 'Simple arm protection', 'Common', '2024-04-10', 'Eitri', 'Leather'),
('Flaming Sword', 'Blade that burns with eternal fire', 'Legendary', '2024-05-05', 'Brok', 'Volcanic Steel'),
('Chain Mail', 'Interlocking rings of protective metal', 'Uncommon', '2024-05-20', 'Eitri', 'Steel'),
('Frost Axe', 'Double-bladed axe imbued with ice magic', 'Rare', '2024-06-01', 'Sindri', 'Frost Iron'),
('Wooden Practice Sword', 'Training weapon for apprentices', 'Common', '2024-06-15', 'Eitri', 'Oak');

-- Insert forge masters (adds realism to schema)
INSERT INTO forge_masters (name, specialization, rank, years_experience) VALUES
('Brok', 'Legendary Weapons', 'Master Smith', 500),
('Sindri', 'Magical Artifacts', 'Master Smith', 500),
('Eitri', 'Standard Equipment', 'Journeyman', 150),
('Ivaldi', 'Armor Crafting', 'Expert Smith', 300),
('Dvalin', 'Enchantments', 'Master Enchanter', 400);

-- SPOILER: Insert realm secret (FLAG) - target of UNION SELECT injection
-- EXPLOIT: Use UNION SELECT to extract from secrets table
INSERT INTO secrets (realm, access_code, security_level) VALUES
('NIDAVELLIR', 'YGGDRASIL{NIDAVELLIR:8f4c2e1a-9b3d-4f7e-a1c5-6d8b2f4e9a7c}', 'TOP_SECRET');

-- Insert decoy secrets to make enumeration more realistic
INSERT INTO secrets (realm, access_code, security_level) VALUES
('FORGE_MASTER_VAULT', 'PLACEHOLDER_NOT_REAL_FLAG', 'SECRET'),
('ARTIFACT_CATALOG', 'INTERNAL_USE_ONLY', 'CONFIDENTIAL');

-- Create indices for better query performance
CREATE INDEX idx_artifacts_rarity ON artifacts(rarity);
CREATE INDEX idx_artifacts_name ON artifacts(name);
CREATE INDEX idx_secrets_realm ON secrets(realm);

-- Add comments for documentation
COMMENT ON TABLE artifacts IS 'Public catalog of forged items - searchable via /api/search';
COMMENT ON TABLE secrets IS 'Protected access codes - VULNERABLE to UNION SELECT injection';
COMMENT ON COLUMN secrets.access_code IS 'Sensitive data - contains realm flags';
COMMENT ON TABLE forge_masters IS 'Forge master directory - decoy table for realism';
