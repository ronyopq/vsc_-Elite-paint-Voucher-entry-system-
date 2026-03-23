// Database initialization script
// Run migrations and seed initial data

import Database from './shared/db.js';
import { generateId } from './shared/utils.js';

export async function initializeDatabase(db) {
  try {
    // Create demo admin user if needed
    const adminEmail = process.env.SUPER_ADMIN_EMAILS?.split(',')[0];
    
    if (adminEmail) {
      const existing = await db.getUserByEmail(adminEmail);
      
      if (!existing) {
        console.log(`Creating admin user: ${adminEmail}`);
        const adminId = generateId('admin');
        
        await db.createUser(
          adminId,
          'admin-' + adminId, // Fake Google ID for demo
          'System Administrator',
          adminEmail,
          365 // 1 year trial
        );
        
        // Set role to super_admin (requires direct DB access)
        console.log(`Admin user created. Update role to 'super_admin' in database.`);
      }
    }

    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

export default initializeDatabase;
