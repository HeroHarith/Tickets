import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Venue } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

// Validation schema for venue form
const venueFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  description: z.string().optional(),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  capacity: z.string().optional(),
  isActive: z.boolean().default(true),
  facilities: z.string().optional(),
});

type VenueFormValues = z.infer<typeof venueFormSchema>;

interface VenueEditDialogProps {
  venue?: Venue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VenueEditDialog({ venue, open, onOpenChange }: VenueEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNewVenue = !venue;

  // Setup form with default values
  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: {
      name: venue?.name || "",
      location: venue?.location || "",
      description: venue?.description || "",
      hourlyRate: venue?.hourlyRate?.toString() || "",
      capacity: venue?.capacity?.toString() || "",
      isActive: venue?.isActive ?? true,
      facilities: venue?.facilities?.join(", ") || "",
    },
  });

  // Update venue mutation
  const updateVenueMutation = useMutation({
    mutationFn: async (values: VenueFormValues) => {
      const facilitiesArray = values.facilities
        ? values.facilities.split(",").map((f) => f.trim()).filter(Boolean)
        : [];

      const formattedValues = {
        ...values,
        facilities: facilitiesArray,
        capacity: values.capacity ? parseInt(values.capacity) : undefined,
      };

      if (isNewVenue) {
        const res = await apiRequest("POST", "/api/venues", formattedValues);
        return await res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/venues/${venue.id}`, formattedValues);
        return await res.json();
      }
    },
    onSuccess: () => {
      // Invalidate venues query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      onOpenChange(false);
      toast({
        title: isNewVenue ? "Venue created" : "Venue updated",
        description: isNewVenue
          ? "Your new venue has been created successfully."
          : "Venue details have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: isNewVenue ? "Failed to create venue" : "Failed to update venue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submit handler
  const onSubmit = (values: VenueFormValues) => {
    updateVenueMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNewVenue ? "Create New Venue" : "Edit Venue"}</DialogTitle>
          <DialogDescription>
            {isNewVenue
              ? "Add a new venue to your center."
              : "Make changes to your venue here."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter venue name" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is the name that will be displayed to customers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Venue location or address" {...field} />
                  </FormControl>
                  <FormDescription>
                    Specific location details like floor, building, etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hourlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hourly Rate ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Hourly rate"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    How much will you charge per hour for this venue?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Maximum people"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of people the venue can accommodate.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Venue will be available for bookings if active.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="facilities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facilities</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Wi-Fi, Projector, Sound System, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    List venue facilities separated by commas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide details about this venue..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the venue, its features, and unique selling points.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateVenueMutation.isPending}
              >
                {updateVenueMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isNewVenue ? "Create Venue" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}