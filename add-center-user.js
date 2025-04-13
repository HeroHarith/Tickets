// Script to create a center user and sample venue
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

async function addCenterUser() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // 1. Create the center user
    const hashedPassword = await hashPassword('center123');
    
    const userResult = await pool.query(
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
    
    const centerUser = userResult.rows[0];
    console.log('Center user created:', centerUser);
    
    // 2. Create a sample venue owned by this center
    const venue = {
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
      },
      ownerId: centerUser.id,
      images: [
        'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2'
      ],
      isActive: true
    };
    
    const venueResult = await pool.query(
      `INSERT INTO venues (name, description, location, capacity, "hourlyRate", "dailyRate", 
                           facilities, "availabilityHours", "ownerId", images, "isActive", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING id, name, location`,
      [
        venue.name,
        venue.description,
        venue.location,
        venue.capacity,
        venue.hourlyRate,
        venue.dailyRate,
        venue.facilities,
        venue.availabilityHours,
        venue.ownerId,
        venue.images,
        venue.isActive,
        new Date()
      ]
    );
    
    const createdVenue = venueResult.rows[0];
    console.log('Venue created:', createdVenue);
    
    // 3. Create a second venue
    const venue2 = {
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
      },
      ownerId: centerUser.id,
      images: [
        'https://images.unsplash.com/photo-1497366754035-f200968a6e72'
      ],
      isActive: true
    };
    
    const venue2Result = await pool.query(
      `INSERT INTO venues (name, description, location, capacity, "hourlyRate", "dailyRate", 
                           facilities, "availabilityHours", "ownerId", images, "isActive", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING id, name, location`,
      [
        venue2.name,
        venue2.description,
        venue2.location,
        venue2.capacity,
        venue2.hourlyRate,
        venue2.dailyRate,
        venue2.facilities,
        venue2.availabilityHours,
        venue2.ownerId,
        venue2.images,
        venue2.isActive,
        new Date()
      ]
    );
    
    const createdVenue2 = venue2Result.rows[0];
    console.log('Second venue created:', createdVenue2);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('=======================');
    console.log('CENTER USER AND VENUES ADDED SUCCESSFULLY');
    console.log('Username: center1');
    console.log('Password: center123');
    console.log('Email: center@example.com');
    console.log('=======================');
    
    return { user: centerUser, venues: [createdVenue, createdVenue2] };
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Error adding center user and venues:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
addCenterUser()
  .then(() => {
    console.log('Center user and venues creation completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to create center user and venues:', err);
    process.exit(1);
  });