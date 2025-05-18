import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Event, TicketType } from "@shared/schema";
import SocialShare from "@/components/ui/social-share";
import { FC } from "react";

interface EventCardProps {
  event: Event;
  ticketTypes?: TicketType[];
  featured?: boolean;
  className?: string;
}

export function EventCard({ event, ticketTypes, featured = false, className = "" }: EventCardProps) {
  // Check if event is past
  const isPastEvent = new Date(event.startDate) < new Date();
  
  const lowestPrice = ticketTypes && ticketTypes.length > 0
    ? Math.min(...ticketTypes.map(t => Number(t.price)))
    : null;
    
  const highestPrice = ticketTypes && ticketTypes.length > 0
    ? Math.max(...ticketTypes.map(t => Number(t.price)))
    : null;
    
  // Common function to format prices with proper currency
  const formatPrice = (price: number) => {
    return `${price.toFixed(2)} OMR`;
  };
  
  // Display price range if we have both low and high prices that differ
  const displayPrice = () => {
    if (lowestPrice === null) {
      return "Price TBA";
    }
    
    if (lowestPrice === highestPrice) {
      return formatPrice(lowestPrice as number);
    }
    
    return `${formatPrice(lowestPrice as number)} - ${formatPrice(highestPrice as number)}`;
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg ${featured ? 'border-2 border-primary' : ''} ${className}`}>
      <div className="relative">
        <img 
          src={event.imageUrl || "https://placehold.co/800x400/e2e8f0/64748b?text=Event+Image"} 
          alt={event.title} 
          className={`w-full h-48 object-cover ${isPastEvent ? 'opacity-60 grayscale' : ''}`}
        />
        {featured && (
          <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
            Featured
          </div>
        )}
        {isPastEvent && (
          <div className="absolute top-2 left-2 bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">
            Past Event
          </div>
        )}
        <div className="absolute -bottom-4 right-4">
          <SocialShare 
            title={`Check out ${event.title}!`} 
            url={`/events/${event.id}`}
          />
        </div>
      </div>
      
      <div className="p-4 pt-6">
        <h3 className="font-semibold text-lg mb-1 text-gray-900 truncate">
          {event.title}
        </h3>
        
        <div className="text-gray-500 text-sm mb-2 flex items-center">
          <Calendar className="h-4 w-4 mr-1" />
          <span>
            {format(new Date(event.startDate), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
        
        <div className="text-gray-500 text-sm mb-4 flex items-center">
          <MapPin className="h-4 w-4 mr-1" />
          <span className="truncate">{event.location}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="font-medium text-gray-900">
            {displayPrice()}
          </div>
          
          <Link href={`/events/${event.id}`}>
            <Button 
              variant={isPastEvent ? "outline" : "default"} 
              className={`text-sm ${isPastEvent ? 'text-gray-500' : ''}`}
              size="sm"
            >
              {isPastEvent ? 'Past Event Details' : 'View Event'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}