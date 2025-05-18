import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Event, TicketType } from "@shared/schema";
import SocialShare from "@/components/ui/social-share";

interface EventCardProps {
  event: Event;
  ticketTypes?: TicketType[];
  featured?: boolean;
  className?: string;
}

const EventCard = ({ event, ticketTypes, featured = false, className = "" }: EventCardProps) => {
  // Calculate price range
  const getPriceRange = () => {
    if (!ticketTypes || ticketTypes.length === 0) {
      return "Price unavailable";
    }
    
    const prices = ticketTypes.map(t => Number(t.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    if (minPrice === maxPrice) {
      return `${minPrice.toFixed(2)} OMR`;
    }
    
    return `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} OMR`;
  };
  
  // Check ticket availability
  const getAvailabilityStatus = () => {
    if (!ticketTypes || ticketTypes.length === 0) {
      return { text: "Unavailable", color: "text-gray-500" };
    }
    
    const totalAvailable = ticketTypes.reduce((sum, t) => sum + t.availableQuantity, 0);
    const totalQuantity = ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
    const availabilityPercentage = (totalAvailable / totalQuantity) * 100;
    
    if (totalAvailable === 0) {
      return { text: "Sold Out", color: "text-gray-500" };
    } else if (availabilityPercentage < 20) {
      return { text: "Almost Sold Out", color: "text-amber-500" };
    } else if (availabilityPercentage < 50) {
      return { text: "Limited Tickets", color: "text-amber-500" };
    } else {
      return { text: "Tickets Available", color: "text-success" };
    }
  };
  
  // Format date range
  const formatEventDate = () => {
    const startDate = new Date(event.startDate);
    
    if (!event.endDate) {
      return format(startDate, "MMM d, yyyy");
    }
    
    const endDate = new Date(event.endDate);
    
    // Same day event
    if (startDate.toDateString() === endDate.toDateString()) {
      return format(startDate, "MMM d, yyyy");
    }
    
    // Same month event
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${format(startDate, "MMM d")}-${format(endDate, "d, yyyy")}`;
    }
    
    // Different month or year
    return `${format(startDate, "MMM d")}-${format(endDate, "MMM d, yyyy")}`;
  };
  
  const availability = getAvailabilityStatus();
  
  // Default placeholder image if none provided
  const imageUrl = event.imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80";
  
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ${className}`}>
      <div className={`${featured ? 'h-48' : 'h-40'} bg-gray-300 relative`}>
        <img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover"
        />
        {featured && (
          <div className="absolute top-4 right-4 bg-secondary text-white text-xs font-bold px-2 py-1 rounded">
            FEATURED
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold font-poppins text-gray-900 mb-1">{event.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{event.location}</p>
          </div>
          <div className="bg-accent text-white text-xs font-bold px-2 py-1 rounded">
            {event.category.toUpperCase()}
          </div>
        </div>
        
        <div className="flex items-center text-sm text-gray-600 mb-3">
          <Calendar className="h-4 w-4 mr-1" />
          {formatEventDate()}
        </div>
        
        <div className="flex justify-between items-center">
          <div className="font-semibold text-gray-900">{getPriceRange()}</div>
          <div className={`text-sm font-medium ${availability.color}`}>{availability.text}</div>
        </div>
        
        <div className="flex items-center justify-between mt-3 gap-2">
          <SocialShare 
            title={event.title}
            description={event.description || `${event.title} at ${event.location}`}
            url={`${window.location.origin}/events/${event.id}`}
            imageUrl={imageUrl || undefined}
          />
          
          <Link href={`/events/${event.id}`} className="flex-1">
            <Button 
              variant="default" 
              className="w-full bg-primary hover:bg-primary/90"
              disabled={availability.text === "Sold Out"}
            >
              {availability.text === "Sold Out" ? "Sold Out" : "Get Tickets"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
