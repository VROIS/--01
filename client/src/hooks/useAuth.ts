import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  console.log("useAuth hook called");
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  console.log("useAuth state:", { user, isLoading, isAuthenticated: !!user, error });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error
  };
}
