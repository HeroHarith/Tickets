import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";

type ProtectedRouteProps = {
  path: string;
  component: () => React.JSX.Element | null;
  requiredRoles?: string[];
};

export function ProtectedRoute({
  path,
  component: Component,
  requiredRoles = [],
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if the user has the required role
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
        </div>
      </Route>
    );
  }

  // Wrap the component with the authenticated layout
  return (
    <Route path={path}>
      <>
        <Header />
        <main className="flex-grow">
          <Component />
        </main>
        <Footer />
      </>
    </Route>
  );
}