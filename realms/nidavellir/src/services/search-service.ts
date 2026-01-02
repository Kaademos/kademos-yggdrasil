/**
 * Search Service - VULNERABLE TO UNION-BASED SQL INJECTION
 * 
 * OWASP A05:2025 - Injection
 * Vulnerability: Unsanitized user input in SQL query enables UNION SELECT attacks
 * 
 * SPOILER: This service is intentionally vulnerable for educational purposes
 * EXPLOIT: Use UNION SELECT to extract data from the secrets table
 */

import { DatabaseService } from './database';

export interface Artifact {
  id: number;
  name: string;
  description: string;
  rarity: string;
  forge_date: string;
  forge_master?: string;
  material?: string;
}

export class SearchService {
  constructor(private db: DatabaseService) {}

  /**
   * Search artifacts - VULNERABLE TO UNION-BASED SQL INJECTION
   * 
   * VULNERABLE: User input is concatenated directly into SQL query
   * EXPLOIT: Attackers can use UNION SELECT to extract from secrets table
   * 
   * Example exploit payloads:
   * - ' OR '1'='1'-- (basic SQLi)
   * - ' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL-- (column count)
   * - ' UNION SELECT id,realm,access_code,security_level,NULL,NULL,NULL FROM secrets-- (flag extraction)
   */
  async searchArtifacts(searchQuery: string): Promise<Artifact[]> {
    // VULNERABLE CODE: Direct string concatenation - NO PARAMETERIZATION
    // This allows SQL injection attacks including UNION SELECT
    const query = `
      SELECT id, name, description, rarity, forge_date, forge_master, material
      FROM artifacts
      WHERE name ILIKE '%${searchQuery}%'
         OR description ILIKE '%${searchQuery}%'
         OR forge_master ILIKE '%${searchQuery}%'
      ORDER BY rarity DESC, name ASC
    `;

    // VULNERABLE: Let SQL errors propagate with full details for educational purposes
    // This helps students learn UNION injection technique
    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Get all artifacts (safe query with proper ordering)
   */
  async getAllArtifacts(): Promise<Artifact[]> {
    const query = `
      SELECT id, name, description, rarity, forge_date, forge_master, material
      FROM artifacts
      ORDER BY rarity DESC, name ASC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Get artifact by ID (safe query with parameterization)
   * 
   * This demonstrates the PROPER way to handle user input
   */
  async getArtifactById(id: number): Promise<Artifact | null> {
    // CORRECT: Parameterized query prevents SQL injection
    const query = `
      SELECT id, name, description, rarity, forge_date, forge_master, material
      FROM artifacts
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Search artifacts (SAFE version) - for comparison
   * 
   * This shows how the vulnerable searchArtifacts() SHOULD be implemented
   */
  async searchArtifactsSafe(searchQuery: string): Promise<Artifact[]> {
    // CORRECT: Parameterized query with placeholders
    const query = `
      SELECT id, name, description, rarity, forge_date, forge_master, material
      FROM artifacts
      WHERE name ILIKE $1 OR description ILIKE $1 OR forge_master ILIKE $1
      ORDER BY rarity DESC, name ASC
    `;

    const result = await this.db.query(query, [`%${searchQuery}%`]);
    return result.rows;
  }
}
