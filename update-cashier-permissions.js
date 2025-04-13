/**
 * This script demonstrates how to update cashier permissions through the API
 * Run this with: node update-cashier-permissions.js [cashier_id]
 * 
 * Example: node update-cashier-permissions.js 1
 */

import fetch from 'node-fetch';

async function updateCashierPermissions() {
  try {
    // Get cashier ID from command line arguments
    const cashierId = process.argv[2];
    if (!cashierId) {
      console.error('Please provide a cashier ID as an argument');
      console.error('Usage: node update-cashier-permissions.js [cashier_id]');
      process.exit(1);
    }

    // First, login as the center user
    console.log('Logging in as center user...');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'heroHarith',
        password: 'harith123'
      }),
      redirect: 'manual'
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    // Parse the response
    const loginData = await loginResponse.json();
    console.log('Login successful:', loginData.data.username);

    // Get the session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    
    // Update cashier permissions
    console.log(`Updating permissions for cashier ID ${cashierId}...`);
    const updateResponse = await fetch(`http://localhost:5000/api/cashiers/${cashierId}/permissions`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        permissions: {
          manageBookings: true,
          viewReports: true,
          manageVenues: true,  // Giving all permissions
          processPayments: true
        }
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update permissions failed: ${updateResponse.status} ${errorText}`);
    }

    // Parse the response
    const updateData = await updateResponse.json();
    console.log('Permissions updated successfully:', updateData.data.permissions);
    
    // Now update venue assignments
    console.log(`Updating venue assignments for cashier ID ${cashierId}...`);
    const venueResponse = await fetch(`http://localhost:5000/api/cashiers/${cashierId}/venues`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        venueIds: [1, 2]  // Assign to both venues
      })
    });

    if (!venueResponse.ok) {
      const errorText = await venueResponse.text();
      throw new Error(`Update venues failed: ${venueResponse.status} ${errorText}`);
    }

    // Parse the response
    const venueData = await venueResponse.json();
    console.log('Venue assignments updated successfully:', venueData.data.venueIds);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
updateCashierPermissions();