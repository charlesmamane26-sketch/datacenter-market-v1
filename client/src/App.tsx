import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages are code-split per route so heavy dependencies (charts, etc.) only load when needed.
const Home = lazy(() => import("@/pages/Home"));
const WorkloadForm = lazy(() => import("@/pages/WorkloadForm"));
const ProcessingScreen = lazy(() => import("@/pages/ProcessingScreen"));
const ResultsScreen = lazy(() => import("@/pages/ResultsScreen"));
const OfferDetail = lazy(() => import("@/pages/OfferDetail"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Confirmation = lazy(() => import("@/pages/Confirmation"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const LegalNotice = lazy(() => import("@/pages/LegalNotice"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/workload"} component={WorkloadForm} />
        <Route path={"/processing"} component={ProcessingScreen} />
        <Route path={"/results"} component={ResultsScreen} />
        <Route path={"/offer-detail/:offerId"} component={OfferDetail} />
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/confirmation"} component={Confirmation} />
        <Route path={"/dashboard"} component={ClientDashboard} />
        <Route path={"/admin"} component={AdminDashboard} />
        <Route path={"/terms"} component={TermsOfService} />
        <Route path={"/privacy"} component={PrivacyPolicy} />
        <Route path={"/legal"} component={LegalNotice} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
