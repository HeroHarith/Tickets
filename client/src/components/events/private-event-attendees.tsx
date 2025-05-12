import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { eventAttendeeSchema } from '@shared/schema';
import { apiRequest } from "@/lib/queryClient";
import { z } from 'zod';
import { CheckCircle2, UserPlus, Loader2, Check, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface PrivateEventAttendeesProps {
  eventId: number;
}

// Attendee entry in the form
interface AttendeeEntry {
  fullName: string;
  email: string;
  phone?: string;
}

const parseCSV = (csv: string): AttendeeEntry[] => {
  const lines = csv.split('\n');
  const attendees: AttendeeEntry[] = [];

  // Remove empty lines
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);

  for (const line of nonEmptyLines) {
    const [fullName, email, phone] = line.split(',').map(field => field.trim());
    
    // Basic validation before adding to the list
    if (fullName && email) {
      attendees.push({ fullName, email, phone });
    }
  }

  return attendees;
};

export function PrivateEventAttendees({ eventId }: PrivateEventAttendeesProps) {
  const [manualEntry, setManualEntry] = useState<AttendeeEntry>({ fullName: '', email: '' });
  const [csvData, setCsvData] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTab, setSelectedTab] = useState<'manual' | 'csv'>('manual');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch attendees
  const { data: attendees, isLoading, isError, error } = useQuery({
    queryKey: ['/api/events', eventId, 'attendees'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/events/${eventId}/attendees`);
      return response.json();
    },
    enabled: !!eventId
  });

  // Add attendees mutation
  const addAttendeesMutation = useMutation({
    mutationFn: async (newAttendees: AttendeeEntry[]) => {
      const response = await apiRequest('POST', `/api/events/${eventId}/attendees`, newAttendees);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attendees added successfully",
        description: "Your attendees have been added to the event",
        variant: "default",
      });
      
      // Reset form
      setManualEntry({ fullName: '', email: '' });
      setCsvData('');
      
      // Refresh attendees list
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'attendees'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add attendees",
        description: error.message || "There was an error adding attendees",
        variant: "destructive",
      });
    }
  });

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async (attendeeId: number) => {
      const response = await apiRequest('POST', `/api/events/attendees/${attendeeId}/check-in`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attendee checked in",
        description: "Attendee has been marked as present",
        variant: "default",
      });
      
      // Refresh attendees list
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'attendees'] });
    },
    onError: (error: any) => {
      toast({
        title: "Check-in failed",
        description: error.message || "There was an error checking in the attendee",
        variant: "destructive",
      });
    }
  });

  const validateManualEntry = (): boolean => {
    try {
      eventAttendeeSchema.parse(manualEntry);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleAddManual = () => {
    if (validateManualEntry()) {
      addAttendeesMutation.mutate([manualEntry]);
    }
  };

  const handleAddCSV = () => {
    const parsedAttendees = parseCSV(csvData);
    
    if (parsedAttendees.length === 0) {
      toast({
        title: "No valid attendees found",
        description: "Please check your CSV format and try again",
        variant: "destructive",
      });
      return;
    }
    
    // Validate all entries before submitting
    const invalidEntries = parsedAttendees.filter(attendee => {
      try {
        eventAttendeeSchema.parse(attendee);
        return false;
      } catch {
        return true;
      }
    });
    
    if (invalidEntries.length > 0) {
      toast({
        title: "Invalid attendee data",
        description: `${invalidEntries.length} entries have invalid format`,
        variant: "destructive",
      });
      return;
    }
    
    addAttendeesMutation.mutate(parsedAttendees);
  };

  const handleCheckIn = (attendeeId: number) => {
    checkInMutation.mutate(attendeeId);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Attendees</CardTitle>
          <CardDescription>
            Add and manage attendees for your private event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <Button
              variant={selectedTab === 'manual' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('manual')}
            >
              Manual Entry
            </Button>
            <Button
              variant={selectedTab === 'csv' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('csv')}
            >
              CSV Upload
            </Button>
          </div>

          {selectedTab === 'manual' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={manualEntry.fullName}
                    onChange={(e) => setManualEntry({...manualEntry, fullName: e.target.value})}
                    placeholder="John Doe"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-red-500">{errors.fullName}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={manualEntry.email}
                    onChange={(e) => setManualEntry({...manualEntry, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  value={manualEntry.phone || ''}
                  onChange={(e) => setManualEntry({...manualEntry, phone: e.target.value})}
                  placeholder="+1234567890"
                />
              </div>
              
              <Button 
                onClick={handleAddManual}
                disabled={addAttendeesMutation.isPending}
                className="w-full"
              >
                {addAttendeesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Attendee
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv">
                  Paste CSV data (format: name, email, phone)
                </Label>
                <Textarea
                  id="csv"
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="John Doe, john@example.com, +1234567890
Jane Smith, jane@example.com, +9876543210"
                  rows={6}
                />
              </div>
              
              <Button 
                onClick={handleAddCSV}
                disabled={addAttendeesMutation.isPending || !csvData.trim()}
                className="w-full"
              >
                {addAttendeesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Attendees
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendee List</CardTitle>
          <CardDescription>
            {attendees?.data?.length > 0 
              ? `${attendees.data.length} attendees registered` 
              : "No attendees registered yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-red-500">
              Error loading attendees: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : attendees?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees.data.map((attendee: any) => (
                    <TableRow key={attendee.id}>
                      <TableCell>{attendee.fullName}</TableCell>
                      <TableCell>{attendee.email}</TableCell>
                      <TableCell>{attendee.phone || 'N/A'}</TableCell>
                      <TableCell>
                        {attendee.isCheckedIn ? (
                          <span className="flex items-center text-green-600">
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Checked In
                          </span>
                        ) : (
                          <span className="text-gray-500">Not Checked In</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {!attendee.isCheckedIn && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCheckIn(attendee.id)}
                              disabled={checkInMutation.isPending}
                            >
                              {checkInMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No attendees added yet. Add attendees using the form above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}