import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubscriptionPlan } from "@shared/schema";
import { purchaseSubscription } from "@/services/SubscriptionService";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters" }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().min(8, { message: "Phone number must be at least 8 characters" }),
});

type FormValues = z.infer<typeof formSchema>;

interface SubscriptionPaymentFormProps {
  plan: SubscriptionPlan;
  onSuccess: (paymentUrl: string) => void;
  onCancel: () => void;
}

export function SubscriptionPaymentForm({ plan, onSuccess, onCancel }: SubscriptionPaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
  });
  
  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await purchaseSubscription(plan.id, values);
      toast({
        title: "Success!",
        description: "Redirecting to payment page...",
      });
      onSuccess(result.paymentUrl);
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Error",
        description: "There was a problem creating your subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-muted/30 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">Subscription Summary</h3>
          <div className="flex justify-between">
            <span>{plan.name}</span>
            <span>${parseFloat(plan.price.toString()).toFixed(2)}/{plan.billingPeriod === 'monthly' ? 'month' : 'year'}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Email address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="Phone number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Proceed to Payment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}