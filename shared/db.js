// Database helper functions for Cloudflare D1

export class Database {
  constructor(db) {
    this.db = db;
  }

  // Users
  async getUser(id) {
    const stmt = await this.db.prepare('SELECT * FROM users WHERE id = ?1').bind(id);
    return stmt.first();
  }

  async getUserByGoogleId(googleId) {
    const stmt = await this.db.prepare('SELECT * FROM users WHERE google_id = ?1').bind(googleId);
    return stmt.first();
  }

  async getUserByEmail(email) {
    const stmt = await this.db.prepare('SELECT * FROM users WHERE email = ?1').bind(email);
    return stmt.first();
  }

  async createUser(id, googleId, name, email, trialDays = 30) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    
    const stmt = await this.db.prepare(`
      INSERT INTO users (id, google_id, name, email, trial_end)
      VALUES (?1, ?2, ?3, ?4, ?5)
    `).bind(id, googleId, name, email, trialEnd.toISOString());
    
    return stmt.run();
  }

  async getAllUsers(limit = 100, offset = 0) {
    const stmt = await this.db.prepare(`
      SELECT id, google_id, name, email, role, trial_end, is_blocked, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ?1 OFFSET ?2
    `).bind(limit, offset);
    
    return stmt.all();
  }

  async updateUserRole(userId, role) {
    const stmt = await this.db.prepare(`
      UPDATE users SET role = ?1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2
    `).bind(role, userId);
    
    return stmt.run();
  }

  async linkUserGoogleId(userId, googleId) {
    const stmt = await this.db.prepare(`
      UPDATE users
      SET google_id = ?1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2
    `).bind(googleId, userId);

    return stmt.run();
  }

  async blockUser(userId, blocked = true) {
    const stmt = await this.db.prepare(`
      UPDATE users SET is_blocked = ?1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2
    `).bind(blocked ? 1 : 0, userId);
    
    return stmt.run();
  }

  async extendTrial(userId, additionalDays = 30) {
    const stmt = await this.db.prepare(`
      UPDATE users 
      SET trial_end = datetime(trial_end, '+' || ?1 || ' days'),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2
    `).bind(additionalDays, userId);
    
    return stmt.run();
  }

  // Vouchers
  async createVoucher(voucherData) {
    const {
      id, userId, publicId, date, voucherNo, payTo, codeNo, 
      controlAc, particulars, amount, amountWords, accountNo, paymentMethod,
      preparedBy = null, verifiedBy = null, recommendedBy = null, approvedBy = null, status = 'printed'
    } = voucherData;

    const stmt = await this.db.prepare(`
      INSERT INTO vouchers (
        id, user_id, public_id, date, voucher_no, pay_to, code_no,
        control_ac, particulars, amount, amount_words, account_no, payment_method,
        prepared_by, verified_by, recommended_by, approved_by, status
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
    `).bind(
      id, userId, publicId, date, voucherNo, payTo, codeNo,
      controlAc, particulars, amount, amountWords, accountNo, paymentMethod,
      preparedBy, verifiedBy, recommendedBy, approvedBy, status
    );

    return stmt.run();
  }

  async getVoucher(id) {
    const stmt = await this.db.prepare('SELECT * FROM vouchers WHERE id = ?1').bind(id);
    return stmt.first();
  }

  async getVoucherByPublicId(publicId) {
    const stmt = await this.db.prepare('SELECT * FROM vouchers WHERE public_id = ?1').bind(publicId);
    return stmt.first();
  }

  async getUserVouchers(userId, limit = 50, offset = 0) {
    const stmt = await this.db.prepare(`
      SELECT * FROM vouchers
      WHERE user_id = ?1
      ORDER BY created_at DESC
      LIMIT ?2 OFFSET ?3
    `).bind(userId, limit, offset);

    return stmt.all();
  }

  async getUserSavedListsAll(userId, limit = 5000) {
    const stmt = await this.db.prepare(`
      SELECT * FROM saved_lists
      WHERE user_id = ?1
      ORDER BY added_at DESC
      LIMIT ?2
    `).bind(userId, limit);

    return stmt.all();
  }

  async getUserAuditLogs(userId, limit = 5000) {
    const stmt = await this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE user_id = ?1
      ORDER BY created_at DESC
      LIMIT ?2
    `).bind(userId, limit);

    return stmt.all();
  }

  async getAllVouchers(limit = 500, offset = 0) {
    const stmt = await this.db.prepare(`
      SELECT * FROM vouchers
      ORDER BY created_at DESC
      LIMIT ?1 OFFSET ?2
    `).bind(limit, offset);

    return stmt.all();
  }

  async updateVoucher(id, updates) {
    const fields = [];
    const values = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id') {
        // Convert camelCase to snake_case
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?${values.length + 1}`);
        values.push(value);
      }
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE vouchers SET ${fields.join(', ')} WHERE id = ?${values.length}`;
    const stmt = await this.db.prepare(sql).bind(...values);

    return stmt.run();
  }

  async incrementPrintCount(voucherId) {
    const stmt = await this.db.prepare(`
      UPDATE vouchers 
      SET print_count = print_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
    `).bind(voucherId);

    return stmt.run();
  }

  // Saved Lists
  async getSavedList(userId, type, limit = 20) {
    const stmt = await this.db.prepare(`
      SELECT value FROM saved_lists
      WHERE user_id = ?1 AND type = ?2
      ORDER BY usage_count DESC, added_at DESC
      LIMIT ?3
    `).bind(userId, type, limit);

    const results = await stmt.all();
    return results.results?.map(r => r.value) || [];
  }

  async addToSavedList(userId, type, value) {
    // Check if already exists
    const existing = await this.db.prepare(`
      SELECT id FROM saved_lists WHERE user_id = ?1 AND type = ?2 AND value = ?3
    `).bind(userId, type, value);

    const result = await existing.first();

    if (result) {
      // Update usage count
      const stmt = await this.db.prepare(`
        UPDATE saved_lists 
        SET usage_count = usage_count + 1, added_at = CURRENT_TIMESTAMP
        WHERE user_id = ?1 AND type = ?2 AND value = ?3
      `).bind(userId, type, value);
      return stmt.run();
    } else {
      // Insert new
      const { generateId } = await import('./utils.js');
      const stmt = await this.db.prepare(`
        INSERT INTO saved_lists (id, user_id, type, value)
        VALUES (?1, ?2, ?3, ?4)
      `).bind(generateId('sl'), userId, type, value);
      return stmt.run();
    }
  }

  // System Settings
  async getSetting(key) {
    const stmt = await this.db.prepare('SELECT value FROM system_settings WHERE key = ?1').bind(key);
    const result = await stmt.first();
    return result?.value;
  }

  async setSetting(key, value, updatedBy = null) {
    const stmt = await this.db.prepare(`
      INSERT INTO system_settings (key, value, updated_by)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(key) DO UPDATE SET value = ?2, updated_by = ?3, updated_at = CURRENT_TIMESTAMP
    `).bind(key, value, updatedBy);

    return stmt.run();
  }

  // Audit Logs
  async logAction(userId, action, entityType = null, entityId = null, details = null, ipAddress = null) {
    const { generateId } = await import('./utils.js');
    const stmt = await this.db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(generateId('log'), userId, action, entityType, entityId, details, ipAddress);

    return stmt.run();
  }

  async getAuditLogs(limit = 100, offset = 0) {
    const stmt = await this.db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?1 OFFSET ?2
    `).bind(limit, offset);

    return stmt.all();
  }

  async getAuditLogsByEntity(entityType, entityId, limit = 100) {
    const stmt = await this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE entity_type = ?1 AND entity_id = ?2
      ORDER BY created_at DESC
      LIMIT ?3
    `).bind(entityType, entityId, limit);

    return stmt.all();
  }

  async getAuditLogsByActionPrefix(actionPrefix, limit = 100) {
    const stmt = await this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE action LIKE ?1
      ORDER BY created_at DESC
      LIMIT ?2
    `).bind(`${actionPrefix}%`, limit);

    return stmt.all();
  }

  // Statistics
  async getUserStats(userId) {
    const voucherStmt = await this.db.prepare(`
      SELECT COUNT(*) as total, SUM(amount) as total_amount
      FROM vouchers
      WHERE user_id = ?1
    `).bind(userId);

    const voucherData = await voucherStmt.first();
    return voucherData;
  }

  async getSystemStats() {
    const userStmt = await this.db.prepare('SELECT COUNT(*) as total FROM users');
    const voucherStmt = await this.db.prepare('SELECT COUNT(*) as total, SUM(amount) as total_amount FROM vouchers');
    
    const users = await userStmt.first();
    const vouchers = await voucherStmt.first();

    return {
      totalUsers: users?.total || 0,
      totalVouchers: vouchers?.total || 0,
      totalAmount: vouchers?.total_amount || 0
    };
  }
}

export default Database;
