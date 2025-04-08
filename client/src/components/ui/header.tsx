import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Ticket, MenuIcon, X, LogOut, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const UserProfile = () => {
  const { user, logoutMutation } = useAuth();
  
  if (!user) {
    return (
      <Link href="/auth">
        <Button variant="outline">Login</Button>
      </Link>
    );
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const initials = user.name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 rounded-full p-1 hover:bg-gray-100 focus:outline-none">
          <Avatar className="h-8 w-8 border border-gray-200">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium">{user.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my-tickets" className="w-full cursor-pointer">
            My Tickets
          </Link>
        </DropdownMenuItem>
        {['eventManager', 'admin'].includes(user.role) && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/managed-events" className="w-full cursor-pointer">
                My Events
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/sales/${user.id}`} className="w-full cursor-pointer">
                Sales Reports
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {user.role === 'center' && (
          <DropdownMenuItem asChild>
            <Link href="/center" className="w-full cursor-pointer flex items-center">
              <Building2 className="h-4 w-4 mr-2" />
              Venue Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-red-500 focus:text-red-500 cursor-pointer"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();

  const showManagerOptions = user && ['eventManager', 'admin'].includes(user.role);
  const isCenter = user && user.role === 'center';

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
              Browse Events
            </Link>
            {user && (
              <Link 
                href="/my-tickets" 
                className={`${location === '/my-tickets' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
              >
                My Tickets
              </Link>
            )}
            {showManagerOptions && (
              <>
                <Link 
                  href="/managed-events" 
                  className={`${location === '/managed-events' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
                >
                  Managed Events
                </Link>
                <Link 
                  href={`/sales/${user.id}`}
                  className={`${location.startsWith('/sales/') ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
                >
                  Sales Reports
                </Link>
                {user.role === 'admin' && (
                  <Link 
                    href="/admin"
                    className={`${location === '/admin' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium`}
                  >
                    Admin Dashboard
                  </Link>
                )}
              </>
            )}
            {isCenter && (
              <Link 
                href="/center"
                className={`${location === '/center' ? 'text-primary' : 'text-gray-700'} hover:text-primary px-3 py-2 rounded-md text-sm font-medium flex items-center`}
              >
                <Building2 className="h-4 w-4 mr-1" />
                Venue Dashboard
              </Link>
            )}
          </div>
          
          <div className="flex items-center">
            <div className="relative">
              <UserProfile />
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
              Browse Events
            </Link>
            {user && (
              <Link 
                href="/my-tickets" 
                className={`${location === '/my-tickets' ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                My Tickets
              </Link>
            )}
            {showManagerOptions && (
              <>
                <Link 
                  href="/managed-events" 
                  className={`${location === '/managed-events' ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Managed Events
                </Link>
                <Link 
                  href={`/sales/${user.id}`}
                  className={`${location.startsWith('/sales/') ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sales Reports
                </Link>
                {user.role === 'admin' && (
                  <Link 
                    href="/admin"
                    className={`${location === '/admin' ? 'text-primary' : 'text-gray-700'} block px-3 py-2 rounded-md text-base font-medium`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
              </>
            )}
            {isCenter && (
              <Link 
                href="/center"
                className={`${location === '/center' ? 'text-primary' : 'text-gray-700'} flex items-center px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Venue Dashboard
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
