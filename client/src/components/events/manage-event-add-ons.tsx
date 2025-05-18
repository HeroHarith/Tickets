import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { EventAddOn } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, Edit, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types for add-on data used in the component
interface EventAddOnRelation {
  addOnId: number;
  isRequired: boolean;
  maximumQuantity: number;
}

interface EventAddOnWithRelation extends EventAddOn {
  relationId?: number;
  isRequired: boolean;
  maximumQuantity: number;
}

interface ManageEventAddOnsProps {
  eventId?: number; // Optional for new events
  onAddOnsChange: (addOns: EventAddOnRelation[]) => void;
  initialAddOns?: EventAddOnRelation[];
}

export function ManageEventAddOns({ 
  eventId, 
  onAddOnsChange,
  initialAddOns = []
}: ManageEventAddOnsProps) {
  const { toast } = useToast();
  const [selectedAddOns, setSelectedAddOns] = useState<EventAddOnRelation[]>(initialAddOns);
  const [newAddOn, setNewAddOn] = useState<string>('');
  
  // Fetch all available add-ons
  const { data: availableAddOns, isLoading: isLoadingAddOns } = useQuery({
    queryKey: ['/api/add-ons'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/add-ons?activeOnly=true');
      if (!res.ok) {
        throw new Error('Failed to fetch add-ons');
      }
      const data = await res.json();
      return data.data as EventAddOn[];
    }
  });
  
  // If editing an existing event, fetch its add-ons
  const { data: eventAddOns, isLoading: isLoadingEventAddOns } = useQuery({
    queryKey: [`/api/add-ons/event/${eventId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/add-ons/event/${eventId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch event add-ons');
      }
      const data = await res.json();
      return data.data as EventAddOnWithRelation[];
    },
    enabled: !!eventId
  });
  
  // Update selected add-ons when event add-ons data is loaded
  useEffect(() => {
    if (eventAddOns && eventId) {
      const addOnsData = eventAddOns.map(addOn => ({
        addOnId: addOn.id,
        isRequired: addOn.isRequired,
        maximumQuantity: addOn.maximumQuantity
      }));
      setSelectedAddOns(addOnsData);
    }
  }, [eventAddOns, eventId]);
  
  // Notify parent component when selected add-ons change
  useEffect(() => {
    onAddOnsChange(selectedAddOns);
  }, [selectedAddOns, onAddOnsChange]);
  
  const handleAddOnSelect = (addOnId: string) => {
    if (addOnId && !selectedAddOns.some(addOn => addOn.addOnId === parseInt(addOnId))) {
      const newAddOnRelation: EventAddOnRelation = {
        addOnId: parseInt(addOnId),
        isRequired: false,
        maximumQuantity: 5 // Default max quantity
      };
      
      setSelectedAddOns([...selectedAddOns, newAddOnRelation]);
      setNewAddOn('');
      
      toast({
        title: 'Add-on added',
        description: 'The add-on has been added to your event',
      });
    }
  };
  
  const handleRemoveAddOn = (addOnId: number) => {
    setSelectedAddOns(selectedAddOns.filter(addOn => addOn.addOnId !== addOnId));
    
    toast({
      title: 'Add-on removed',
      description: 'The add-on has been removed from your event',
    });
  };
  
  const handleRequiredChange = (addOnId: number, isRequired: boolean) => {
    setSelectedAddOns(selectedAddOns.map(addOn => 
      addOn.addOnId === addOnId ? { ...addOn, isRequired } : addOn
    ));
  };
  
  const handleMaxQuantityChange = (addOnId: number, maximumQuantity: number) => {
    if (maximumQuantity < 1) {
      toast({
        title: 'Invalid quantity',
        description: 'Maximum quantity must be at least 1',
        variant: 'destructive'
      });
      return;
    }
    
    setSelectedAddOns(selectedAddOns.map(addOn => 
      addOn.addOnId === addOnId ? { ...addOn, maximumQuantity } : addOn
    ));
  };
  
  // Find full add-on details by ID
  const getAddOnById = (addOnId: number): EventAddOn | undefined => {
    return availableAddOns?.find(addOn => addOn.id === addOnId);
  };
  
  const isLoading = isLoadingAddOns || (eventId && isLoadingEventAddOns);
  
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <Label htmlFor="add-on-select">Add an add-on to this event</Label>
        <div className="flex items-center space-x-2">
          <Select
            value={newAddOn}
            onValueChange={handleAddOnSelect}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an add-on" />
            </SelectTrigger>
            <SelectContent>
              {availableAddOns?.map(addOn => (
                <SelectItem 
                  key={addOn.id} 
                  value={addOn.id.toString()}
                  disabled={selectedAddOns.some(selected => selected.addOnId === addOn.id)}
                >
                  {addOn.name} - ${addOn.price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {selectedAddOns.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {selectedAddOns.map(addOnRelation => {
            const addOn = getAddOnById(addOnRelation.addOnId);
            if (!addOn) return null;
            
            return (
              <Card key={addOnRelation.addOnId}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center">
                      {addOn.name}
                      <Badge className="ml-2">${addOn.price}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{addOn.description}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleRemoveAddOn(addOnRelation.addOnId)}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Required</Label>
                        <p className="text-xs text-muted-foreground">
                          Attendees must purchase this add-on
                        </p>
                      </div>
                      <Switch 
                        checked={addOnRelation.isRequired}
                        onCheckedChange={(checked) => 
                          handleRequiredChange(addOnRelation.addOnId, checked)
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`max-quantity-${addOnRelation.addOnId}`}>
                        Maximum Quantity
                      </Label>
                      <Input
                        id={`max-quantity-${addOnRelation.addOnId}`}
                        type="number"
                        min="1"
                        value={addOnRelation.maximumQuantity}
                        onChange={(e) => 
                          handleMaxQuantityChange(
                            addOnRelation.addOnId, 
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum number an attendee can purchase
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <p className="text-muted-foreground">No add-ons selected for this event</p>
          <p className="text-sm text-muted-foreground mt-1">
            Select add-ons above to enhance your event experience
          </p>
        </div>
      )}
    </div>
  );
}