import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Onboarding from "@/pages/Onboarding";
import DataManagement from "@/pages/DataManagement";
import TwinPage from "@/pages/Twin";
import PathwaysV2 from "@/pages/PathwaysV2";
import Finish from "@/pages/Finish";
import WrapUp from "@/pages/WrapUp";
import Disclaimer, { hasAcceptedDisclaimer } from "@/pages/Disclaimer";
import { PrepareGate } from "@/components/prepare/PrepareGate";

const queryClient = new QueryClient();

// Development-only visual preview (synthetic data). The dynamic import sits
// behind import.meta.env.DEV, so production builds drop the module and its
// sample data entirely — it can never reach a customer-facing build.
const VisualPreview = import.meta.env.DEV ? lazy(() => import("@/dev/VisualPreview")) : null;

// Team-only editor: behind a server-checked password and loaded as its own
// chunk only after unlocking (see PrepareGate for what this does and doesn't protect).
const PrepareLead = lazy(() => import("@/pages/PrepareLead"));

function SmartRedirect() {
  // Every width follows the canonical flow: disclaimer → onboarding → twin.
  // The demo shows the lead case the team set active in /prepare; with no
  // case it shows a "not prepared" state (never example data).
  if (!hasAcceptedDisclaimer()) return <Redirect to="/disclaimer" />;
  return <Redirect to="/questionnaire" />;
}

/**
 * Gate any downstream route on the disclaimer flag. Redirects to
 * /disclaimer when not yet accepted, otherwise renders the children.
 * Wrapping at the route level (rather than inside each page) keeps the
 * page components free of routing concerns.
 */
function RequireDisclaimer({ children }: { children: React.ReactNode }) {
  if (!hasAcceptedDisclaimer()) return <Redirect to="/disclaimer" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <SmartRedirect />
      </Route>
      <Route path="/disclaimer">
        <Disclaimer />
      </Route>
      <Route path="/questionnaire">
        <RequireDisclaimer>
          <Onboarding />
        </RequireDisclaimer>
      </Route>
      <Route path="/twin">
        <TwinPage />
      </Route>
      <Route path="/upload">
        <DataManagement />
      </Route>
      <Route path="/pathways">
        <PathwaysV2 />
      </Route>
      <Route path="/brief">
        <WrapUp />
      </Route>
      <Route path="/executive-brief">
        <Finish />
      </Route>
      <Route path="/diagnostics">
        <Redirect to="/twin" />
      </Route>
      <Route path="/prepare">
        <PrepareGate>
          <Suspense fallback={null}>
            <PrepareLead />
          </Suspense>
        </PrepareGate>
      </Route>
      {VisualPreview && (
        <Route path="/dev/visual-preview">
          <Suspense fallback={null}>
            <VisualPreview />
          </Suspense>
        </Route>
      )}
      <Route>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">404 — Page Not Found</h1>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
