import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { downloadCsv } from "@/lib/downloadCsv";
import { Download, Loader2 } from "lucide-react";
import { fmtEUR } from "@/lib/format";
import {
  MarketChrome,
  PanelLabel,
  StatusPill,
  type StatusTone,
} from "@/components/market";
import { AdminOrdersPanel } from "@/components/admin/AdminOrdersPanel";
import { AdminInventoryPanel } from "@/components/admin/AdminInventoryPanel";

type LeadStatus = "new" | "qualified" | "offered" | "converted" | "rejected";

const LEAD_STATUS_META: Record<
  LeadStatus,
  { tone: StatusTone; label: string }
> = {
  new: { tone: "cyan", label: "NOUVEAU" },
  qualified: { tone: "amber", label: "QUALIFIÉ" },
  offered: { tone: "violet", label: "OFFRE" },
  converted: { tone: "lime", label: "CONVERTI" },
  rejected: { tone: "red", label: "REFUSÉ" },
};

const PIPELINE_ORDER: LeadStatus[] = [
  "new",
  "qualified",
  "offered",
  "converted",
  "rejected",
];

const PIPELINE_BG: Record<LeadStatus, string> = {
  new: "bg-chart-2",
  qualified: "bg-chart-5",
  offered: "bg-chart-3",
  converted: "bg-accent",
  rejected: "bg-destructive",
};

export default function AdminDashboard() {
  const {
    user,
    loading,
    error: authError,
    refresh: refreshAuth,
    logout,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const adminEnabled = !loading && user?.role === "admin";
  const leadsQuery = trpc.leads.list.useQuery(undefined, {
    enabled: adminEnabled,
  });
  const statsQuery = trpc.admin.stats.useQuery(undefined, {
    enabled: adminEnabled,
  });
  const leads = leadsQuery.data;
  const stats = statsQuery.data;
  const utils = trpc.useUtils();
  const updateLeadStatus = trpc.leads.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.leads.list.invalidate(),
        utils.admin.stats.invalidate(),
      ]);
    },
  });

  // Route guard: unauthenticated → login. Authenticated non-admins fall through
  // to the "Accès refusé" screen below. Server authz (adminProcedure) is the
  // real enforcement; this is the UX gate.
  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, user, setLocation]);

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await logout();
      setLocation("/");
    } catch {
      setLogoutError(
        "La déconnexion n'a pas abouti. Vous êtes toujours connecté ; vérifiez votre réseau puis réessayez."
      );
    }
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const exportLeads = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      downloadCsv(`leads-${today()}.csv`, leads ?? [], [
        { header: "ID", value: l => l.id },
        { header: "Company", value: l => l.company },
        { header: "Contact", value: l => l.contactName },
        { header: "Role", value: l => l.contactRole },
        { header: "Email", value: l => l.email },
        { header: "Workload", value: l => l.workloadType },
        { header: "GPU", value: l => l.gpuRequirement },
        { header: "Monthly budget", value: l => l.monthlyBudget },
        { header: "Duration", value: l => l.deploymentDuration },
        { header: "Constraints", value: l => l.infrastructureConstraints },
        { header: "Status", value: l => l.status },
        { header: "Created", value: l => l.createdAt },
      ]);
    } catch {
      setExportError("L'export des leads a échoué. Réessayez.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportOrders = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const orders = await utils.admin.exportOrders.fetch();
      downloadCsv(`orders-${today()}.csv`, orders ?? [], [
        { header: "ID", value: o => o.id },
        { header: "User ID", value: o => o.userId },
        { header: "Offer ID", value: o => o.offerId },
        { header: "Provider ID", value: o => o.providerId },
        { header: "Status", value: o => o.status },
        { header: "Payment status", value: o => o.paymentStatus },
        { header: "Total amount", value: o => o.totalAmount },
        { header: "Monthly recurring", value: o => o.monthlyRecurring },
        { header: "Created", value: o => o.createdAt },
      ]);
    } catch {
      setExportError("L'export des commandes a échoué. Réessayez.");
    } finally {
      setIsExporting(false);
    }
  };

  const metrics = {
    totalLeads: stats?.totalLeads ?? leads?.length ?? null,
    conversionRate: stats?.conversionRate ?? null,
    monthlyRevenue: stats?.monthlyRevenue ?? null,
    avgDealSize: stats?.avgDealSize ?? null,
  };

  const leadList = leads ?? [];
  const pipelineCounts = leads
    ? PIPELINE_ORDER.map(status => ({
        status,
        count: leadList.filter(l => (l.status ?? "new") === status).length,
      }))
    : [];
  const pipelineTotal = Math.max(1, leadList.length);

  if (!loading && authError && !user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <MarketChrome onBrandClick={() => setLocation("/")} />
        <div
          role="alert"
          className="flex flex-col items-center px-5 py-24 text-center"
        >
          <h1 className="mb-3 text-[30px] font-extrabold uppercase tracking-[-0.035em]">
            Session indisponible<span className="text-destructive">.</span>
          </h1>
          <p className="mb-6 max-w-[540px] text-muted-foreground">
            Impossible de vérifier votre session. Aucune donnée d'administration
            n'est affichée.
          </p>
          <button
            type="button"
            onClick={() => refreshAuth()}
            className="rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Auth still resolving, or redirecting an unauthenticated visitor to /login.
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  // Authenticated but not an admin.
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <MarketChrome onBrandClick={() => setLocation("/")} />
        <div className="flex flex-col items-center px-5 py-24 text-center">
          <h1 className="mb-3 text-[30px] font-extrabold uppercase tracking-[-0.035em]">
            Accès refusé<span className="text-destructive">.</span>
          </h1>
          <p className="mb-6 text-muted-foreground">
            Vous n'avez pas les droits pour accéder à cette page.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="glow-accent rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        right={
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-accent/40 px-[13px] py-1.5 font-mono text-[11px] font-semibold tracking-[.1em] text-accent">
              ADMIN
            </span>
            <span className="hidden font-mono text-[11.5px] tracking-[.06em] text-muted-foreground md:block">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="rounded-[7px] border border-border px-3.5 py-[7px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-card"
            >
              {loading ? "Déconnexion…" : "Déconnexion"}
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-9 md:px-10">
        {logoutError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {logoutError}
          </div>
        )}
        {exportError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {exportError}
          </div>
        )}

        <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[28px] font-extrabold uppercase leading-none tracking-[-0.03em] md:text-[36px]">
              Pilotage<span className="text-accent">.</span>
            </h1>
            <p className="m-0 text-[14.5px] text-muted-foreground">
              Pipeline, commandes, inventaire et provisionnement.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => void exportLeads()}
              disabled={isExporting || !leads || leads.length === 0}
              className="inline-flex items-center gap-2 rounded-[8px] border border-border px-4 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Leads CSV
            </button>
            <button
              onClick={() => void exportOrders()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-[8px] border border-border px-4 py-[9px] text-[13px] font-medium text-foreground transition-colors hover:bg-card"
            >
              <Download className="h-3.5 w-3.5" />
              Commandes CSV
            </button>
          </div>
        </div>

        {(leadsQuery.error || statsQuery.error) && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
            Certaines données d'administration n'ont pas pu être chargées :{" "}
            {leadsQuery.error?.message ?? statsQuery.error?.message}
          </div>
        )}

        {/* KPI cells */}
        <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              LEADS TOTAL
            </span>
            <span className="font-mono text-[26px] font-bold">
              {metrics.totalLeads ?? "—"}
            </span>
            <span className="text-[12px] text-muted-foreground">
              Prospects enregistrés
            </span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              TAUX DE CONVERSION
            </span>
            <span className="font-mono text-[26px] font-bold text-accent">
              {metrics.conversionRate == null
                ? "—"
                : `${metrics.conversionRate} %`}
            </span>
            <span className="text-[12px] text-muted-foreground">
              Historique complet
            </span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              REVENU MENSUEL
            </span>
            <span className="font-mono text-[26px] font-bold">
              {metrics.monthlyRevenue == null
                ? "—"
                : fmtEUR(metrics.monthlyRevenue)}
            </span>
            <span className="text-[12px] text-muted-foreground">Récurrent</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card p-[22px]">
            <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              PANIER MOYEN
            </span>
            <span className="font-mono text-[26px] font-bold">
              {metrics.avgDealSize == null
                ? "—"
                : fmtEUR(metrics.avgDealSize)}
            </span>
            <span className="text-[12px] text-muted-foreground">
              Par commande
            </span>
          </div>
        </div>

        {/* Pipeline */}
        <div className="mb-6 rounded-xl border border-border bg-card p-[22px]">
          <PanelLabel className="mb-4">Pipeline</PanelLabel>
          {leadsQuery.isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Chargement du pipeline…
            </p>
          ) : leadsQuery.error || !leads ? (
            <p role="alert" className="text-sm text-destructive">
              Pipeline indisponible. Réessayez lorsque la connexion est rétablie.
            </p>
          ) : (
            <>
              <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-input">
                {pipelineCounts.map(
                  ({ status, count }) =>
                    count > 0 && (
                      <div
                        key={status}
                        className={PIPELINE_BG[status]}
                        style={{ width: `${(count / pipelineTotal) * 100}%` }}
                      />
                    )
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {pipelineCounts.map(({ status, count }) => (
                  <span key={status} className="inline-flex items-center gap-2">
                    <StatusPill
                      tone={LEAD_STATUS_META[status].tone}
                      label={LEAD_STATUS_META[status].label}
                    />
                    <span className="font-mono text-[11.5px] text-muted-foreground">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Leads table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr_0.9fr_1fr_1fr] items-center gap-4 border-b border-border bg-sidebar px-[22px] py-3 font-mono text-[10.5px] font-medium tracking-[.1em] text-muted-foreground">
              <span>CONTACT</span>
              <span>SOCIÉTÉ</span>
              <span>WORKLOAD</span>
              <span className="text-right">BUDGET</span>
              <span>STATUT</span>
              <span>ACTION</span>
            </div>
            {leadsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement des
                leads…
              </div>
            ) : leadsQuery.error ? (
              <div role="alert" className="py-12 text-center text-destructive">
                Les leads n'ont pas pu être chargés. Réessayez lorsque la
                connexion est rétablie.
              </div>
            ) : leadList.length > 0 ? (
              leadList.map((lead, i) => {
                const status = (lead.status ?? "new") as LeadStatus;
                const meta = LEAD_STATUS_META[status] ?? LEAD_STATUS_META.new;
                return (
                  <div
                    key={lead.id}
                    className={`grid grid-cols-[1.2fr_1.2fr_1.2fr_0.9fr_1fr_1fr] items-center gap-4 px-[22px] py-3.5 transition-colors hover:bg-card/50 ${
                      i < leadList.length - 1 ? "border-b border-border/70" : ""
                    }`}
                  >
                    <span className="truncate text-[13.5px] font-semibold">
                      {lead.contactName}
                    </span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {lead.company || "—"}
                    </span>
                    <span className="truncate text-[13px] capitalize text-muted-foreground">
                      {lead.workloadType?.replace(/-/g, " ") ?? "—"}
                    </span>
                    <span className="text-right font-mono text-[13px] font-semibold">
                      {lead.monthlyBudget
                        ? fmtEUR(Number(lead.monthlyBudget))
                        : "—"}
                    </span>
                    <StatusPill tone={meta.tone} label={meta.label} />
                    {status === "converted" ? (
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        AUTOMATIQUE · PAIEMENT
                      </span>
                    ) : (
                      <select
                        value={status}
                        disabled={updateLeadStatus.isPending}
                        onChange={e =>
                          updateLeadStatus.mutate({
                            id: lead.id,
                            status: e.target.value as Exclude<
                              LeadStatus,
                              "converted"
                            >,
                          })
                        }
                        className="rounded-[7px] border border-border bg-input px-2 py-1.5 font-mono text-[11px] text-foreground outline-none transition-colors focus:border-accent/50"
                      >
                        <option value="new">nouveau</option>
                        <option value="qualified">qualifié</option>
                        <option value="offered">offre</option>
                        <option value="rejected">refusé</option>
                      </select>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                Aucun lead pour l'instant
              </div>
            )}
          </div>
        </div>

        <AdminOrdersPanel enabled={user.role === "admin"} />
        <AdminInventoryPanel enabled={user.role === "admin"} />
      </main>
    </div>
  );
}
