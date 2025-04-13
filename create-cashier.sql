-- SQL script to create a cashier user and entry
-- Note: Replace the hashed password with a properly hashed one in production

-- 1. Insert the cashier user
INSERT INTO users (
  username, 
  password, 
  email, 
  name, 
  role, 
  "emailVerified", 
  "createdAt"
) 
VALUES (
  'cashier1', 
  -- This is a hashed password for 'cashier123' - replace with your own secure hash in production
  '5e67a107ccb3d87d2bcc0db8d2244a038b3fba612ac75d6a307172026ea5d0dc5ae16e529f9c07030da3caa7d9503f7d94dbc27caec5dcca7d0d0bd00cd1be96.1ac5cd5b2c3f88cfc59c042c3f6f2f8f', 
  'cashier@example.com',
  'Test Cashier',
  'cashier',
  true,
  NOW()
)
RETURNING id AS cashier_user_id;

-- 2. Find a center user to assign the cashier to
WITH cashier_user AS (
  SELECT id AS cashier_user_id FROM users WHERE username = 'cashier1' AND role = 'cashier'
),
center_user AS (
  SELECT id AS center_user_id FROM users WHERE role = 'center' LIMIT 1
),
venue_ids AS (
  SELECT array_agg(id) AS venue_id_array 
  FROM venues 
  WHERE "ownerId" = (SELECT center_user_id FROM center_user)
  LIMIT 3
)

-- 3. Insert the cashier entry linking to the user
INSERT INTO cashiers (
  "userId", 
  "ownerId", 
  permissions, 
  "venueIds", 
  "createdAt", 
  "updatedAt"
)
SELECT 
  cashier_user.cashier_user_id,
  center_user.center_user_id,
  '{"manageBookings": true, "viewReports": false, "manageVenues": false, "processPayments": true}'::jsonb,
  COALESCE(venue_ids.venue_id_array, '{}'::int[]),
  NOW(),
  NOW()
FROM 
  cashier_user, 
  center_user, 
  venue_ids;