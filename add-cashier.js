// Script to create a cashier user and cashier entry in the database
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const { scrypt, randomBytes } = crypto;

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function addCashier() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // 1. Find a center owner - we need this for assigning the cashier
    const ownerResult = await pool.query(
      `SELECT id FROM users WHERE role = 'center' LIMIT 1`
    );
    
    if (ownerResult.rows.length === 0) {
      throw new Error('No center owner found in the database. Please create a center user first.');
    }
    
    const ownerId = ownerResult.rows[0].id;
    
    // 2. Create the cashier user
    const hashedPassword = await hashPassword('cashier123');
    
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
    console.log('Cashier user created:', cashierUser);
    
    // 3. Find available venues for this owner
    const venuesResult = await pool.query(
      `SELECT id FROM venues WHERE "ownerId" = $1 LIMIT 3`,
      [ownerId]
    );
    
    let venueIds = [];
    if (venuesResult.rows.length > 0) {
      venueIds = venuesResult.rows.map(row => row.id);
      console.log('Found venues to assign:', venueIds);
    } else {
      console.log('No venues found for this owner. Assigning empty array.');
    }
    
    // 4. Create cashier entry
    const permissions = {
      manageBookings: true,
      viewReports: false,
      manageVenues: false,
      processPayments: true
    };
    
    const cashierResult = await pool.query(
      `INSERT INTO cashiers ("userId", "ownerId", permissions, "venueIds", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, "userId", "ownerId", permissions, "venueIds"`,
      [
        cashierUser.id,
        ownerId,
        permissions,
        venueIds,
        new Date(),
        new Date()
      ]
    );
    
    const cashierEntry = cashierResult.rows[0];
    console.log('Cashier entry created:', cashierEntry);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('=======================');
    console.log('CASHIER ADDED SUCCESSFULLY');
    console.log('Username: cashier1');
    console.log('Password: cashier123');
    console.log('Email: cashier@example.com');
    console.log('=======================');
    
    return { user: cashierUser, cashier: cashierEntry };
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Error adding cashier:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
addCashier()
  .then(() => {
    console.log('Cashier creation completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to create cashier:', err);
    process.exit(1);
  });