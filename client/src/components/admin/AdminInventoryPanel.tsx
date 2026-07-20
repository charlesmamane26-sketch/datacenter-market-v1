import { useEffect, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PanelLabel, StatusPill, type StatusTone } from "@/components/market";

type AvailabilityStatus = "available" | "limited" | "unavailable" | "maintenance";

const AVAILABILITY_META: Record<AvailabilityStatus, { label: string; tone: StatusTone }> = {
  available: { label: "DISPONIBLE", tone: "lime" },
  limited: { label: "CAPACITÉ LIMITÉE", tone: "amber" },
  unavailable: { label: "INDISPONIBLE", tone: "red" },
  maintenance: { label: "MAINTENANCE", tone: "violet" },
};

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toLocalDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type InventoryOffer = {
  id: number;
  name: string;
  gpuType: string;
  gpuCount: number;
  location: string;
  providerId: number | null;
  isActive: boolean;
  availabilityStatus: AvailabilityStatus;
  availableCapacity: number;
  inventoryVersion: number;
  availabilityExpiresAt: Date | string | null;
  availabilityIsStale: boolean;
  isSellable: boolean;
  provider?: { id: number; name: string; isActive: boolean } | null;
};

function InventoryOfferRow({
  offer,
  providers,
}: {
  offer: InventoryOffer;
  providers: Array<{ id: number; name: string; isActive: boolean }>;
}) {
  const utils = trpc.useUtils();
  const [providerId, setProviderId] = useState(offer.providerId == null ? "" : String(offer.providerId));
  const [isActive, setIsActive] = useState(offer.isActive);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(
    offer.availabilityStatus,
  );
  const [availableCapacity, setAvailableCapacity] = useState(String(offer.availableCapacity));
  const [availabilityExpiresAt, setAvailabilityExpiresAt] = useState(
    toLocalDateTime(offer.availabilityExpiresAt),
  );

  useEffect(() => {
    setProviderId(offer.providerId == null ? "" : String(offer.providerId));
    setIsActive(offer.isActive);
    setAvailabilityStatus(offer.availabilityStatus);
    setAvailableCapacity(String(offer.availableCapacity));
    setAvailabilityExpiresAt(toLocalDateTime(offer.availabilityExpiresAt));
  }, [offer]);

  const updateOffer = trpc.inventory.updateOffer.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.inventory.listOffers.invalidate(),
        utils.offers.list.invalidate(),
        utils.offers.match.invalidate(),
      ]);
    },
    onError: () => utils.inventory.listOffers.invalidate(),
  });

  const save = () => {
    const parsedCapacity = Number(availableCapacity);
    updateOffer.mutate({
      id: offer.id,
      expectedVersion: offer.inventoryVersion,
      providerId: providerId ? Number(providerId) : null,
      isActive,
      availabilityStatus,
      availableCapacity: Number.isFinite(parsedCapacity) ? Math.max(0, Math.round(parsedCapacity)) : 0,
      availabilityExpiresAt: availabilityExpiresAt ? new Date(availabilityExpiresAt) : null,
    });
  };

  const meta = AVAILABILITY_META[offer.availabilityStatus] ?? AVAILABILITY_META.unavailable;

  return (
    <div className="border-b border-border/70 px-[22px] py-4 last:border-b-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">{offer.name}</span>
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {offer.gpuCount}× {offer.gpuType} · {offer.location}
          </span>
          <StatusPill tone={meta.tone} label={meta.label} />
          {offer.availabilityIsStale && <StatusPill tone="amber" label="DONNÉE EXPIRÉE" />}
          {!offer.isSellable && <StatusPill tone="red" label="HORS CATALOGUE" />}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">OFFRE #{offer.id}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.9fr_0.65fr_1.15fr_auto_auto]">
        <label className="flex flex-col gap-1 text-[10.5px] text-muted-foreground">
          FOURNISSEUR
          <select
            value={providerId}
            onChange={event => setProviderId(event.target.value)}
            className="rounded-[7px] border border-border bg-input px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
          >
            <option value="">Non affecté</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}{provider.isActive ? "" : " (inactif)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] text-muted-foreground">
          DISPONIBILITÉ
          <select
            value={availabilityStatus}
            onChange={event => setAvailabilityStatus(event.target.value as AvailabilityStatus)}
            className="rounded-[7px] border border-border bg-input px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
          >
            <option value="available">disponible</option>
            <option value="limited">limitée</option>
            <option value="unavailable">indisponible</option>
            <option value="maintenance">maintenance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] text-muted-foreground">
          CAPACITÉ DÉCLARÉE
          <input
            type="number"
            min={0}
            max={1_000_000}
            value={availableCapacity}
            onChange={event => setAvailableCapacity(event.target.value)}
            className="rounded-[7px] border border-border bg-input px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] text-muted-foreground">
          VALIDE JUSQU'AU
          <input
            type="datetime-local"
            min={toLocalDateTime(new Date(Date.now() + 60_000))}
            max={toLocalDateTime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000))}
            value={availabilityExpiresAt}
            onChange={event => setAvailabilityExpiresAt(event.target.value)}
            className="rounded-[7px] border border-border bg-input px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={event => setIsActive(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Publiée
        </label>
        <button
          type="button"
          onClick={save}
          disabled={updateOffer.isPending}
          className="mt-auto inline-flex h-[37px] items-center justify-center gap-2 rounded-[7px] bg-accent px-3.5 text-[12px] font-semibold text-accent-foreground disabled:opacity-50"
        >
          {updateOffer.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Enregistrer
        </button>
      </div>
      {updateOffer.error && (
        <p className="mt-2 text-[11.5px] text-destructive">{updateOffer.error.message}</p>
      )}
    </div>
  );
}

export function AdminInventoryPanel({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const providersQuery = trpc.inventory.listProviders.useQuery(undefined, { enabled });
  const offersQuery = trpc.inventory.listOffers.useQuery(undefined, { enabled });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");

  const createProvider = trpc.inventory.createProvider.useMutation({
    onSuccess: async () => {
      setName("");
      setSlug("");
      setSlugEdited(false);
      setContactEmail("");
      setWebsite("");
      await utils.inventory.listProviders.invalidate();
    },
  });
  const updateProvider = trpc.inventory.updateProvider.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.inventory.listProviders.invalidate(),
        utils.inventory.listOffers.invalidate(),
        utils.offers.list.invalidate(),
        utils.offers.match.invalidate(),
      ]);
    },
  });

  const providers = providersQuery.data ?? [];
  const offers = (offersQuery.data ?? []) as InventoryOffer[];
  const loading = providersQuery.isLoading || offersQuery.isLoading;
  const queryError = providersQuery.error ?? offersQuery.error;

  const changeName = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(makeSlug(value));
  };

  const submitProvider = () => {
    createProvider.mutate({
      name: name.trim(),
      slug: slug.trim(),
      contactEmail: contactEmail.trim() || null,
      website: website.trim() || null,
    });
  };

  return (
    <section className="mt-8 rounded-xl border border-border bg-card">
      <div className="border-b border-border px-[22px] py-5">
        <PanelLabel>Inventaire fournisseur</PanelLabel>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Activation explicite requise : fournisseur actif, capacité positive et échéance future de fraîcheur.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l'inventaire…
        </div>
      ) : queryError ? (
        <div className="px-[22px] py-10 text-center text-[13px] text-destructive">
          Impossible de charger l'inventaire : {queryError.message}
        </div>
      ) : (
        <>
          <div className="grid gap-5 border-b border-border px-[22px] py-5 lg:grid-cols-[1fr_1.35fr]">
            <div>
              <PanelLabel className="mb-3">Fournisseurs</PanelLabel>
              <div className="space-y-2">
                {providers.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">Aucun fournisseur enregistré.</p>
                ) : (
                  providers.map(provider => (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-sidebar px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{provider.name}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          {provider.slug}{provider.contactEmail ? ` · ${provider.contactEmail}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateProvider.mutate({ id: provider.id, isActive: !provider.isActive })
                        }
                        disabled={updateProvider.isPending}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5"
                      >
                        <StatusPill
                          tone={provider.isActive ? "lime" : "muted"}
                          label={provider.isActive ? "ACTIF" : "INACTIF"}
                        />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <PanelLabel className="mb-3">Ajouter un fournisseur</PanelLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={event => changeName(event.target.value)}
                  placeholder="Nom du fournisseur"
                  className="rounded-[7px] border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
                />
                <input
                  value={slug}
                  onChange={event => {
                    setSlug(makeSlug(event.target.value));
                    setSlugEdited(true);
                  }}
                  placeholder="identifiant-technique"
                  className="rounded-[7px] border border-border bg-input px-3 py-2 font-mono text-[12px] text-foreground outline-none focus:border-accent/50"
                />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={event => setContactEmail(event.target.value)}
                  placeholder="Contact opérationnel (optionnel)"
                  className="rounded-[7px] border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
                />
                <input
                  type="url"
                  value={website}
                  onChange={event => setWebsite(event.target.value)}
                  placeholder="https://fournisseur.example"
                  className="rounded-[7px] border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent/50"
                />
              </div>
              <button
                type="button"
                onClick={submitProvider}
                disabled={createProvider.isPending || name.trim().length < 2 || slug.length < 2}
                className="mt-3 inline-flex items-center gap-2 rounded-[7px] bg-accent px-4 py-2 text-[12px] font-semibold text-accent-foreground disabled:opacity-50"
              >
                {createProvider.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Ajouter
              </button>
              {(createProvider.error || updateProvider.error) && (
                <p className="mt-2 text-[11.5px] text-destructive">
                  {createProvider.error?.message ?? updateProvider.error?.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="border-b border-border bg-sidebar px-[22px] py-3 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground">
              OFFRES · {offers.length}
            </div>
            {offers.length === 0 ? (
              <div className="px-[22px] py-10 text-center text-muted-foreground">
                Aucune offre dans le catalogue
              </div>
            ) : (
              offers.map(offer => (
                <InventoryOfferRow
                  key={offer.id}
                  offer={offer}
                  providers={providers}
                />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
