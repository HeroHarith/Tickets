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
    <div className="container max-w-5xl py-10">
      <h1 className="text-3xl font-bold mb-8">My Profile</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your personal account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Full Name</Label>
                <div className="font-medium">{user.name}</div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Username</Label>
                <div className="font-medium">{user.username}</div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.email}</span>
                  {user.emailVerified ? (
                    <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                      <Check className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Verification Pending
                    </Badge>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Role</Label>
                <div className="font-medium capitalize">{user.role}</div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Member Since</Label>
                <div className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            {!user.emailVerified && (
              <Button
                onClick={() => resendVerificationMutation.mutate()}
                variant="outline"
                className="gap-2"
                disabled={resendVerificationMutation.isPending}
              >
                {resendVerificationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            )}
            
            <Button
              onClick={() => setIsEditingPassword(true)}
              disabled={isEditingPassword}
              variant="outline"
            >
              Change Password
            </Button>
          </CardFooter>
        </Card>

        {/* Password Change Form */}
        {isEditingPassword && (
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordChangeForm}>
                <form
                  onSubmit={passwordChangeForm.handleSubmit(onPasswordChangeSubmit)}
                  className="space-y-4"
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
        
        {/* Email Verification Alert if not verified */}
        {!user.emailVerified && !isEditingPassword && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Email verification required</AlertTitle>
            <AlertDescription>
              Please verify your email address to access all features. We've sent a verification link to your email.
              <Button
                onClick={() => resendVerificationMutation.mutate()}
                variant="link"
                className="text-amber-700 px-0 mt-2"
                disabled={resendVerificationMutation.isPending}
              >
                {resendVerificationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Resending...
                  </>
                ) : (
                  "Resend verification email"
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Account Security Recommendations */}
        {!isEditingPassword && (
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>
                Tips to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="bg-green-100 p-1 rounded-full mt-0.5">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <span className="font-medium">Use a strong password</span>
                    <p className="text-sm text-muted-foreground">
                      Combine uppercase, lowercase letters, numbers, and symbols
                    </p>
                  </div>
                </li>
                
                <li className="flex items-start gap-3">
                  <div className={`p-1 rounded-full mt-0.5 ${user.emailVerified ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {user.emailVerified ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Verify your email</span>
                    <p className="text-sm text-muted-foreground">
                      Enhances your account security and recovery options
                    </p>
                  </div>
                </li>
                
                <li className="flex items-start gap-3">
                  <div className="bg-green-100 p-1 rounded-full mt-0.5">
                    <Check className="h-4 w-4 text-green-600" />
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
        )}
      </div>
    </div>
  );
}