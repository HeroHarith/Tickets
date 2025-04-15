import { useState } from "react";
import { SubscriptionPlan } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionPlanCard } from "./subscription-plan-card";

interface SubscriptionPlansGridProps {
  plans: SubscriptionPlan[];
  currentPlanId?: number;
  userType?: string; // "eventManager" or "center"
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

export function SubscriptionPlansGrid({ 
  plans, 
  currentPlanId,
  userType,
  onSelectPlan 
}: SubscriptionPlansGridProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [filterType, setFilterType] = useState<string | undefined>(userType);
  
  // Group plans by type
  const plansByType = plans.reduce((acc, plan) => {
    if (!acc[plan.type]) {
      acc[plan.type] = [];
    }
    acc[plan.type].push(plan);
    return acc;
  }, {} as Record<string, SubscriptionPlan[]>);
  
  // Get unique plan types
  const planTypes = Object.keys(plansByType);
  
  // Filter plans by billing period and type
  const filteredPlans = plans.filter(plan => 
    plan.billingPeriod === billingPeriod && 
    (filterType ? plan.type === filterType : true)
  );
  
  // Sort plans by price
  const sortedPlans = [...filteredPlans].sort((a, b) => 
    parseFloat(a.price.toString()) - parseFloat(b.price.toString())
  );
  
  // Check if we need to show type filter (only if there are multiple types)
  const showTypeFilter = planTypes.length > 1 && !userType;
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{filterType ? `${filterType} Subscriptions` : "Available Subscriptions"}</h2>
          <p className="text-muted-foreground">
            {filterType === "eventManager" 
              ? "Create and sell tickets for your events"
              : filterType === "center" 
                ? "Manage venues and bookings for your center"
                : "Choose a plan that fits your needs"}
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Tabs 
            defaultValue={billingPeriod} 
            onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
            className="w-[260px]"
          >
            <TabsList className="w-full">
              <TabsTrigger value="monthly" className="flex-1">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="flex-1">Annual (Save)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {showTypeFilter && (
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={!filterType ? "default" : "outline"} 
            onClick={() => setFilterType(undefined)}
            size="sm"
          >
            All Plans
          </Button>
          {planTypes.map((type) => (
            <Button 
              key={type}
              variant={filterType === type ? "default" : "outline"}
              onClick={() => setFilterType(type)}
              size="sm"
            >
              {type === "eventManager" ? "Event Manager" : type === "center" ? "Venue Owner" : type}
            </Button>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlans.map((plan) => (
          <SubscriptionPlanCard
            key={plan.id}
            plan={plan}
            onSelect={onSelectPlan}
            isRecommended={plan.billingPeriod === "yearly"}
            isCurrentPlan={currentPlanId === plan.id}
          />
        ))}
        
        {sortedPlans.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No subscription plans available for the selected criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}