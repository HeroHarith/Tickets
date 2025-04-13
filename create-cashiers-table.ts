import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./shared/schema";

// Configure WebSocket for Neon
import { neonConfig } from "@neondatabase/serverless";
neonConfig.webSocketConstructor = ws;

async function createCashiersTable() {
  // Configure Neon serverless
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  try {
    console.log("Creating cashiers table...");
    
    // Create the cashiers table using SQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cashiers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        owner_id INTEGER NOT NULL REFERENCES users(id),
        permissions JSONB NOT NULL DEFAULT '{}',
        venue_ids INTEGER[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log("Cashiers table created successfully!");
  } catch (error) {
    console.error("Error creating cashiers table:", error);
  } finally {
    await pool.end();
  }
}

createCashiersTable().catch(console.error);