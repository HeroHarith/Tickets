import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { EventAddOn, AddOnSelection } from '@shared/schema';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EventAddOnsProps {
  eventId: number;
  onAddOnsSelected: (addOns: AddOnSelection[]) => void;
  selectedAddOns?: AddOnSelection[];
}

export function EventAddOns({ eventId, onAddOnsSelected, selectedAddOns = [] }: EventAddOnsProps) {
  const { toast } = useToast();
  const [addOnSelections, setAddOnSelections] = useState<Record<number, AddOnSelection>>(
    selectedAddOns.reduce((acc, selection) => {
      acc[selection.addOnId] = selection;
      return acc;
    }, {} as Record<number, AddOnSelection>)
  );
  
  const { data: addOns, isLoading, error } = useQuery({
    queryKey: [`/api/add-ons/event/${eventId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/add-ons/event/${eventId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch event add-ons');
      }
      const data = await res.json();
      return data.data as (EventAddOn & {
        relationId: number;
        isRequired: boolean;
        maximumQuantity: number;
      })[];
    },
    enabled: !!eventId
  });

  const handleQuantityChange = (addOn: EventAddOn & { 
    maximumQuantity: number; 
    isRequired: boolean;
  }, quantity: number) => {
    // Validate quantity against maximum limit
    if (quantity > addOn.maximumQuantity) {
      toast({
        title: 'Maximum quantity exceeded',
        description: `You can only select up to ${addOn.maximumQuantity} of this add-on.`,
        variant: 'destructive'
      });
      quantity = addOn.maximumQuantity;
    }

    // Can't go below 1 for required add-ons
    if (addOn.isRequired && quantity < 1) {
      toast({
        title: 'Required add-on',
        description: 'This add-on is required and cannot be removed.',
        variant: 'destructive'
      });
      quantity = 1;
    }

    // Don't include if quantity is 0
    if (quantity <= 0) {
      const { [addOn.id]: _, ...rest } = addOnSelections;
      setAddOnSelections(rest);
    } else {
      setAddOnSelections({
        ...addOnSelections,
        [addOn.id]: {
          addOnId: addOn.id,
          quantity,
          note: addOnSelections[addOn.id]?.note || ''
        }
      });
    }
  };

  const handleNoteChange = (addOnId: number, note: string) => {
    if (!addOnSelections[addOnId]) return;
    
    setAddOnSelections({
      ...addOnSelections,
      [addOnId]: {
        ...addOnSelections[addOnId],
        note
      }
    });
  };

  const handleSubmit = () => {
    // Convert selections object to array
    const selectionsArray = Object.values(addOnSelections);
    
    // Add required add-ons that might be missing
    if (addOns) {
      addOns.forEach(addOn => {
        if (addOn.isRequired && !addOnSelections[addOn.id]) {
          selectionsArray.push({
            addOnId: addOn.id,
            quantity: 1,
            note: ''
          });
        }
      });
    }
    
    onAddOnsSelected(selectionsArray);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-destructive">
        Error loading add-ons. Please try again.
      </div>
    );
  }

  if (!addOns || addOns.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        No add-ons available for this event.
      </div>
    );
  }

  const calculateTotalPrice = () => {
    return Object.entries(addOnSelections).reduce((total, [id, selection]) => {
      const addOn = addOns?.find(a => a.id === parseInt(id));
      if (addOn) {
        return total + (parseFloat(addOn.price) * selection.quantity);
      }
      return total;
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary-foreground p-4 rounded-lg mb-6">
        <h3 className="text-lg font-medium flex items-center mb-2">
          <ShoppingCart className="mr-2 h-5 w-5" />
          Available Add-ons
        </h3>
        <p className="text-sm text-muted-foreground">
          Enhance your experience with these optional extras
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {addOns.map(addOn => (
          <Card key={addOn.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{addOn.name}</CardTitle>
                  <CardDescription>{addOn.description}</CardDescription>
                </div>
                <div className="flex items-center">
                  {addOn.isRequired && (
                    <Badge variant="outline" className="mr-2">Required</Badge>
                  )}
                  <Badge>${addOn.price}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor={`quantity-${addOn.id}`}>Quantity</Label>
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(
                      addOn, 
                      (addOnSelections[addOn.id]?.quantity || 0) - 1
                    )}
                    disabled={
                      (addOn.isRequired && (addOnSelections[addOn.id]?.quantity || 0) <= 1) || 
                      !(addOnSelections[addOn.id]?.quantity)
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id={`quantity-${addOn.id}`}
                    type="number"
                    className="w-16 mx-2 text-center"
                    min={addOn.isRequired ? 1 : 0}
                    max={addOn.maximumQuantity}
                    value={addOnSelections[addOn.id]?.quantity || 0}
                    onChange={(e) => handleQuantityChange(
                      addOn, 
                      parseInt(e.target.value) || 0
                    )}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(
                      addOn, 
                      (addOnSelections[addOn.id]?.quantity || 0) + 1
                    )}
                    disabled={(addOnSelections[addOn.id]?.quantity || 0) >= addOn.maximumQuantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {addOnSelections[addOn.id]?.quantity > 0 && (
                <div className="mt-4">
                  <Label htmlFor={`note-${addOn.id}`}>Special Instructions (Optional)</Label>
                  <Textarea
                    id={`note-${addOn.id}`}
                    placeholder="Any special requests or notes..."
                    className="mt-1"
                    value={addOnSelections[addOn.id]?.note || ''}
                    onChange={(e) => handleNoteChange(addOn.id, e.target.value)}
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              {addOnSelections[addOn.id]?.quantity > 0 && (
                <div className="w-full text-right font-medium">
                  Subtotal: ${(parseFloat(addOn.price) * (addOnSelections[addOn.id]?.quantity || 0)).toFixed(2)}
                </div>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {Object.keys(addOnSelections).length > 0 && (
        <div className="mt-8">
          <Separator className="my-4" />
          <div className="flex justify-between items-center">
            <div className="text-lg font-medium">Total Add-ons:</div>
            <div className="text-xl font-bold">${calculateTotalPrice().toFixed(2)}</div>
          </div>
          <Button 
            className="w-full mt-4" 
            onClick={handleSubmit}
          >
            Confirm Add-on Selections
          </Button>
        </div>
      )}
    </div>
  );
}