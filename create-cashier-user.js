// Script to create a cashier user in the database
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const { scrypt, randomBytes, timingSafeEqual } = crypto;

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createCashierUser() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Hash a simple password for the cashier user
    const hashedPassword = await hashPassword('cashier123');
    
    // Insert cashier user
    const userResult = await pool.query(
      `INSERT INTO users (username, password, email, name, role, "emailVerified", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, username, email, name, role`,
      [
        'cashier1', 
        hashedPassword, 
        'cashier@example.com',
        'Test Cashier',
        'cashier',
        true,
        new Date()
      ]
    );

    const cashierUser = userResult.rows[0];
    console.log('Cashier user created successfully:', cashierUser);
    
    await pool.end();
    
    return cashierUser;
  } catch (error) {
    console.error('Error creating cashier user:', error);
    throw error;
  }
}

// Run the function
createCashierUser()
  .then(() => {
    console.log('Cashier user creation completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to create cashier user:', err);
    process.exit(1);
  });