/**
 * TicketHub API Test Script
 * 
 * This script tests various API endpoints in the TicketHub application
 * using different user roles to ensure that everything works correctly.
 * 
 * To run this test, you need to have Node.js installed.
 * Execute this script using: node test-endpoints.js
 */

const fetch = require('node-fetch');

// Base URL of the API
const BASE_URL = 'http://localhost:5000';

// User credentials for different roles
const TEST_USERS = {
  customer: { username: 'customer', password: 'customer123' },
  eventManager: { username: 'manager', password: 'manager123' },
  center: { username: 'center', password: 'center123' },
  admin: { username: 'alharith', password: 'Hero123' }
};

// Store tokens and IDs for use across tests
const context = {
  tokens: {},
  createdEventId: null,
  createdTicketTypeId: null,
  createdTicketId: null,
  createdVenueId: null,
  apiKey: null
};

// Helper function to make API calls
async function callApi(endpoint, method = 'GET', body = null, token = null, apiKey = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (apiKey) {
    headers['X-API-KEY'] = apiKey;
  }
  
  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  };
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error);
    return { status: 500, data: { error: error.message } };
  }
}

// Test login for all user roles
async function testUserLogins() {
  console.log('\n--- Testing User Authentication ---');
  
  for (const [role, credentials] of Object.entries(TEST_USERS)) {
    try {
      const { status, data } = await callApi('/api/login', 'POST', credentials);
      if (status === 200 && data.success) {
        context.tokens[role] = data.data.token || 'session-auth';
        console.log(`✅ ${role} login successful`);
      } else {
        console.log(`❌ ${role} login failed: ${data.description || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${role} login error:`, error);
    }
  }
}

// Test public event endpoints
async function testPublicEventEndpoints() {
  console.log('\n--- Testing Public Event Endpoints ---');
  
  // List all events
  try {
    const { status, data } = await callApi('/api/events');
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/events: ${data.data.length} events returned`);
  } catch (error) {
    console.log('❌ Error getting events:', error);
  }
  
  // Search events
  try {
    const { status, data } = await callApi('/api/events?category=Conference');
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/events?category=Conference: ${data.data.length} events returned`);
  } catch (error) {
    console.log('❌ Error searching events:', error);
  }
}

// Test event manager endpoints
async function testEventManagerEndpoints() {
  console.log('\n--- Testing Event Manager Endpoints ---');
  
  const token = context.tokens.eventManager;
  if (!token) {
    console.log('❌ Event manager token not available. Skipping tests.');
    return;
  }
  
  // Create an event
  try {
    const eventData = {
      title: "API Test Event",
      description: "This is a test event created via API",
      location: "Test Venue",
      category: "Other",
      startDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
      endDate: new Date(Date.now() + 86400000 * 7 + 3600000 * 3).toISOString(), // + 3 hours
      imageUrl: "https://example.com/image.jpg",
      isMultiDay: false,
      isPrivate: false
    };
    
    const { status, data } = await callApi('/api/events', 'POST', eventData, token);
    if (status === 201 && data.success) {
      context.createdEventId = data.data.id;
      console.log(`✅ POST /api/events: Created event ID ${context.createdEventId}`);
    } else {
      console.log(`❌ POST /api/events failed: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.log('❌ Error creating event:', error);
  }
  
  // Skip if event creation failed
  if (!context.createdEventId) {
    console.log('❌ Event creation failed. Skipping related tests.');
    return;
  }
  
  // Add ticket type
  try {
    const ticketTypeData = {
      name: "General Admission",
      description: "Standard entry ticket",
      price: "25.00",
      quantity: 100
    };
    
    const { status, data } = await callApi(
      `/api/events/${context.createdEventId}/ticket-types`, 
      'POST', 
      ticketTypeData, 
      token
    );
    
    if (status === 201 && data.success) {
      context.createdTicketTypeId = data.data.id;
      console.log(`✅ POST /api/events/${context.createdEventId}/ticket-types: Created ticket type ID ${context.createdTicketTypeId}`);
    } else {
      console.log(`❌ POST /api/events/${context.createdEventId}/ticket-types failed: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.log('❌ Error creating ticket type:', error);
  }
  
  // Get sales data
  try {
    const { status, data } = await callApi(`/api/events/${context.createdEventId}/sales`, 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/events/${context.createdEventId}/sales: Retrieved sales data`);
  } catch (error) {
    console.log('❌ Error getting sales data:', error);
  }
  
  // Get API key for external API tests
  try {
    const { status, data } = await callApi('/api/user/api-key', 'GET', null, token);
    if (status === 200 && data.success) {
      context.apiKey = data.data.apiKey;
      console.log(`✅ GET /api/user/api-key: Retrieved API key`);
    } else {
      console.log(`❌ GET /api/user/api-key failed: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.log('❌ Error getting API key:', error);
  }
}

// Test customer endpoints
async function testCustomerEndpoints() {
  console.log('\n--- Testing Customer Endpoints ---');
  
  const token = context.tokens.customer;
  if (!token) {
    console.log('❌ Customer token not available. Skipping tests.');
    return;
  }
  
  // Skip if ticket type creation failed
  if (!context.createdEventId || !context.createdTicketTypeId) {
    console.log('❌ Event or ticket type not available. Skipping ticket purchase test.');
    return;
  }
  
  // Purchase tickets
  try {
    const purchaseData = {
      eventId: context.createdEventId,
      isMultiDay: false,
      ticketSelections: [
        {
          ticketTypeId: context.createdTicketTypeId,
          quantity: 1,
          attendeeDetails: [
            {
              email: "test@example.com",
              fullName: "Test User"
            }
          ]
        }
      ]
    };
    
    const { status, data } = await callApi('/api/tickets/purchase', 'POST', purchaseData, token);
    if (status === 201 && data.success) {
      context.createdTicketId = data.data[0].id;
      console.log(`✅ POST /api/tickets/purchase: Purchased ticket ID ${context.createdTicketId}`);
    } else {
      console.log(`❌ POST /api/tickets/purchase failed: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.log('❌ Error purchasing ticket:', error);
  }
  
  // Get user tickets
  try {
    const { status, data } = await callApi('/api/tickets', 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/tickets: Retrieved ${data.data?.length || 0} user tickets`);
  } catch (error) {
    console.log('❌ Error getting user tickets:', error);
  }
  
  // Get specific ticket details
  if (context.createdTicketId) {
    try {
      const { status, data } = await callApi(`/api/tickets/${context.createdTicketId}`, 'GET', null, token);
      console.log(`${status === 200 ? '✅' : '❌'} GET /api/tickets/${context.createdTicketId}: Retrieved ticket details`);
    } catch (error) {
      console.log(`❌ Error getting ticket details:`, error);
    }
  }
}

// Test center endpoints
async function testCenterEndpoints() {
  console.log('\n--- Testing Center Endpoints ---');
  
  const token = context.tokens.center;
  if (!token) {
    console.log('❌ Center token not available. Skipping tests.');
    return;
  }
  
  // Create venue
  try {
    const venueData = {
      name: "Test Venue",
      location: "Test Location",
      capacity: 100,
      description: "A test venue",
      amenities: ["Wi-Fi", "Projector"],
      dailyRate: "500.00",
      hourlyRate: "50.00"
    };
    
    const { status, data } = await callApi('/api/venues', 'POST', venueData, token);
    if (status === 201 && data.success) {
      context.createdVenueId = data.data.id;
      console.log(`✅ POST /api/venues: Created venue ID ${context.createdVenueId}`);
    } else {
      console.log(`❌ POST /api/venues failed: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.log('❌ Error creating venue:', error);
  }
  
  // Get venues
  try {
    const { status, data } = await callApi('/api/venues', 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/venues: Retrieved ${data.data?.length || 0} venues`);
  } catch (error) {
    console.log('❌ Error getting venues:', error);
  }
  
  // Get cashiers
  try {
    const { status, data } = await callApi('/api/cashiers', 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/cashiers: Retrieved ${data.data?.length || 0} cashiers`);
  } catch (error) {
    console.log('❌ Error getting cashiers:', error);
  }
}

// Test admin endpoints
async function testAdminEndpoints() {
  console.log('\n--- Testing Admin Endpoints ---');
  
  const token = context.tokens.admin;
  if (!token) {
    console.log('❌ Admin token not available. Skipping tests.');
    return;
  }
  
  // Get all users
  try {
    const { status, data } = await callApi('/api/admin/users', 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/admin/users: Retrieved ${data.data?.length || 0} users`);
  } catch (error) {
    console.log('❌ Error getting users:', error);
  }
  
  // Get all events
  try {
    const { status, data } = await callApi('/api/admin/events', 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/admin/events: Retrieved ${data.data?.length || 0} events`);
  } catch (error) {
    console.log('❌ Error getting all events:', error);
  }
  
  // Get all venues
  try {
    const { status, data } = await callApi('/api/admin/venues', 'GET', null, token);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/admin/venues: Retrieved ${data.data?.length || 0} venues`);
  } catch (error) {
    console.log('❌ Error getting all venues:', error);
  }
}

// Test external API endpoints
async function testExternalApiEndpoints() {
  console.log('\n--- Testing External API Endpoints ---');
  
  if (!context.apiKey) {
    console.log('❌ API key not available. Skipping external API tests.');
    return;
  }
  
  // Get all events via external API
  try {
    const { status, data } = await callApi('/api/external/events', 'GET', null, null, context.apiKey);
    console.log(`${status === 200 ? '✅' : '❌'} GET /api/external/events: Retrieved ${data.data?.length || 0} events`);
  } catch (error) {
    console.log('❌ Error getting events via external API:', error);
  }
  
  // Get specific event via external API
  if (context.createdEventId) {
    try {
      const { status, data } = await callApi(`/api/external/events/${context.createdEventId}`, 'GET', null, null, context.apiKey);
      console.log(`${status === 200 ? '✅' : '❌'} GET /api/external/events/${context.createdEventId}: Retrieved event details`);
    } catch (error) {
      console.log(`❌ Error getting event details via external API:`, error);
    }
  }
  
  // Get event tickets via external API
  if (context.createdEventId) {
    try {
      const { status, data } = await callApi(`/api/external/events/${context.createdEventId}/tickets`, 'GET', null, null, context.apiKey);
      console.log(`${status === 200 ? '✅' : '❌'} GET /api/external/events/${context.createdEventId}/tickets: Retrieved ${data.data?.length || 0} tickets`);
    } catch (error) {
      console.log(`❌ Error getting event tickets via external API:`, error);
    }
  }
  
  // Test ticket purchase via external API
  if (context.createdEventId && context.createdTicketTypeId) {
    try {
      const purchaseData = {
        eventId: context.createdEventId,
        isMultiDay: false,
        ticketSelections: [
          {
            ticketTypeId: context.createdTicketTypeId,
            quantity: 1,
            attendeeDetails: [
              {
                email: "external-api-test@example.com",
                fullName: "API Test User"
              }
            ]
          }
        ]
      };
      
      const { status, data } = await callApi('/api/external/tickets/purchase', 'POST', purchaseData, null, context.apiKey);
      if (status === 201 && data.success) {
        const externalTicketId = data.data[0].id;
        console.log(`✅ POST /api/external/tickets/purchase: Purchased ticket ID ${externalTicketId}`);
        
        // Test ticket validation
        try {
          const { status, data } = await callApi(`/api/external/tickets/${externalTicketId}/validate`, 'POST', {}, null, context.apiKey);
          console.log(`${status === 200 ? '✅' : '❌'} POST /api/external/tickets/${externalTicketId}/validate: ${data.success ? 'Validated ticket' : 'Failed to validate'}`);
        } catch (error) {
          console.log(`❌ Error validating ticket via external API:`, error);
        }
      } else {
        console.log(`❌ POST /api/external/tickets/purchase failed: ${data.description || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Error purchasing ticket via external API:', error);
    }
  }
}

// Clean up created resources
async function cleanUp() {
  console.log('\n--- Cleaning Up Test Resources ---');
  
  const managerToken = context.tokens.eventManager;
  const centerToken = context.tokens.center;
  const adminToken = context.tokens.admin;
  
  // Delete created event
  if (context.createdEventId && managerToken) {
    try {
      const { status, data } = await callApi(`/api/events/${context.createdEventId}`, 'DELETE', null, managerToken);
      console.log(`${status === 200 ? '✅' : '❌'} DELETE /api/events/${context.createdEventId}: ${data.success ? 'Deleted event' : 'Failed to delete'}`);
    } catch (error) {
      console.log(`❌ Error deleting event:`, error);
    }
  }
  
  // Delete created venue
  if (context.createdVenueId && centerToken) {
    try {
      const { status, data } = await callApi(`/api/venues/${context.createdVenueId}`, 'DELETE', null, centerToken);
      console.log(`${status === 200 ? '✅' : '❌'} DELETE /api/venues/${context.createdVenueId}: ${data.success ? 'Deleted venue' : 'Failed to delete'}`);
    } catch (error) {
      console.log(`❌ Error deleting venue:`, error);
    }
  }
  
  console.log('\n--- Test Completed ---');
}

// Main function to run tests
async function runTests() {
  console.log('=== TicketHub API Test Started ===');
  
  try {
    // Test authentication
    await testUserLogins();
    
    // Test different endpoints by user role
    await testPublicEventEndpoints();
    await testEventManagerEndpoints();
    await testCustomerEndpoints();
    await testCenterEndpoints();
    await testAdminEndpoints();
    await testExternalApiEndpoints();
    
    // Clean up any created resources
    await cleanUp();
    
    console.log('=== TicketHub API Test Completed ===');
  } catch (error) {
    console.error('Test Failed:', error);
  }
}

// Run the tests
runTests();