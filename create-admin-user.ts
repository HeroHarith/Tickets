import { db } from "./server/db";
import { users } from "./shared/schema";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

// Helper to hash password
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  try {
    const adminUsername = "admin";
    const adminPassword = "Password123!";
    const adminEmail = "admin@tickethub.com";
    const adminName = "System Administrator";

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.username, adminUsername));

    if (existingAdmin.length > 0) {
      console.log("Admin user already exists!");
      return;
    }

    // Create the admin user
    const [admin] = await db
      .insert(users)
      .values({
        username: adminUsername,
        password: await hashPassword(adminPassword),
        email: adminEmail,
        name: adminName,
        role: "admin",
        createdAt: new Date(),
      })
      .returning();

    console.log("Admin user created successfully:", {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });

    console.log("\nCredentials:");
    console.log(`Username: ${adminUsername}`);
    console.log(`Password: ${adminPassword}`);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    process.exit();
  }
}

createAdminUser();