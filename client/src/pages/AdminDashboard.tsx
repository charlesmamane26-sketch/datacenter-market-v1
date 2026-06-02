import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BarChart3, Users, TrendingUp, DollarSign, LogOut } from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: leads } = trpc.leads.list.useQuery();
  const { data: stats } = trpc.admin.stats.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();
  const utils = trpc.useUtils();
  const updateLeadStatus = trpc.leads.update.useMutation({
    onSuccess: () => utils.leads.list.invalidate(),
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    logout();
    setLocation("/");
  };

  const metrics = {
    totalLeads: stats?.totalLeads ?? leads?.length ?? 0,
    conversionRate: stats?.conversionRate ?? 0,
    monthlyRevenue: stats?.monthlyRevenue ?? 0,
    avgDealSize: stats?.avgDealSize ?? 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "qualified":
        return "bg-yellow-100 text-yellow-800";
      case "offered":
        return "bg-purple-100 text-purple-800";
      case "converted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Check if user is admin
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
          <Button onClick={() => setLocation("/")} className="bg-accent hover:bg-accent/90">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-accent" />
            <span className="font-bold text-lg">DatacenterMarket Admin</span>
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
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Manage leads and track business metrics
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="tech-card">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Total Leads</h3>
              <Users className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold">{metrics.totalLeads}</p>
            <p className="text-sm text-muted-foreground mt-2">Active prospects</p>
          </div>

          <div className="tech-card">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Conversion Rate</h3>
              <TrendingUp className="w-5 h-5 text-lime-400" />
            </div>
            <p className="text-3xl font-bold">{metrics.conversionRate}%</p>
            <p className="text-sm text-muted-foreground mt-2">Last 30 days</p>
          </div>

          <div className="tech-card">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Monthly Revenue</h3>
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold">€{(metrics.monthlyRevenue / 1000).toFixed(0)}K</p>
            <p className="text-sm text-muted-foreground mt-2">Recurring revenue</p>
          </div>

          <div className="tech-card">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Avg Deal Size</h3>
              <BarChart3 className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold">€{metrics.avgDealSize.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-2">Per order</p>
          </div>
        </div>

        {/* Leads Table */}
        <div className="tech-card">
          <h2 className="text-2xl font-bold mb-6">Recent Leads</h2>

          {leads && leads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold">Company</th>
                    <th className="text-left py-3 px-4 font-semibold">Workload</th>
                    <th className="text-left py-3 px-4 font-semibold">Budget</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead: any) => (
                    <tr key={lead.id} className="border-b border-border hover:bg-card/50 transition-colors">
                      <td className="py-3 px-4 font-semibold">{lead.contactName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{lead.company || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground capitalize">
                        {lead.workloadType?.replace(/-/g, " ")}
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        €{lead.monthlyBudget ? Number(lead.monthlyBudget).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(lead.status || "new")}`}>
                          {lead.status || "new"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={lead.status || "new"}
                          disabled={updateLeadStatus.isPending}
                          onChange={(e) =>
                            updateLeadStatus.mutate({
                              id: lead.id,
                              status: e.target.value as
                                | "new"
                                | "qualified"
                                | "offered"
                                | "converted"
                                | "rejected",
                            })
                          }
                          className="rounded border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="new">new</option>
                          <option value="qualified">qualified</option>
                          <option value="offered">offered</option>
                          <option value="converted">converted</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No leads yet</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Button variant="outline" className="font-semibold py-6">
            Export Report
          </Button>
          <Button variant="outline" className="font-semibold py-6">
            Send Campaign
          </Button>
          <Button variant="outline" className="font-semibold py-6">
            View Analytics
          </Button>
        </div>
      </main>
    </div>
  );
}
