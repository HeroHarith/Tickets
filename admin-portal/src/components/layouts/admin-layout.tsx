import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Users, 
  Calendar, 
  LayoutDashboard, 
  Settings, 
  Package, 
  Building, 
  LogOut, 
  Menu, 
  X,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import { cn } from '../../lib/utils';

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Link href={href}>
      <a
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
          isActive 
            ? "bg-primary text-primary-foreground" 
            : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
        )}
        onClick={onClick}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </a>
    </Link>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-4">
          <button 
            className="lg:hidden p-2"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold">Admin Portal</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Welcome, {user?.name || 'Admin'}
          </div>
          <button 
            onClick={() => logout()}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Mobile Navigation Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={closeMobileMenu}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={cn(
            "w-64 border-r border-gray-200 bg-white p-4 flex flex-col overflow-y-auto",
            "fixed top-0 bottom-0 pt-16 lg:pt-16 transition-transform z-50 lg:z-auto lg:translate-x-0 lg:sticky lg:h-screen",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex justify-end lg:hidden">
            <button 
              onClick={closeMobileMenu}
              className="p-2 text-gray-500 hover:text-gray-700"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <nav className="space-y-1 mt-4">
            <NavItem 
              href="/dashboard" 
              icon={LayoutDashboard} 
              label="Dashboard" 
              isActive={location === "/dashboard"} 
              onClick={closeMobileMenu}
            />
            <NavItem 
              href="/users" 
              icon={Users} 
              label="Users" 
              isActive={location === "/users"} 
              onClick={closeMobileMenu}
            />
            <NavItem 
              href="/events" 
              icon={Calendar} 
              label="Events" 
              isActive={location === "/events"} 
              onClick={closeMobileMenu}
            />
            <NavItem 
              href="/venues" 
              icon={Building} 
              label="Venues" 
              isActive={location === "/venues"} 
              onClick={closeMobileMenu}
            />
            <NavItem 
              href="/subscriptions" 
              icon={CreditCard} 
              label="Subscriptions" 
              isActive={location === "/subscriptions"} 
              onClick={closeMobileMenu}
            />
            <NavItem 
              href="/tickets" 
              icon={Package} 
              label="Tickets" 
              isActive={location === "/tickets"} 
              onClick={closeMobileMenu}
            />
            <NavItem 
              href="/settings" 
              icon={Settings} 
              label="Settings" 
              isActive={location === "/settings"} 
              onClick={closeMobileMenu}
            />
          </nav>

          <div className="mt-auto pt-4 border-t border-gray-200">
            <button 
              onClick={() => logout()}
              className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md hover:bg-gray-100 text-gray-700"
            >
              <LogOut className="h-5 w-5" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}