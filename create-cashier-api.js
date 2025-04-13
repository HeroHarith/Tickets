/**
 * This script demonstrates how to create a cashier through the API
 * Run this with: node create-cashier-api.js
 */

import fetch from 'node-fetch';

async function createCashierViaAPI() {
  try {
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
    
    // Now create a cashier
    console.log('Creating cashier...');
    const createResponse = await fetch('http://localhost:5000/api/cashiers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        email: 'api-cashier@example.com',
        name: 'API Created Cashier',
        permissions: {
          manageBookings: true,
          viewReports: true,
          manageVenues: false,
          processPayments: true
        },
        venueIds: [1] // Assign to venue with ID 1
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Create cashier failed: ${createResponse.status} ${errorText}`);
    }

    // Parse the response
    const createData = await createResponse.json();
    console.log('Cashier created successfully:', createData);
    console.log('Temporary password:', createData.data.tempPassword);
    
    // Now get all cashiers to verify
    console.log('\nRetrieving all cashiers...');
    const cashiersResponse = await fetch('http://localhost:5000/api/cashiers', {
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    });

    if (!cashiersResponse.ok) {
      throw new Error(`Get cashiers failed: ${cashiersResponse.status} ${cashiersResponse.statusText}`);
    }

    // Parse the response
    const cashiersData = await cashiersResponse.json();
    console.log('Total cashiers:', cashiersData.data.length);
    console.log('Cashiers:', cashiersData.data.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      venueIds: c.venueIds
    })));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
createCashierViaAPI();