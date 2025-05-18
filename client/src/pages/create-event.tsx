import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { createEventSchema, EVENT_CATEGORIES, EVENT_TYPES } from "@shared/schema";
import CreateEventForm from "@/components/ui/create-event-form";
import TabsComponent from "@/components/ui/tabs-component";
import { useAuth } from "@/hooks/use-auth";
import { SubscriptionStatus } from "@/components/subscription-status";

// Define the form input types
interface TicketTypeInput {
  name: string;
  description?: string | null;
  price: string; // String to match numeric in Postgres
  quantity: number;
  availableQuantity: number; // Required field
}

interface SpeakerInput {
  name: string;
  bio?: string;
  profileImage?: string;
  title?: string; // Job title or role
  company?: string;
  socialLinks?: Record<string, string>; // Social media links
  presentationTopic?: string;
  presentationDescription?: string;
  presentationTime: Date; // Making this required to match implementation
}

interface WorkshopInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string; // Room or specific location within the event venue
  capacity?: number;
  instructor?: string;
  prerequisites?: string;
  materials?: string[]; // Array of required materials
  registrationRequired?: boolean;
}

// Extended schema with form-specific validation
const eventFormSchema = createEventSchema.extend({
  imageUrl: z.string().optional(),
  // Convert string inputs to Date objects for proper validation
  startDate: z.coerce.date({
    required_error: "Start date is required",
    invalid_type_error: "Start date must be a valid date",
  }),
  endDate: z.coerce.date().optional(),
  // Override the ticketTypes to ensure availableQuantity is required
  ticketTypes: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    price: z.string(),
    quantity: z.number(),
    availableQuantity: z.number()
  })),
  // Add speakers and workshops
  speakers: z.array(z.object({
    name: z.string(),
    bio: z.string().optional(),
    profileImage: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    socialLinks: z.record(z.string()).optional(),
    presentationTopic: z.string().optional(),
    presentationDescription: z.string().optional(),
    presentationTime: z.date() // Required field
  })).optional().default([]),
  workshops: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    startTime: z.date(),
    endTime: z.date(),
    location: z.string().optional(),
    capacity: z.number().optional(),
    instructor: z.string().optional(),
    prerequisites: z.string().optional(),
    materials: z.array(z.string()).optional(),
    registrationRequired: z.boolean().default(false)
  })).optional().default([]),
  // Make sure featured is always required and a boolean
  featured: z.boolean().default(false)
});

// Define the EventFormValues interface to match the one in create-event-form.tsx
// Define a consistent event type to use throughout the form
type EventType = "general" | "conference" | "seated" | "private";

interface EventFormValues {
  title: string;
  description: string;
  location: string;
  category: string;
  startDate: Date;
  endDate?: Date;
  imageUrl?: string;
  featured: boolean;
  organizer: number;
  eventType?: EventType; // Typed to match EVENT_TYPES
  seatingMap?: Record<string, any> | null; // For seated events
  ticketTypes: TicketTypeInput[];
  speakers: SpeakerInput[];
  workshops: WorkshopInput[];
  addOns: { addOnId: number; isRequired: boolean; maximumQuantity: number }[]; // Add-ons for the event
};

const CreateEvent = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Get navigation tabs based on user role
  const getNavTabs = () => {
    const tabs = [
      { id: "browse", label: "Browse Events", href: "/" },
      { id: "tickets", label: "My Tickets", href: "/my-tickets" }
    ];
    
    // Add manager-specific tabs if user has appropriate role
    if (user && ['eventManager', 'admin'].includes(user.role)) {
      tabs.push(
        { id: "managed", label: "Managed Events", href: "/managed-events" },
        { id: "sales", label: "Sales Reports", href: "/sales-reports" }
      );
    }
    
    return tabs;
  };
  
  const form = useForm<EventFormValues>({
    defaultValues: {
      title: "",
      description: "",
      location: "",
      category: "Music",
      startDate: new Date(),
      endDate: undefined,
      imageUrl: "",
      organizer: user?.id || 0, // Use current user's ID
      featured: false,
      eventType: "general", // Default to general event type
      seatingMap: null, // No seating map by default
      ticketTypes: [
        {
          name: "General Admission",
          description: "Standard entry ticket",
          price: "0", // Changed to string to match Postgres numeric type
          quantity: 100,
          availableQuantity: 100
        }
      ],
      speakers: [], // Empty array for speakers - we'll instantiate fully in the addSpeaker function
      workshops: [], // Empty array for workshops
      addOns: [] // Empty array for add-ons
    }
  });
  
  const createEventMutation = useMutation({
    mutationFn: (data: EventFormValues) => 
      apiRequest("POST", "/api/events", {
        ...data,
        // The startDate and endDate are now already Date objects thanks to zod transform
      }),
    onSuccess: () => {
      toast({
        title: "Event Created!",
        description: "Your event has been successfully created.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setLocation("/managed-events");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create event",
        description: error.message || "There was a problem creating your event. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const onSubmit = (data: EventFormValues) => {
    createEventMutation.mutate(data);
  };
  
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="managed"
      />
    
      {/* Add subscription status component at the top */}
      <SubscriptionStatus />
      
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Event</h1>
        
        <CreateEventForm 
          form={form} 
          onSubmit={onSubmit} 
          isPending={createEventMutation.isPending}
          categories={EVENT_CATEGORIES}
        />
      </div>
    </div>
  );
};

export default CreateEvent;
