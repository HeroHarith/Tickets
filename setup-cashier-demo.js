// Script to set up the complete cashier demo environment
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';
import { execSync } from 'child_process';

const { Pool } = pg;
const { scrypt, randomBytes } = crypto;

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function setupCashierDemo() {
  console.log('Starting cashier demo setup...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // 1. Check if tables exist, if not, run the drizzle push
    console.log('Checking database schema...');
    try {
      await pool.query('SELECT * FROM users LIMIT 1');
      console.log('Users table exists');
    } catch (error) {
      console.log('Setting up database schema...');
      // Run drizzle push to create all tables
      execSync('npm run db:push', { stdio: 'inherit' });
      console.log('Database schema created');
    }
    
    // 2. Check if we need to create the cashiers table
    try {
      await pool.query('SELECT * FROM cashiers LIMIT 1');
      console.log('Cashiers table exists');
    } catch (error) {
      console.log('Setting up cashiers table...');
      // Create the cashiers table
      execSync('node create-cashiers-table.js', { stdio: 'inherit' });
      console.log('Cashiers table created');
    }
    
    // 3. Check if center user exists, if not create one
    const centerUserResult = await pool.query(
      `SELECT id FROM users WHERE role = 'center' LIMIT 1`
    );
    
    let centerUserId;
    
    if (centerUserResult.rows.length === 0) {
      console.log('Creating center user and sample venues...');
      // No center user, create one
      const hashedPassword = await hashPassword('center123');
      
      const centerResult = await pool.query(
        `INSERT INTO users (username, password, email, name, role, "emailVerified", "createdAt") 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, username, email, name, role`,
        [
          'center1', 
          hashedPassword, 
          'center@example.com',
          'Test Venue Center',
          'center',
          true,
          new Date()
        ]
      );
      
      centerUserId = centerResult.rows[0].id;
      console.log('Center user created with ID:', centerUserId);
      
      // Create sample venues
      const venues = [
        {
          name: 'Main Conference Hall',
          description: 'A spacious conference hall for large events',
          location: '123 Business District',
          capacity: 200,
          hourlyRate: '150.00',
          dailyRate: '1000.00',
          facilities: ['Projector', 'Sound System', 'WiFi', 'Catering'],
          availabilityHours: {
            monday: '08:00-22:00',
            tuesday: '08:00-22:00',
            wednesday: '08:00-22:00',
            thursday: '08:00-22:00',
            friday: '08:00-22:00',
            saturday: '10:00-18:00',
            sunday: '10:00-16:00'
          }
        },
        {
          name: 'Small Meeting Room',
          description: 'Intimate meeting room for small groups',
          location: '123 Business District',
          capacity: 20,
          hourlyRate: '50.00',
          dailyRate: '350.00',
          facilities: ['TV Screen', 'WiFi', 'Whiteboard'],
          availabilityHours: {
            monday: '08:00-22:00',
            tuesday: '08:00-22:00',
            wednesday: '08:00-22:00',
            thursday: '08:00-22:00',
            friday: '08:00-22:00',
            saturday: '10:00-18:00',
            sunday: '10:00-16:00'
          }
        }
      ];
      
      for (const venue of venues) {
        await pool.query(
          `INSERT INTO venues (name, description, location, capacity, "hourlyRate", "dailyRate", 
                               facilities, "availabilityHours", "ownerId", "isActive", "createdAt") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            venue.name,
            venue.description,
            venue.location,
            venue.capacity,
            venue.hourlyRate,
            venue.dailyRate,
            venue.facilities,
            venue.availabilityHours,
            centerUserId,
            true,
            new Date()
          ]
        );
      }
      
      console.log('Sample venues created');
    } else {
      centerUserId = centerUserResult.rows[0].id;
      console.log('Center user already exists with ID:', centerUserId);
    }
    
    // 4. Check if cashier user exists, if not create one
    const cashierUserResult = await pool.query(
      `SELECT id FROM users WHERE role = 'cashier' LIMIT 1`
    );
    
    if (cashierUserResult.rows.length === 0) {
      console.log('Creating cashier user...');
      
      // Get venue IDs for this center
      const venuesResult = await pool.query(
        `SELECT id FROM venues WHERE "ownerId" = $1 LIMIT 3`,
        [centerUserId]
      );
      
      let venueIds = [];
      if (venuesResult.rows.length > 0) {
        venueIds = venuesResult.rows.map(row => row.id);
      }
      
      // Create cashier user
      const hashedPassword = await hashPassword('cashier123');
      
      const cashierResult = await pool.query(
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
      
      const cashierUserId = cashierResult.rows[0].id;
      console.log('Cashier user created with ID:', cashierUserId);
      
      // Create cashier entry
      const permissions = {
        manageBookings: true,
        viewReports: false,
        manageVenues: false,
        processPayments: true
      };
      
      await pool.query(
        `INSERT INTO cashiers ("userId", "ownerId", permissions, "venueIds", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          cashierUserId,
          centerUserId,
          permissions,
          venueIds,
          new Date(),
          new Date()
        ]
      );
      
      console.log('Cashier entry created');
    } else {
      console.log('Cashier user already exists');
    }
    
    console.log('=======================');
    console.log('SETUP COMPLETED SUCCESSFULLY');
    console.log('Center Login:');
    console.log('Username: center1');
    console.log('Password: center123');
    console.log('');
    console.log('Cashier Login:');
    console.log('Username: cashier1');
    console.log('Password: cashier123');
    console.log('=======================');
    
  } catch (error) {
    console.error('Error setting up cashier demo:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
setupCashierDemo()
  .then(() => {
    console.log('Cashier demo setup completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to set up cashier demo:', err);
    process.exit(1);
  });