// Simple script to create an admin user with a plain text password
import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create a very simple password hash
function simpleHash(password) {
  // Plain text password with a simple prefix for minimal security
  return `SIMPLE:${password}`;
}

// Also update the auth.ts file to recognize this format
async function updateAuthFile() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const authFilePath = 'server/auth.ts';
    let authContent = fs.readFileSync(authFilePath, 'utf8');
    
    // Check if we already added the SIMPLE: handler
    if (authContent.includes('SIMPLE:')) {
      console.log('Auth file already updated for SIMPLE: prefix');
      return;
    }
    
    // Find the password comparison function
    const comparePasswordsFunc = authContent.match(/async function comparePasswords[\s\S]*?\{[\s\S]*?return false;[\s\S]*?\}/m);
    
    if (!comparePasswordsFunc) {
      console.log('Could not find comparePasswords function in auth.ts');
      return;
    }
    
    // Add SIMPLE: prefix handling
    const updatedFunction = comparePasswordsFunc[0].replace(
      '// Safety check for malformed hash',
      `// Handle simple passwords with SIMPLE: prefix
    if (stored.startsWith('SIMPLE:')) {
      return supplied === stored.substring(7); // 7 = length of 'SIMPLE:'
    }
    
    // Safety check for malformed hash`
    );
    
    // Replace the function in the file
    const updatedContent = authContent.replace(comparePasswordsFunc[0], updatedFunction);
    
    fs.writeFileSync(authFilePath, updatedContent, 'utf8');
    console.log('Updated auth.ts file to handle SIMPLE: passwords');
  } catch (error) {
    console.error('Error updating auth file:', error);
  }
}

async function createSimpleAdmin() {
  try {
    await updateAuthFile();
    
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
