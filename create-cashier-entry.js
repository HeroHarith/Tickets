// Script to create a cashier entry in the cashiers table
const { Pool } = require('pg');

async function createCashierEntry() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // First, find the user ID of the cashier user
    const userResult = await pool.query(
      `SELECT id FROM users WHERE role = 'cashier' AND username = 'cashier1'`
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Cashier user not found. Run create-cashier-user.js first.');
    }
    
    const userId = userResult.rows[0].id;
    
    // Find a center owner to assign the cashier to
    const ownerResult = await pool.query(
      `SELECT id FROM users WHERE role = 'center' LIMIT 1`
    );
    
    if (ownerResult.rows.length === 0) {
      throw new Error('No center owner found in the database. Please create one first.');
    }
    
    const ownerId = ownerResult.rows[0].id;
    
    // Default permissions for the cashier
    const permissions = {
      manageBookings: true,
      viewReports: false,
      manageVenues: false,
      processPayments: true
    };
    
    // Insert cashier entry
    const result = await pool.query(
      `INSERT INTO cashiers ("userId", "ownerId", permissions, "venueIds", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, "userId", "ownerId", permissions, "venueIds"`,
      [
        userId,
        ownerId,
        permissions,
        [1], // Assign to venue ID 1, adjust as needed
        new Date(),
        new Date()
      ]
    );
    
    const cashier = result.rows[0];
    console.log('Cashier entry created successfully:', cashier);
    
    await pool.end();
    
    return cashier;
  } catch (error) {
    console.error('Error creating cashier entry:', error);
    throw error;
  }
}

// Run the function
createCashierEntry()
  .then(() => {
    console.log('Cashier entry creation completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to create cashier entry:', err);
    process.exit(1);
  });