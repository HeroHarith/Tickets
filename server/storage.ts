import { 
  User, InsertUser, 
  Event, InsertEvent, 
  TicketType, InsertTicketType,
  Ticket, InsertTicket,
  CreateEventInput,
  PurchaseTicketInput
} from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Event operations
  getEvent(id: number): Promise<Event | undefined>;
  getEvents(options?: { 
    category?: string; 
    featured?: boolean; 
    search?: string;
    organizer?: number;
  }): Promise<Event[]>;
  createEvent(event: CreateEventInput): Promise<Event>;
  
  // TicketType operations
  getTicketTypes(eventId: number): Promise<TicketType[]>;
  getTicketType(id: number): Promise<TicketType | undefined>;
  
  // Ticket operations
  purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]>;
  getUserTickets(userId: number): Promise<Ticket[]>;
  getEventSales(eventId: number): Promise<{ 
    totalSales: number; 
    ticketsSold: number;
    salesByTicketType: {
      name: string;
      sold: number;
      revenue: number;
    }[]
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private ticketTypes: Map<number, TicketType>;
  private tickets: Map<number, Ticket>;
  
  private userId: number;
  private eventId: number;
  private ticketTypeId: number;
  private ticketId: number;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.ticketTypes = new Map();
    this.tickets = new Map();
    
    this.userId = 1;
    this.eventId = 1;
    this.ticketTypeId = 1;
    this.ticketId = 1;
    
    // Add a default user
    this.createUser({
      username: "demo",
      password: "password",
      name: "Demo User",
      email: "demo@example.com"
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userId++;
    const newUser: User = { 
      ...user, 
      id, 
      createdAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }

  // Event operations
  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEvents(options?: { 
    category?: string; 
    featured?: boolean; 
    search?: string;
    organizer?: number;
  }): Promise<Event[]> {
    let events = Array.from(this.events.values());
    
    if (options) {
      if (options.category) {
        events = events.filter(e => e.category.toLowerCase() === options.category.toLowerCase());
      }
      
      if (options.featured !== undefined) {
        events = events.filter(e => e.featured === options.featured);
      }
      
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        events = events.filter(
          e => e.title.toLowerCase().includes(searchLower) ||
               e.description.toLowerCase().includes(searchLower) ||
               e.location.toLowerCase().includes(searchLower)
        );
      }
      
      if (options.organizer) {
        events = events.filter(e => e.organizer === options.organizer);
      }
    }
    
    // Sort by start date (newest first)
    return events.sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  async createEvent(eventData: CreateEventInput): Promise<Event> {
    const id = this.eventId++;
    const { ticketTypes: ticketTypesData, ...eventDetails } = eventData;
    
    const event: Event = {
      ...eventDetails,
      id,
      createdAt: new Date()
    };
    
    this.events.set(id, event);
    
    // Create ticket types for the event
    ticketTypesData.forEach(ticketType => {
      const ticketTypeId = this.ticketTypeId++;
      const newTicketType: TicketType = {
        ...ticketType,
        id: ticketTypeId,
        eventId: id,
        availableQuantity: ticketType.quantity,
        createdAt: new Date()
      };
      this.ticketTypes.set(ticketTypeId, newTicketType);
    });
    
    return event;
  }

  // TicketType operations
  async getTicketTypes(eventId: number): Promise<TicketType[]> {
    return Array.from(this.ticketTypes.values())
      .filter(tt => tt.eventId === eventId);
  }

  async getTicketType(id: number): Promise<TicketType | undefined> {
    return this.ticketTypes.get(id);
  }

  // Ticket operations
  async purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]> {
    const { eventId, ticketSelections } = purchase;
    const orderId = nanoid(10);
    const tickets: Ticket[] = [];
    
    for (const selection of ticketSelections) {
      const { ticketTypeId, quantity } = selection;
      const ticketType = await this.getTicketType(ticketTypeId);
      
      if (!ticketType) {
        throw new Error(`Ticket type ${ticketTypeId} not found`);
      }
      
      if (ticketType.availableQuantity < quantity) {
        throw new Error(`Not enough tickets available for ${ticketType.name}`);
      }
      
      // Update available quantity
      const updatedTicketType = {
        ...ticketType,
        availableQuantity: ticketType.availableQuantity - quantity
      };
      this.ticketTypes.set(ticketTypeId, updatedTicketType);
      
      // Create ticket purchase record
      const ticket: Ticket = {
        id: this.ticketId++,
        ticketTypeId,
        eventId,
        userId,
        purchaseDate: new Date(),
        quantity,
        totalPrice: Number(ticketType.price) * quantity,
        orderId
      };
      
      this.tickets.set(ticket.id, ticket);
      tickets.push(ticket);
    }
    
    return tickets;
  }

  async getUserTickets(userId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.userId === userId)
      .sort((a, b) => 
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      );
  }

  async getEventSales(eventId: number): Promise<{ 
    totalSales: number; 
    ticketsSold: number;
    salesByTicketType: {
      name: string;
      sold: number;
      revenue: number;
    }[]
  }> {
    const eventTickets = Array.from(this.tickets.values())
      .filter(ticket => ticket.eventId === eventId);
    
    const eventTicketTypes = await this.getTicketTypes(eventId);
    const ticketTypeMap = new Map(
      eventTicketTypes.map(tt => [tt.id, tt])
    );
    
    let totalSales = 0;
    let ticketsSold = 0;
    const salesByTicketType = new Map<number, { name: string; sold: number; revenue: number }>();
    
    // Initialize sales by ticket type
    for (const tt of eventTicketTypes) {
      salesByTicketType.set(tt.id, { 
        name: tt.name, 
        sold: 0, 
        revenue: 0 
      });
    }
    
    // Aggregate sales data
    for (const ticket of eventTickets) {
      totalSales += Number(ticket.totalPrice);
      ticketsSold += ticket.quantity;
      
      const ticketTypeSales = salesByTicketType.get(ticket.ticketTypeId);
      if (ticketTypeSales) {
        ticketTypeSales.sold += ticket.quantity;
        ticketTypeSales.revenue += Number(ticket.totalPrice);
        salesByTicketType.set(ticket.ticketTypeId, ticketTypeSales);
      }
    }
    
    return {
      totalSales,
      ticketsSold,
      salesByTicketType: Array.from(salesByTicketType.values())
    };
  }
}

export const storage = new MemStorage();
