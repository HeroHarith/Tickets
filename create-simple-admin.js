// Simple script to create an admin user with a plain text password
const { Pool } = require('pg');
const crypto = require('crypto');

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create a very simple password hash
function simpleHash(password) {
  // Plain text password with a simple prefix for minimal security
  return `SIMPLE:${password}`;
}

async function createSimpleAdmin() {
  try {
    const username = 'simpleadmin';
    const password = 'admin123';
    const hashedPassword = simpleHash(password);
    
    console.log(`Creating admin user: ${username}`);
    console.log(`With password: ${password}`);
    console.log(`Hashed as: ${hashedPassword}`);
    
    // Insert the user
    const result = await pool.query(
      `INSERT INTO users (username, password, name, email, role, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (username) DO UPDATE
       SET password = $2
       RETURNING id, username, name, email, role`,
      [username, hashedPassword, 'Simple Admin', 'simple@admin.com', 'admin']
    );
    
    console.log('Admin user created successfully:');
    console.log(result.rows[0]);
    
    await pool.end();
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createSimpleAdmin();
