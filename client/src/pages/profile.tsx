import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Redirect } from "wouter";
import { Loader2, Mail, Check, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Password change schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export default function ProfilePage() {
  const { user, resendVerificationMutation } = useAuth();
  const { toast } = useToast();
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  
  // Password change form
  const passwordChangeForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  const onPasswordChangeSubmit = (values: PasswordChangeValues) => {
    // We would implement this in a future update
    toast({
      title: "Feature coming soon",
      description: "Password change functionality will be available soon.",
    });
    setIsEditingPassword(false);
  };

  // If user is not logged in, redirect to auth page
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top notification bar for email verification */}
      {!user.emailVerified && (
        <div className="bg-amber-50 border-b border-amber-200 py-2">
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Please verify your email address to access all features
              </p>
            </div>
            <Button
              onClick={() => resendVerificationMutation.mutate()}
              variant="outline"
              size="sm"
              className="bg-white border-amber-200 hover:bg-amber-50 text-amber-700 text-xs h-7 px-2"
              disabled={resendVerificationMutation.isPending}
            >
              {resendVerificationMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Resending...
                </>
              ) : (
                "Resend verification email"
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => resendVerificationMutation.mutate()}
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={resendVerificationMutation.isPending || user.emailVerified}
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Verify Email</span>
            </Button>
            
            <Button
              onClick={() => setIsEditingPassword(true)}
              disabled={isEditingPassword}
              variant="outline"
              size="sm"
            >
              Change Password
            </Button>
          </div>
        </div>
        
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information Card */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-1">
                  <Label className="text-muted-foreground text-xs font-normal">Full Name</Label>
                  <div className="font-medium">{user.name}</div>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  <Label className="text-muted-foreground text-xs font-normal">Username</Label>
                  <div className="font-medium">{user.username}</div>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  <Label className="text-muted-foreground text-xs font-normal">Email</Label>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.email}</span>
                    {user.emailVerified ? (
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
                        <Check className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Pending
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  <Label className="text-muted-foreground text-xs font-normal">Role</Label>
                  <div className="font-medium capitalize">{user.role}</div>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  <Label className="text-muted-foreground text-xs font-normal">Member Since</Label>
                  <div className="font-medium">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Status Card */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-lg">Account Security Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-green-100 p-1.5 rounded-full mt-0.5 mr-3">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <span className="font-medium">Password Set</span>
                    <p className="text-sm text-muted-foreground">
                      Your account is protected with a password
                    </p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <div className={`p-1.5 rounded-full mt-0.5 mr-3 ${user.emailVerified ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {user.emailVerified ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Email Verification</span>
                    <p className="text-sm text-muted-foreground">
                      {user.emailVerified 
                        ? "Your email has been verified" 
                        : "Verify your email to enhance account security"}
                    </p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <div className="bg-green-100 p-1.5 rounded-full mt-0.5 mr-3">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <span className="font-medium">Recent Login</span>
                    <p className="text-sm text-muted-foreground">
                      Last login was successful and secure
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
          
          {/* Account Activity Card */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-lg">Security Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-primary/10 p-1.5 rounded-full mt-0.5 mr-3">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="text-primary"
                    >
                      <path d="M12 10v4m0 0v4m0-4h4m-4 0H8" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Use a strong password</span>
                    <p className="text-sm text-muted-foreground">
                      Combine uppercase, lowercase letters, numbers, and symbols
                    </p>
                  </div>
                </li>
                
                {!user.emailVerified && (
                  <li className="flex items-start">
                    <div className="bg-amber-100 p-1.5 rounded-full mt-0.5 mr-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <span className="font-medium">Verify your email</span>
                      <p className="text-sm text-muted-foreground">
                        Enhances your account security and recovery options
                      </p>
                    </div>
                  </li>
                )}
                
                <li className="flex items-start">
                  <div className="bg-primary/10 p-1.5 rounded-full mt-0.5 mr-3">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="text-primary"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Regular password updates</span>
                    <p className="text-sm text-muted-foreground">
                      Change your password periodically for enhanced security
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
        
        {/* Password Change Form */}
        {isEditingPassword && (
          <Card className="mt-6">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>
                Update your account password
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...passwordChangeForm}>
                <form
                  onSubmit={passwordChangeForm.handleSubmit(onPasswordChangeSubmit)}
                  className="space-y-4 max-w-xl"
                >
                  <FormField
                    control={passwordChangeForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordChangeForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordChangeForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={passwordChangeForm.formState.isSubmitting}
                    >
                      Update Password
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditingPassword(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}