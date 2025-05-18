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
import { Plus, Trash, Edit, Check, DollarSign, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Interface representing a custom add-on created directly during event creation
interface CustomAddOn {
  id: string; // Temporary ID for new add-ons in the format "temp_id_123"
  name: string;
  description: string;
  price: string;
  isRequired: boolean;
  maximumQuantity: number;
  isCustom: true; // Flag to identify custom add-ons
}

// Types for add-on data used in the component
interface EventAddOnRelation {
  addOnId: number | string; // Can be a DB ID or a temporary ID for custom add-ons
  isRequired: boolean;
  maximumQuantity: number;
  isCustom?: boolean;
  name?: string;
  description?: string;
  price?: string;
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
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  
  // Form state for creating a new custom add-on
  const [customAddOn, setCustomAddOn] = useState<{
    name: string;
    description: string;
    price: string;
    isRequired: boolean;
    maximumQuantity: number;
  }>({
    name: '',
    description: '',
    price: '0.00',
    isRequired: false,
    maximumQuantity: 5
  });
  
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
  
  // Add an existing add-on from the dropdown
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
  
  // Add a custom add-on created during event creation
  const handleAddCustomAddOn = () => {
    // Validate form
    if (!customAddOn.name) {
      toast({
        title: 'Missing name',
        description: 'Please provide a name for the add-on',
        variant: 'destructive'
      });
      return;
    }
    
    if (!customAddOn.description) {
      toast({
        title: 'Missing description',
        description: 'Please provide a description for the add-on',
        variant: 'destructive'
      });
      return;
    }
    
    const price = parseFloat(customAddOn.price);
    if (isNaN(price) || price < 0) {
      toast({
        title: 'Invalid price',
        description: 'Please provide a valid price for the add-on',
        variant: 'destructive'
      });
      return;
    }
    
    // Create a new custom add-on with a temporary ID
    const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const newAddOnRelation: EventAddOnRelation = {
      addOnId: tempId,
      isRequired: customAddOn.isRequired,
      maximumQuantity: customAddOn.maximumQuantity,
      isCustom: true,
      name: customAddOn.name,
      description: customAddOn.description,
      price: customAddOn.price
    };
    
    setSelectedAddOns([...selectedAddOns, newAddOnRelation]);
    
    // Reset the form
    setCustomAddOn({
      name: '',
      description: '',
      price: '0.00',
      isRequired: false,
      maximumQuantity: 5
    });
    
    setIsAddingCustom(false);
    
    toast({
      title: 'Add-on created',
      description: 'Your custom add-on has been created and added to the event',
    });
  };
  
  const handleRemoveAddOn = (addOnId: number | string) => {
    setSelectedAddOns(selectedAddOns.filter(addOn => addOn.addOnId !== addOnId));
    
    toast({
      title: 'Add-on removed',
      description: 'The add-on has been removed from your event',
    });
  };
  
  const handleRequiredChange = (addOnId: number | string, isRequired: boolean) => {
    setSelectedAddOns(selectedAddOns.map(addOn => 
      addOn.addOnId === addOnId ? { ...addOn, isRequired } : addOn
    ));
  };
  
  const handleMaxQuantityChange = (addOnId: number | string, maximumQuantity: number) => {
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
  
  // Find full add-on details by ID, either from the DB or from custom add-ons
  const getAddOnDetails = (addOn: EventAddOnRelation) => {
    if (addOn.isCustom) {
      return {
        id: addOn.addOnId,
        name: addOn.name || '',
        description: addOn.description || '',
        price: addOn.price || '0.00',
        isCustom: true
      };
    } else {
      return availableAddOns?.find(a => a.id === addOn.addOnId);
    }
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
      {!isAddingCustom ? (
        <div className="flex flex-col space-y-4">
          {/* Options to add existing add-ons or create new ones */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Label htmlFor="add-on-select">Add an existing add-on</Label>
              <Select
                value={newAddOn}
                onValueChange={handleAddOnSelect}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select an add-on" />
                </SelectTrigger>
                <SelectContent>
                  {availableAddOns?.map(addOn => (
                    <SelectItem 
                      key={addOn.id} 
                      value={addOn.id.toString()}
                      disabled={selectedAddOns.some(selected => 
                        selected.addOnId === addOn.id && !selected.isCustom
                      )}
                    >
                      {addOn.name} - {addOn.price} OMR
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          
            <div className="flex-none mt-6">
              <div className="text-center">
                <span className="text-sm text-muted-foreground">or</span>
              </div>
            </div>
            
            <div className="flex-1 mt-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAddingCustom(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Add-on
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 p-6 rounded-lg border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Create Custom Add-on</h3>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsAddingCustom(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-on-name">Name</Label>
              <Input
                id="add-on-name"
                placeholder="VIP Meet & Greet"
                value={customAddOn.name}
                onChange={(e) => setCustomAddOn({...customAddOn, name: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="add-on-description">Description</Label>
              <Textarea
                id="add-on-description"
                placeholder="Get exclusive access to meet the performers after the show"
                value={customAddOn.description}
                onChange={(e) => setCustomAddOn({...customAddOn, description: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="add-on-price">Price (OMR)</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="add-on-price"
                  className="pl-8"
                  placeholder="29.99"
                  value={customAddOn.price}
                  onChange={(e) => {
                    // Allow only valid price input
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                      setCustomAddOn({...customAddOn, price: value});
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max-quantity">Maximum Quantity</Label>
                <Input
                  id="max-quantity"
                  type="number"
                  min="1"
                  value={customAddOn.maximumQuantity}
                  onChange={(e) => setCustomAddOn({
                    ...customAddOn, 
                    maximumQuantity: parseInt(e.target.value) || 1
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum purchases per attendee
                </p>
              </div>
              
              <div className="flex items-center mt-8">
                <Switch
                  id="is-required"
                  checked={customAddOn.isRequired}
                  onCheckedChange={(checked) => setCustomAddOn({
                    ...customAddOn,
                    isRequired: checked
                  })}
                />
                <Label htmlFor="is-required" className="ml-2">
                  Required add-on
                </Label>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button 
                variant="outline" 
                className="mr-2"
                onClick={() => setIsAddingCustom(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddCustomAddOn}>
                Add to Event
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {selectedAddOns.length > 0 ? (
        <div>
          <h3 className="text-lg font-medium mb-4">Event Add-ons</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {selectedAddOns.map(addOnRelation => {
              const addOn = getAddOnDetails(addOnRelation);
              if (!addOn) return null;
              
              return (
                <Card key={addOnRelation.addOnId.toString()}>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        {addOn.name}
                        <Badge className="ml-2">${addOn.price}</Badge>
                        {addOnRelation.isCustom && (
                          <Badge variant="outline" className="ml-2">Custom</Badge>
                        )}
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
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <p className="text-muted-foreground">No add-ons added to this event yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add existing add-ons or create custom ones to enhance your event
          </p>
        </div>
      )}
      
      {/* Add button to add a new custom add-on when there are already add-ons */}
      {selectedAddOns.length > 0 && !isAddingCustom && (
        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={() => setIsAddingCustom(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another Custom Add-on
        </Button>
      )}
    </div>
  );
}