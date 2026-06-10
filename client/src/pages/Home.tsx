import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Zap, Shield, TrendingUp, Cpu } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearCheckoutIntent, loadCheckoutIntent } from "@/lib/checkoutIntent";

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // Resume a checkout interrupted by login: OAuth returns the user to "/", so we
  // forward them back to the checkout they started (consuming the intent once).
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const intent = loadCheckoutIntent();
    if (!intent) return;
    clearCheckoutIntent();
    setLocation(`/checkout?offerId=${intent.offerId}&leadId=${intent.leadId}`);
  }, [loading, isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header Navigation */}
      <header className="border-b border-border/50 bg-background/70 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-accent" />
            <span className="font-bold text-lg">DatacenterMarket</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-grid pointer-events-none [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute inset-0 glow-halo pointer-events-none" />

        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="space-y-5">
              <p className="tech-label">
                <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />
                EU sovereign GPU marketplace
              </p>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Get AI Compute & Datacenter Capacity in <span className="text-accent">72h</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Instantly connect with GPU providers and datacenters across Europe. Compare infrastructure, get instant quotes, and provision in hours—not weeks.
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base glow-accent"
                onClick={() => setLocation("/workload")}
              >
                Request Compute
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border hover:bg-card hover:text-foreground px-8 py-6 text-base"
                onClick={() => setLocation("/pricing")}
              >
                View Pricing
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-6 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <span>EU Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                <span>Instant Quotes</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span>99.9% SLA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 border-t border-border/50">
        <div className="container">
          <div className="max-w-3xl mx-auto mb-16">
            <p className="tech-label mb-3">Why us</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why DatacenterMarket?</h2>
            <p className="text-lg text-muted-foreground">
              Eliminate the complexity of infrastructure sourcing. We handle provider matching, contract generation, and provisioning so you can focus on your workloads.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-muted-foreground">
                From request to provisioning in 72 hours. No lengthy sales cycles or manual negotiations.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Fully Compliant</h3>
              <p className="text-muted-foreground">
                All infrastructure is EU-based with GDPR compliance, high availability, and bare metal options.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="tech-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Transparent Pricing</h3>
              <p className="text-muted-foreground">
                Compare 3 vetted options side-by-side. No hidden fees, no surprise costs. Pay what you see.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 border-t border-border/50 bg-card/50">
        <div className="container">
          <div className="text-center mb-16">
            <p className="tech-label mb-3">Track record</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by AI Teams</h2>
            <p className="text-lg text-muted-foreground">
              Leading AI companies rely on DatacenterMarket for fast, reliable infrastructure
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/60">
            <div className="space-y-2 bg-card py-8 px-4 text-center">
              <p className="text-3xl font-bold text-accent font-mono">500+</p>
              <p className="text-sm text-muted-foreground">Infrastructure Requests</p>
            </div>
            <div className="space-y-2 bg-card py-8 px-4 text-center">
              <p className="text-3xl font-bold text-accent font-mono">72h</p>
              <p className="text-sm text-muted-foreground">Average Provisioning</p>
            </div>
            <div className="space-y-2 bg-card py-8 px-4 text-center">
              <p className="text-3xl font-bold text-accent font-mono">99.9%</p>
              <p className="text-sm text-muted-foreground">Uptime SLA</p>
            </div>
            <div className="space-y-2 bg-card py-8 px-4 text-center">
              <p className="text-3xl font-bold text-accent font-mono">€2M+</p>
              <p className="text-sm text-muted-foreground">Monthly Capacity</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Ready to Get Started?</h2>
              <p className="text-lg text-muted-foreground">
                Tell us about your workload and we'll find the perfect infrastructure match in minutes.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-base glow-accent"
              onClick={() => setLocation("/workload")}
            >
              Request Compute
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-card/30">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="/legal" className="hover:text-foreground transition-colors">Legal Notice</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Connect</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">LinkedIn</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/50 pt-8 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground mb-1">DatacenterMarket</p>
                <p className="text-xs">A service of Anavim Advisory SAS</p>
                <p className="text-xs mt-2">10 Rue du Colisee, 75008 Paris, France</p>
              </div>
              <div className="text-right">
                <p>&copy; 2026 DatacenterMarket. All rights reserved.</p>
                <p className="text-xs mt-1"><a href="https://www.anavimadvisory.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Learn more about Anavim Advisory</a></p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
