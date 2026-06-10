import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Cpu, Layers, DollarSign, Activity, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";

const ACTIVE_STATUSES = ["processing", "provisioning", "active"];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500/15 text-green-400";
    case "provisioning":
    case "processing":
      return "bg-blue-500/15 text-blue-400";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "cancelled":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-amber-500/15 text-amber-400"; // pending
  }
}

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: orders } = trpc.orders.list.useQuery();
  const { data: offers } = trpc.offers.list.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    logout();
    setLocation("/");
  };

  const orderList = orders ?? [];
  const offerById = new Map((offers ?? []).map(o => [o.id, o]));
  const billable = orderList.filter(o => o.status !== "cancelled");
  const monthlySpend = billable.reduce((sum, o) => sum + Number(o.monthlyRecurring), 0);
  const activeServices = orderList.filter(o => ACTIVE_STATUSES.includes(o.status)).length;

  // Live telemetry for the primary active order — empty until a provider feeds metrics.
  const primaryOrderId = orderList.find(o => o.status === "active")?.id ?? orderList[0]?.id;
  const { data: latestMetrics } = trpc.metrics.getLatest.useQuery(
    { orderId: primaryOrderId ?? 0 },
    { enabled: primaryOrderId != null },
  );
  const gpuUsage =
    latestMetrics?.gpuUsagePercent != null ? Number(latestMetrics.gpuUsagePercent) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-accent" />
            <span className="font-bold text-lg">DatacenterMarket</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.name || "User"}</h1>
          <p className="text-lg text-muted-foreground">
            Monitor your infrastructure and manage your subscriptions
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {/* Monthly Spend */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-foreground">Monthly Spend</h3>
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-2">
              €{monthlySpend.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Across active subscriptions</p>
          </div>

          {/* Active Services */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-foreground">Active Services</h3>
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-2">{activeServices}</p>
            <p className="text-sm text-muted-foreground">Currently running</p>
          </div>

          {/* Total Orders */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-foreground">Total Orders</h3>
              <Layers className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-2">{orderList.length}</p>
            <p className="text-sm text-muted-foreground">All time</p>
          </div>

          {/* GPU Usage (live telemetry) */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-foreground">GPU Usage</h3>
              <Cpu className="w-5 h-5 text-accent" />
            </div>
            {gpuUsage != null ? (
              <>
                <p className="text-3xl font-bold text-foreground mb-2">{gpuUsage}%</p>
                <p className="text-sm text-muted-foreground">Live utilization</p>
                <div className="w-full bg-muted rounded-full h-2 mt-4">
                  <div
                    className="bg-accent h-2 rounded-full"
                    style={{ width: `${gpuUsage}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-muted-foreground mb-2">—</p>
                <p className="text-sm text-muted-foreground">Awaiting telemetry</p>
              </>
            )}
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-6 text-foreground">Active Infrastructure</h2>

          {orderList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Order ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Configuration</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Monthly Cost</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderList.map(order => {
                    const offer = offerById.get(order.offerId);
                    return (
                      <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-foreground">
                          ORD-{String(order.id).padStart(6, "0")}
                        </td>
                        <td className="py-3 px-4 text-foreground">
                          {offer ? `${offer.gpuCount}x ${offer.gpuType}` : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusBadgeClass(
                              order.status,
                            )}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          €{Number(order.monthlyRecurring).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No active infrastructure orders</p>
              <Button
                onClick={() => setLocation("/workload")}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Request Infrastructure
              </Button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Button
            onClick={() => setLocation("/workload")}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6"
          >
            Request More Infrastructure
          </Button>
          <Button variant="outline" className="font-semibold py-6">
            Download Invoice
          </Button>
          <Button variant="outline" className="font-semibold py-6">
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  );
}
