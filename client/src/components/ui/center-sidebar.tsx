import { useState } from "react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  Home, 
  LayoutGrid,
  Grid,
  LogOut, 
  Menu, 
  Settings, 
  UsersRound,
  Building2 
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarNavProps {
  className?: string;
}

export function CenterSidebar({ className }: SidebarNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { logoutMutation } = useAuth();
  const isMobile = useIsMobile();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const sidebarItems = [
    {
      title: "Dashboard",
      href: "/center",
      icon: <Home className="mr-2 h-4 w-4" />,
    },
    {
      title: "Booking Management",
      href: "/center/bookings",
      icon: <Calendar className="mr-2 h-4 w-4" />,
    },
    {
      title: "Manage Venues",
      href: "/center/venues",
      icon: <LayoutGrid className="mr-2 h-4 w-4" />,
    },
    {
      title: "All Venues",
      href: "/center/all-venues",
      icon: <Building2 className="mr-2 h-4 w-4" />,
    },
    {
      title: "Schedule",
      href: "/center/schedule",
      icon: <Clock className="mr-2 h-4 w-4" />,
    },
    {
      title: "Customers",
      href: "/center/customers",
      icon: <UsersRound className="mr-2 h-4 w-4" />,
    },
    {
      title: "Settings",
      href: "/center/settings",
      icon: <Settings className="mr-2 h-4 w-4" />,
    }
  ];

  // Mobile collapsible sidebar
  if (isMobile) {
    return (
      <>
        <Button 
          variant="ghost" 
          size="icon" 
          className="fixed top-4 left-4 z-50"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {isOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          >
            <div 
              className="h-full w-64 bg-card border-r shadow-lg p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col h-full">
                <div className="text-xl font-bold py-4 border-b mb-4">
                  Venue Center
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="space-y-1">
                    {sidebarItems.map((item) => (
                      <Link 
                        key={item.href} 
                        href={item.href}
                      >
                        <Button
                          variant={location === item.href ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setIsOpen(false)}
                        >
                          {item.icon}
                          {item.title}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="pt-4 border-t mt-auto">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop fixed sidebar
  return (
    <div className={cn("pb-12 h-screen", className)}>
      <div className="space-y-4 py-4 h-full flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Venue Center
          </h2>
        </div>
        <div className="px-3 overflow-y-auto flex-1">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
              >
                <Button
                  variant={location === item.href ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  {item.icon}
                  {item.title}
                </Button>
              </Link>
            ))}
          </div>
        </div>
        <div className="px-3 mt-auto border-t pt-4">
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}