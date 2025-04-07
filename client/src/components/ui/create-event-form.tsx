import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, ChevronDown, ChevronUp, MapPin, Calendar, Tag, Users } from "lucide-react";
import { EVENT_TYPES } from "@shared/schema";

interface TicketTypeInput {
  name: string;
  description?: string | null;
  price: string; // String to match numeric in Postgres
  quantity: number;
  availableQuantity: number; // Required field
}

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
  eventType?: "general" | "conference" | "seated"; // Typed to match EVENT_TYPES
  seatingMap?: Record<string, any> | null; // For seated events
  ticketTypes: TicketTypeInput[];
}

interface CreateEventFormProps {
  form: UseFormReturn<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  isPending: boolean;
  categories: readonly string[];
}

const CreateEventForm = ({ form, onSubmit, isPending, categories }: CreateEventFormProps) => {
  const [expandedTicketType, setExpandedTicketType] = useState<number | null>(null);
  
  const watchTicketTypes = form.watch("ticketTypes");
  const watchEventType = form.watch("eventType");
  
  const addTicketType = () => {
    const currentTicketTypes = form.getValues("ticketTypes");
    form.setValue("ticketTypes", [
      ...currentTicketTypes,
      {
        name: `Ticket Type ${currentTicketTypes.length + 1}`,
        description: "",
        price: "0", // Using string for price to match Postgres numeric type
        quantity: 100,
        availableQuantity: 100 // Set the available quantity to match the total quantity
      }
    ]);
    setExpandedTicketType(currentTicketTypes.length);
  };
  
  const removeTicketType = (index: number) => {
    const currentTicketTypes = form.getValues("ticketTypes");
    if (currentTicketTypes.length > 1) {
      form.setValue("ticketTypes", 
        currentTicketTypes.filter((_, i) => i !== index)
      );
    }
  };
  
  const toggleExpandTicketType = (index: number) => {
    setExpandedTicketType(expandedTicketType === index ? null : index);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Summer Music Festival" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-6">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your event..." 
                      className="h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-6">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Location</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Convention Center, New York" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-3">
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)} Event
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-3">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        field.onChange(date);
                      }}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-3">
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        field.onChange(date);
                      }}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-3">
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/image.jpg" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="sm:col-span-3">
            <FormField
              control={form.control}
              name="featured"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Featured Event</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Display this event in the featured section
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <Separator />
        
        {watchEventType === "seated" && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">Seating Configuration</h3>
                <p className="text-sm text-gray-500 mt-1">Configure seating layout for your venue</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg border">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h4 className="text-base font-medium mb-2 flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    Seating Map Configuration
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    For seated events, you can define rows, sections, and seat numbers.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rows</label>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="e.g. 10"
                        className="bg-white"
                        onChange={(e) => {
                          const rows = parseInt(e.target.value);
                          form.setValue("seatingMap", {
                            ...form.getValues("seatingMap"),
                            rows
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seats Per Row</label>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="e.g. 20"
                        className="bg-white"
                        onChange={(e) => {
                          const seatsPerRow = parseInt(e.target.value);
                          form.setValue("seatingMap", {
                            ...form.getValues("seatingMap"),
                            seatsPerRow
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-2 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-gray-500" />
                    Sections
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Define sections in your venue (e.g., Orchestra, Mezzanine, Balcony)
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="Section name" 
                        className="bg-white"
                        id="sectionNameInput"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const sectionName = (document.getElementById('sectionNameInput') as HTMLInputElement)?.value;
                          if (sectionName) {
                            const sections = form.getValues("seatingMap")?.sections || [];
                            form.setValue("seatingMap", {
                              ...form.getValues("seatingMap"),
                              sections: [...sections, sectionName]
                            });
                            // Clear the input field after adding
                            (document.getElementById('sectionNameInput') as HTMLInputElement).value = '';
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    
                    {/* Show added sections */}
                    {form.getValues("seatingMap")?.sections?.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium mb-2">Defined Sections:</h5>
                        <div className="flex flex-wrap gap-2">
                          {form.getValues("seatingMap")?.sections?.map((section: string, i: number) => (
                            <div 
                              key={i} 
                              className="px-2 py-1 bg-white rounded border flex items-center gap-1"
                            >
                              <span className="text-sm">{section}</span>
                              <button 
                                type="button"
                                className="text-gray-500 hover:text-red-500 transition-colors"
                                onClick={() => {
                                  const sections = form.getValues("seatingMap")?.sections || [];
                                  form.setValue("seatingMap", {
                                    ...form.getValues("seatingMap"),
                                    sections: sections.filter((_, index) => index !== i)
                                  });
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 italic mt-3">
                      Note: For complex seating arrangements, additional configuration will be available after event creation.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {watchEventType === "conference" && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">Conference Details</h3>
                <p className="text-sm text-gray-500 mt-1">Additional information for conference events</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg border">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h4 className="text-base font-medium mb-2 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    Session Information
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Define sessions, speakers, and schedules for your conference
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="Session name" 
                        className="bg-white"
                        id="sessionNameInput"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const sessionName = (document.getElementById('sessionNameInput') as HTMLInputElement)?.value;
                          if (sessionName) {
                            const currentMap = form.getValues("seatingMap") || {};
                            const sessions = currentMap.sessions || [];
                            form.setValue("seatingMap", {
                              ...currentMap,
                              sessions: [...sessions, sessionName]
                            });
                            // Clear the input field after adding
                            (document.getElementById('sessionNameInput') as HTMLInputElement).value = '';
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    
                    {/* Show added sessions */}
                    {form.getValues("seatingMap")?.sessions?.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium mb-2">Defined Sessions:</h5>
                        <div className="flex flex-wrap gap-2">
                          {form.getValues("seatingMap")?.sessions?.map((session: string, i: number) => (
                            <div 
                              key={i} 
                              className="px-2 py-1 bg-white rounded border flex items-center gap-1"
                            >
                              <span className="text-sm">{session}</span>
                              <button 
                                type="button"
                                className="text-gray-500 hover:text-red-500 transition-colors"
                                onClick={() => {
                                  const currentMap = form.getValues("seatingMap") || {};
                                  const sessions = currentMap.sessions || [];
                                  form.setValue("seatingMap", {
                                    ...currentMap,
                                    sessions: sessions.filter((_: string, index: number) => index !== i)
                                  });
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 italic mt-3">
                      Note: Detailed session scheduling will be available after event creation.
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-2 flex items-center">
                    <Tag className="h-4 w-4 mr-2 text-gray-500" />
                    Registration Options
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Set registration options for conference attendees
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="earlyBird" className="rounded text-primary" />
                      <label htmlFor="earlyBird" className="text-sm text-gray-700">Enable early bird pricing</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="groupDiscount" className="rounded text-primary" />
                      <label htmlFor="groupDiscount" className="text-sm text-gray-700">Enable group discounts</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="workshops" className="rounded text-primary" />
                      <label htmlFor="workshops" className="text-sm text-gray-700">Include workshops</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Ticket Types</h3>
              <p className="text-sm text-gray-500 mt-1">Create one or more ticket types for your event</p>
            </div>
            <div className="text-sm text-gray-500">
              {watchTicketTypes.length} {watchTicketTypes.length === 1 ? 'type' : 'types'} defined
            </div>
          </div>
          
          <div className="space-y-4">
            {watchTicketTypes.map((_: any, index: number) => (
              <div key={index} className="border rounded-md shadow-sm hover:shadow-md transition-shadow duration-200">
                <div 
                  className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                  onClick={() => toggleExpandTicketType(index)}
                >
                  <div className="flex flex-col">
                    <FormField
                      control={form.control}
                      name={`ticketTypes.${index}.name`}
                      render={({ field }) => (
                        <span className="font-medium text-base">{field.value || `Ticket Type ${index + 1}`}</span>
                      )}
                    />
                    <div className="flex gap-3 mt-1">
                      <FormField
                        control={form.control}
                        name={`ticketTypes.${index}.price`}
                        render={({ field }) => (
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold">Price:</span> ${Number(field.value).toFixed(2)}
                          </span>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ticketTypes.${index}.quantity`}
                        render={({ field }) => (
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold">Quantity:</span> {field.value}
                          </span>
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTicketType(index);
                      }}
                      disabled={watchTicketTypes.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-gray-500" />
                    </Button>
                    {expandedTicketType === index ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                </div>
                
                {expandedTicketType === index && (
                  <div className="p-4 border-t bg-gray-50">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Edit Ticket Details</h4>
                      <p className="text-xs text-gray-500">Customize this ticket type's information</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`ticketTypes.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ticket Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g. General Admission" 
                                {...field} 
                                className="bg-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`ticketTypes.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g. Standard entry ticket" 
                                {...field}
                                value={field.value || ""}
                                className="bg-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`ticketTypes.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="0.01"
                                {...field}
                                className="bg-white"
                                // Convert to string to match Postgres numeric type
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`ticketTypes.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity Available</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1"
                                {...field}
                                className="bg-white"
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  field.onChange(value);
                                  // Update availableQuantity to match quantity
                                  form.setValue(`ticketTypes.${index}.availableQuantity`, value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={addTicketType}
            className="mt-4 border-dashed border-2 w-full py-6 flex justify-center items-center hover:bg-gray-50"
          >
            <Plus className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Add Ticket Type</span>
          </Button>
        </div>
        
        <div className="flex justify-end">
          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/90"
            disabled={isPending}
          >
            {isPending ? "Creating Event..." : "Create Event"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreateEventForm;
