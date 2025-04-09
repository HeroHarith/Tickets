import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserType, USER_ROLES } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import flash from "connect-flash";
import { sendVerificationEmail } from "./email";

// Extend Express.User interface to include our User type
declare global {
  namespace Express {
    // Define User interface instead of extending to avoid recursion
    interface User {
      id: number;
      username: string;
      password: string;
      email: string;
      name: string;
      role: string;
      createdAt: Date;
      emailVerified: boolean;
      verificationToken: string | null;
      verificationTokenExpires: Date | null;
      resetToken: string | null;
      resetTokenExpires: Date | null;
    }
  }
}

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

// Helper to hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Helper to compare password
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    // Handle simple passwords with SIMPLE: prefix
    if (stored.startsWith('SIMPLE:')) {
      return supplied === stored.substring(7); // 7 = length of 'SIMPLE:'
    }
    
    // Safety check for malformed hash
    if (!stored.includes('.')) {
      console.warn('Malformed password hash (no salt separator)');
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    
    // For our special admin accounts with simple SHA hashing
    if (salt === 'admin-salt-123') {
      const suppliedHash = createHash('sha256').update(supplied + salt).digest('hex');
      return suppliedHash === hashed;
    }
    
    // Standard scrypt comparison
    try {
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      
      // Safety check for buffer length
      if (hashedBuf.length !== suppliedBuf.length) {
        console.warn(`Buffer length mismatch: ${hashedBuf.length} vs ${suppliedBuf.length}`);
        return false;
      }
      
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } catch (error) {
      console.error('Error during password comparison:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in comparePasswords:', error);
    return false;
  }
}

// Role-based middleware
export function requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient privileges" });
    }
    
    next();
  };
}

// Setup authentication for the app
export function setupAuth(app: Express): void {
  // Session configuration
  const sessionConfig = {
    store: new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    name: 'ticketing-app-session',
    secret: process.env.SESSION_SECRET || 'ticket-app-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    }
  };

  // Middleware setup
  app.use(session(sessionConfig));
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy setup
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      
      const isValidPassword = await comparePasswords(password, user.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  // Serialization for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication routes
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, name, role } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Validate role if provided
      if (role && !USER_ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Create user with hashed password
      const hashedPassword = await hashPassword(password);
      // Always enforce customer role for regular registration (admin panel can change it later)
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        name,
        role: "customer", // Always default to customer role for regular registration
      });
      
      // Generate verification token and send email
      try {
        const verificationToken = await storage.createVerificationToken(user.id);
        
        // Send verification email
        await sendVerificationEmail({
          username: user.username,
          email: user.email,
          name: user.name,
          verificationToken
        });
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        // Continue with login even if email fails
      }
      
      // Auto-login after registration
      req.login(user, (err) => {
        if (err) return next(err);
        // Remove password from response
        const { password, ...userResponse } = user;
        res.status(201).json(userResponse);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user, (err: any) => {
        if (err) return next(err);
        // Remove password from response
        const { password, ...userResponse } = user;
        res.status(200).json(userResponse);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error during logout" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Remove password from response
    const { password, ...userResponse } = req.user;
    res.status(200).json(userResponse);
  });
}