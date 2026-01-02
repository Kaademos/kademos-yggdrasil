/**
 * Document Service - Asgard
 * VULNERABLE: IDOR - No owner validation
 */

import { DatabaseService } from './database';

export interface Document {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  access_level: string;
}

export class DocumentService {
  constructor(private db: DatabaseService) {}

  async listDocuments(limit: number = 20): Promise<Document[]> {
    const result = await this.db.query(
      'SELECT id, title, access_level, owner_id FROM documents ORDER BY id DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  /**
   * VULNERABLE: IDOR - No ownership check
   */
  async getDocument(id: number): Promise<Document | null> {
    // SHOULD CHECK: WHERE id = $1 AND owner_id = $2
    // ACTUALLY DOES: WHERE id = $1 (IDOR vulnerability)
    const result = await this.db.query(
      'SELECT * FROM documents WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
}
