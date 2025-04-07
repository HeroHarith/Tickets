import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Ticket, User, MenuIcon, X } from "lucide-react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-primary text-xl font-bold font-poppins flex items-center">
              <Ticket className="h-8 w-8 mr-2" />
              TicketHub
            </Link>
          </div>
          
          <div className="hidden md:flex space-x-4">
            <Link 
              href="/" 
              className={`${location === '/' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
            >
              Events
            </Link>
            <Link 
              href="/my-tickets" 
              className={`${location === '/my-tickets' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
            >
              My Tickets
            </Link>
            <Link 
              href="/managed-events" 
              className={`${location === '/managed-events' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
            >
              Managed Events
            </Link>
          </div>
          
          <div className="flex items-center">
            <Link href="/create-event">
              <Button className="bg-primary text-white hover:bg-primary/90">
                Create Event
              </Button>
            </Link>
            <div className="ml-4 relative">
              <button className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none">
                <User className="h-5 w-5" />
              </button>
            </div>
            <button 
              className="ml-2 md:hidden flex items-center justify-center p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden pt-2 pb-3 space-y-1">
            <Link 
              href="/" 
              className={`${location === '/' ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Events
            </Link>
            <Link 
              href="/my-tickets" 
              className={`${location === '/my-tickets' ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              My Tickets
            </Link>
            <Link 
              href="/managed-events" 
              className={`${location === '/managed-events' ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Managed Events
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
