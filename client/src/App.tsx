import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Settings from "@/pages/settings";
import Explore from "@/pages/explore";
import ShareLinks from "@/pages/share-links";
import Profile from "@/pages/profile";
import GuideDetail from "@/pages/guide-detail";
import Credits from "@/pages/credits";
import DreamStudio from "@/pages/dream-studio";
import NotFound from "@/pages/not-found";
import "./lib/i18n";

function Router() {
  console.log("Router component rendered");
  const { isAuthenticated, isLoading } = useAuth();
  console.log("Router auth state:", { isAuthenticated, isLoading });

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/guides/:id" component={GuideDetail} />
          <Route path="/settings" component={Settings} />
          <Route path="/explore" component={Explore} />
          <Route path="/share-links" component={ShareLinks} />
          <Route path="/profile" component={Profile} />
          <Route path="/credits" component={Credits} />
          <Route path="/dream-studio" component={DreamStudio} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
