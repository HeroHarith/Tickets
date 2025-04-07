import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { createEventSchema, EVENT_CATEGORIES } from "@shared/schema";
import CreateEventForm from "@/components/ui/create-event-form";

// Define the form TicketTypeInput with the correct availableQuantity type
interface TicketTypeInput {
  name: string;
  description?: string | null;
  price: string; // String to match numeric in Postgres
  quantity: number;
  availableQuantity: number; // Required field
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
  // Make sure featured is always required and a boolean
  featured: z.boolean().default(false)
});

// Define the type for form values
type EventFormValues = z.infer<typeof eventFormSchema>;

const CreateEvent = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      category: "Music",
      startDate: new Date(),
      endDate: undefined,
      imageUrl: "",
      organizer: 1, // Default user
      featured: false,
      ticketTypes: [
        {
          name: "General Admission",
          description: "Standard entry ticket",
          price: "0", // Changed to string to match Postgres numeric type
          quantity: 100,
          availableQuantity: 100
        }
      ]
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
      <div className="bg-white rounded-lg shadow-md p-6">
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
