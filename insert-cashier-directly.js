// Simple script to insert a cashier using direct SQL
import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

async function insertCashier() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Adding cashier user to database...');
    
    // First create a simple hashed password
    const hashedPassword = '5e67a107ccb3d87d2bcc0db8d2244a038b3fba612ac75d6a307172026ea5d0dc5ae16e529f9c07030da3caa7d9503f7d94dbc27caec5dcca7d0d0bd00cd1be96.1ac5cd5b2c3f88cfc59c042c3f6f2f8f';
    
    // Insert the cashier user
    const userResult = await pool.query(
      `INSERT INTO users (
        username, 
        password, 
        email, 
        name, 
        role, 
        "emailVerified", 
        "createdAt"
      ) 
      VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      ON CONFLICT (username) DO NOTHING
      RETURNING id`,
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
    
    let cashierUserId;
    if (userResult.rows.length > 0) {
      cashierUserId = userResult.rows[0].id;
      console.log(`Cashier user created with ID: ${cashierUserId}`);
    } else {
      // User might already exist, find them
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE username = $1 AND role = $2`,
        ['cashier1', 'cashier']
      );
      
      if (existingUser.rows.length > 0) {
        cashierUserId = existingUser.rows[0].id;
        console.log(`Found existing cashier user with ID: ${cashierUserId}`);
      } else {
        throw new Error('Failed to create or find cashier user');
      }
    }
    
    // Find a center user to associate the cashier with
    const centerResult = await pool.query(
      `SELECT id FROM users WHERE role = 'center' LIMIT 1`
    );
    
    if (centerResult.rows.length === 0) {
      throw new Error('No center user found in the database');
    }
    
    const centerUserId = centerResult.rows[0].id;
    console.log(`Found center user with ID: ${centerUserId}`);
    
    // Find venues owned by this center
    const venuesResult = await pool.query(
      `SELECT id FROM venues WHERE "ownerId" = $1 LIMIT 3`,
      [centerUserId]
    );
    
    const venueIds = venuesResult.rows.map(row => row.id);
    console.log(`Found venues: ${venueIds.join(', ')}`);
    
    // Create the cashier entry
    const permissions = {
      manageBookings: true,
      viewReports: false,
      manageVenues: false,
      processPayments: true
    };
    
    const cashierResult = await pool.query(
      `INSERT INTO cashiers (
        "userId", 
        "ownerId", 
        permissions, 
        "venueIds", 
        "createdAt", 
        "updatedAt"
      ) 
      VALUES (
        $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT ("userId") DO UPDATE 
      SET 
        permissions = $3,
        "venueIds" = $4,
        "updatedAt" = $6
      RETURNING id`,
      [
        cashierUserId,
        centerUserId,
        permissions,
        venueIds,
        new Date(),
        new Date()
      ]
    );
    
    if (cashierResult.rows.length > 0) {
      const cashierId = cashierResult.rows[0].id;
      console.log(`Cashier entry created/updated with ID: ${cashierId}`);
      
      console.log('\n===================================');
      console.log('Cashier user added successfully:');
      console.log('Username: cashier1');
      console.log('Password: cashier123');
      console.log('Email: cashier@example.com');
      console.log('===================================\n');
    } else {
      throw new Error('Failed to create cashier entry');
    }
    
  } catch (error) {
    console.error('Error inserting cashier:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
insertCashier()
  .then(() => console.log('Done'))
  .catch(err => console.error('Script failed:', err));