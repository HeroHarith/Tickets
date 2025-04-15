import React from "react";
import { SubscriptionPlan } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  onSelect: (plan: SubscriptionPlan) => void;
  isRecommended?: boolean;
  isCurrentPlan?: boolean;
}

export function SubscriptionPlanCard({
  plan,
  onSelect,
  isRecommended = false,
  isCurrentPlan = false,
}: SubscriptionPlanCardProps) {
  const displayPrice = parseFloat(plan.price.toString()).toFixed(2);
  
  return (
    <Card className={`w-full h-full flex flex-col ${isRecommended ? 'border-2 border-primary shadow-lg' : ''}`}>
      {isRecommended && (
        <div className="bg-primary text-primary-foreground text-center py-1 px-2 text-sm font-medium">
          Recommended
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mb-4">
          <span className="text-4xl font-bold">${displayPrice}</span>
          <span className="text-muted-foreground ml-1">/{plan.billingPeriod === 'monthly' ? 'month' : 'year'}</span>
        </div>
        
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onSelect(plan)} 
          className="w-full" 
          variant={isRecommended ? "default" : "outline"}
          disabled={isCurrentPlan}
        >
          {isCurrentPlan ? "Current Plan" : "Subscribe"}
        </Button>
      </CardFooter>
    </Card>
  );
}