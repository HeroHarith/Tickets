import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  forgotPasswordMutation: UseMutationResult<void, Error, { email: string }>;
  resetPasswordMutation: UseMutationResult<void, Error, { token: string; newPassword: string }>;
  resendVerificationMutation: UseMutationResult<void, Error, void>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: userData,
    error,
    isLoading,
  } = useQuery<{data: SelectUser} | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  // Extract the user data from the standardized response format
  const user = userData?.data || null;

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const response = await res.json();
      // Handle our standardized API response format
      return response.data;
    },
    onSuccess: (user: SelectUser) => {
      // Store the response in the standardized format to be consistent
      queryClient.setQueryData(["/api/user"], { data: user });
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      const response = await res.json();
      // Handle our standardized API response format
      return response.data;
    },
    onSuccess: (user: SelectUser) => {
      // Store the response in the standardized format to be consistent
      queryClient.setQueryData(["/api/user"], { data: user });
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Set to null to indicate not logged in
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const res = await apiRequest("POST", "/api/forgot-password", { email });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to process forgot password request");
      }
      // We don't need to return anything, as we just want to trigger the email
    },
    onSuccess: () => {
      toast({
        title: "Password reset email sent",
        description: "If your email exists in our system, you will receive a password reset link",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, newPassword }: { token: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/reset-password", { token, newPassword });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to reset password");
      }
      // We don't need to return anything as the user will need to log in after reset
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "Your password has been reset. Please log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resend verification email mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/resend-verification");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to resend verification email");
      }
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "A new verification email has been sent to your email address",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send verification email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        forgotPasswordMutation,
        resetPasswordMutation,
        resendVerificationMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}