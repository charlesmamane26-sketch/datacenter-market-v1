import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { fmtEUR } from "@/lib/format";
import { saveWorkloadRecap } from "@/lib/workloadRecap";
import { saveLeadClaim } from "@/lib/leadClaim";
import {
  JourneyStepper,
  MarketChrome,
  MarketOpenChip,
} from "@/components/market";
import {
  CONSENT_POLICY_UPDATED_AT_FR,
  CONSENT_POLICY_VERSION,
} from "@shared/const";

type FormStep = "workload" | "requirements" | "constraints" | "contact";

interface FormData {
  workloadType: string;
  gpuRequirement: string;
  monthlyBudget: string;
  deploymentDuration: string;
  infrastructureConstraints: string;
  email: string;
  contactName: string;
  company: string;
  contactRole: string;
}

const WORKLOAD_TYPES = [
  {
    value: "llm-training",
    label: "Entraînement LLM",
    tag: "MULTI-GPU · NVLINK",
  },
  { value: "inference", label: "Inférence", tag: "HAUT DÉBIT · SERVING" },
  {
    value: "data-processing",
    label: "Traitement de données",
    tag: "ETL · BATCH",
  },
  {
    value: "computer-vision",
    label: "Vision par ordinateur",
    tag: "CV · TEMPS RÉEL",
  },
  { value: "research", label: "R&D", tag: "EXPLORATION · FLEXIBLE" },
  { value: "other", label: "Autre", tag: "À PRÉCISER" },
];

const GPU_OPTIONS = [
  { value: "h100", label: "NVIDIA H100" },
  { value: "a100", label: "NVIDIA A100" },
  { value: "rtx4090", label: "RTX 4090" },
  { value: "l40s", label: "L40S" },
  { value: "any", label: "Peu importe" },
];

const BUDGET_OPTIONS = [
  { value: "10000", label: "≤ 10 000 €" },
  { value: "25000", label: "≤ 25 000 €" },
  { value: "50000", label: "≤ 50 000 €" },
  { value: "100000", label: "100 000 € +" },
];

const DURATION_OPTIONS = [
  { value: "1-month", label: "1 mois" },
  { value: "3-months", label: "3 mois" },
  { value: "6-months", label: "6 mois" },
  { value: "12-months", label: "12 mois +" },
];

const STEP_TITLES: Record<
  FormStep,
  { title: string; sub: string; label: string; next: string }
> = {
  workload: {
    title: "Votre workload",
    sub: "Décrivez ce que vous voulez exécuter — nous trouvons l'infrastructure.",
    label: "ÉTAPE 1/4 — WORKLOAD",
    next: "SUIVANT : BUDGET & DURÉE",
  },
  requirements: {
    title: "Budget & durée",
    sub: "Calibrez l'offre : enveloppe mensuelle et durée d'engagement.",
    label: "ÉTAPE 2/4 — BUDGET & DURÉE",
    next: "SUIVANT : CONTRAINTES",
  },
  constraints: {
    title: "Vos contraintes",
    sub: "RGPD, région, disponibilité : tout ce qui doit être respecté.",
    label: "ÉTAPE 3/4 — CONTRAINTES",
    next: "SUIVANT : CONTACT",
  },
  contact: {
    title: "Vos coordonnées",
    sub: "Où envoyer les options disponibles pour votre demande ?",
    label: "ÉTAPE 4/4 — CONTACT",
    next: "DERNIÈRE ÉTAPE",
  },
};

/** Selectable card / chip styles (selection = lime border + lime/7 background). */
const cardBase =
  "flex cursor-pointer flex-col gap-1.5 rounded-[9px] border p-3.5 text-left transition-colors duration-150";
const cardIdle = "border-border bg-input/40 hover:border-accent/40";
const cardSelected = "border-accent bg-accent/7";
const chipBase =
  "cursor-pointer rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors duration-150 min-h-[40px]";
const chipIdle =
  "border-border bg-input/40 text-foreground hover:border-accent/40";
const chipSelected = "border-accent bg-accent text-accent-foreground";
const inputClass =
  "rounded-lg border border-border bg-input px-3.5 py-3 text-[14px] text-foreground outline-none transition-colors focus:border-accent/50";

export default function WorkloadForm() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<FormStep>("workload");
  const [formData, setFormData] = useState<FormData>({
    workloadType: "",
    gpuRequirement: "",
    monthlyBudget: "",
    deploymentDuration: "",
    infrastructureConstraints: "",
    email: "",
    contactName: "",
    company: "",
    contactRole: "",
  });

  const createLeadMutation = trpc.leads.create.useMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitRequiresReload, setSubmitRequiresReload] = useState(false);
  const [consent, setConsent] = useState(false);

  // "Aperçu du marché": matching pool derived client-side from the public catalogue.
  const { data: catalogue, isError: catalogueError } =
    trpc.offers.list.useQuery();

  const steps: FormStep[] = [
    "workload",
    "requirements",
    "constraints",
    "contact",
  ];
  const currentStepIndex = steps.indexOf(currentStep);
  const meta = STEP_TITLES[currentStep];

  const set = (field: keyof FormData, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1)
      setCurrentStep(steps[currentStepIndex + 1]);
  };
  const handlePrev = () => {
    if (currentStepIndex > 0) setCurrentStep(steps[currentStepIndex - 1]);
  };

  const matchingPool = (catalogue ?? []).filter(o => {
    if (formData.gpuRequirement && formData.gpuRequirement !== "any") {
      const key = formData.gpuRequirement.replace(/\s+/g, "").toLowerCase();
      if (!o.gpuType.replace(/\s+/g, "").toLowerCase().includes(key))
        return false;
    }
    if (
      formData.monthlyBudget &&
      Number(o.monthlyPrice) > Number(formData.monthlyBudget)
    ) {
      return false;
    }
    return true;
  });
  const poolPrices = matchingPool.map(o => Number(o.monthlyPrice));
  const poolRange =
    poolPrices.length > 0
      ? `${fmtEUR(Math.min(...poolPrices))} — ${fmtEUR(Math.max(...poolPrices))}/MOIS HT`
      : "AFFINEZ POUR VOIR LA FOURCHETTE";

  const labelOf = (
    options: { value: string; label: string }[],
    value: string
  ) => options.find(o => o.value === value)?.label ?? "—";

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitRequiresReload(false);
    setIsSubmitting(true);
    try {
      const lead = await createLeadMutation.mutateAsync({
        email: formData.email.trim(),
        company: formData.company.trim() || undefined,
        contactName: formData.contactName.trim(),
        contactRole: formData.contactRole.trim() || undefined,
        workloadType: formData.workloadType,
        gpuRequirement: formData.gpuRequirement,
        monthlyBudget: formData.monthlyBudget
          ? parseFloat(formData.monthlyBudget)
          : undefined,
        deploymentDuration: formData.deploymentDuration,
        infrastructureConstraints: formData.infrastructureConstraints,
        // Required server-side (RGPD); the submit button is gated on `consent`.
        consent: true,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
      });

      // Stash the claim token so this browser can order against / match on the
      // anonymous lead it just created (a lead ID alone is not enough server-side).
      if (lead?.id && lead.claimToken) {
        saveLeadClaim(lead.id, lead.claimToken);
      }

      // Summary chips for the results screen (leads have no public read).
      if (lead?.id) {
        saveWorkloadRecap(lead.id, {
          chips: [
            formData.gpuRequirement && formData.gpuRequirement !== "any"
              ? `GPU ${labelOf(GPU_OPTIONS, formData.gpuRequirement).toUpperCase()}`
              : "GPU AU CHOIX",
            labelOf(WORKLOAD_TYPES, formData.workloadType).toUpperCase(),
            "CATALOGUE UE",
            formData.monthlyBudget
              ? `BUDGET ${labelOf(BUDGET_OPTIONS, formData.monthlyBudget).toUpperCase()}/MOIS`
              : "BUDGET LIBRE",
          ],
          requestedDuration: labelOf(
            DURATION_OPTIONS,
            formData.deploymentDuration
          ),
        });
      }

      // Carry the lead id through the funnel so results are matched to this workload.
      setLocation(lead?.id ? `/processing?leadId=${lead.id}` : "/processing");
    } catch (error) {
      console.error("Error submitting form:", error);
      const serializedError = (() => {
        try {
          return JSON.stringify(error);
        } catch {
          return String(error);
        }
      })();
      const stalePolicy =
        serializedError.includes("consentPolicyVersion") ||
        serializedError.includes(CONSENT_POLICY_VERSION);
      setSubmitRequiresReload(stalePolicy);
      setSubmitError(
        stalePolicy
          ? "La politique de confidentialité a changé depuis l'ouverture de cette page. Rechargez-la avant de confirmer votre consentement."
          : "Votre demande n'a pas pu être envoyée. Vérifiez les informations saisies et votre connexion, puis réessayez."
      );
      setIsSubmitting(false);
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case "workload":
        return formData.workloadType !== "" && formData.gpuRequirement !== "";
      case "requirements":
        return (
          formData.monthlyBudget !== "" && formData.deploymentDuration !== ""
        );
      case "constraints":
        return true; // Optional step
      case "contact":
        return (
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) &&
          formData.contactName.trim() !== "" &&
          consent
        );
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketChrome
        onBrandClick={() => setLocation("/")}
        center={<JourneyStepper current={1} />}
        right={<MarketOpenChip bordered={false} />}
      />

      <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-9 md:px-10">
        <button
          onClick={() => setLocation("/")}
          className="mb-5 inline-flex items-center gap-[7px] text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ‹ Retour à l'accueil
        </button>

        <div className="mb-[26px] flex flex-col gap-2.5">
          <h1 className="m-0 text-[32px] font-extrabold uppercase leading-none tracking-[-0.035em] md:text-[40px]">
            {meta.title}
            <span className="text-accent">.</span>
          </h1>
          <p className="m-0 text-[15.5px] text-muted-foreground">{meta.sub}</p>
        </div>

        {/* Segmented progress bar (4 segments) */}
        <div className="mb-[26px] flex flex-col gap-[9px]">
          <div className="flex justify-between font-mono text-[11px] tracking-[.1em] text-muted-foreground">
            <span className="text-accent">{meta.label}</span>
            <span className="hidden md:block">{meta.next}</span>
          </div>
          <div
            className="grid grid-cols-4 gap-1.5"
            role="progressbar"
            aria-label="Progression de la demande"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={currentStepIndex + 1}
          >
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-colors duration-200 ${
                  i <= currentStepIndex ? "bg-accent" : "bg-input"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="grid items-start gap-6 md:grid-cols-[1.6fr_1fr]">
          {/* Form card */}
          <div className="flex flex-col gap-[26px] rounded-xl border border-border bg-card p-5 md:p-7">
            {currentStep === "workload" && (
              <div className="flex flex-col gap-[26px]">
                <div className="flex flex-col gap-3.5">
                  <span className="text-[15px] font-semibold">
                    Type de workload
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {WORKLOAD_TYPES.map(w => {
                      const selected = formData.workloadType === w.value;
                      return (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => set("workloadType", w.value)}
                          aria-pressed={selected}
                          className={`${cardBase} ${selected ? cardSelected : cardIdle}`}
                        >
                          <span className="flex items-center justify-between text-[14px] font-semibold">
                            {w.label}
                            {selected && (
                              <span className="font-bold text-accent">✓</span>
                            )}
                          </span>
                          <span className="font-mono text-[10.5px] tracking-[.06em] text-muted-foreground">
                            {w.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-3.5">
                  <span className="text-[15px] font-semibold">GPU préféré</span>
                  <div className="flex flex-wrap gap-2.5">
                    {GPU_OPTIONS.map(g => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => set("gpuRequirement", g.value)}
                        aria-pressed={formData.gpuRequirement === g.value}
                        className={`${chipBase} ${
                          formData.gpuRequirement === g.value
                            ? chipSelected
                            : chipIdle
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === "requirements" && (
              <div className="flex flex-col gap-[26px]">
                <div className="flex flex-col gap-3.5">
                  <span className="text-[15px] font-semibold">
                    Budget mensuel
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {BUDGET_OPTIONS.map(b => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => set("monthlyBudget", b.value)}
                        aria-pressed={formData.monthlyBudget === b.value}
                        className={`${chipBase} ${
                          formData.monthlyBudget === b.value
                            ? chipSelected
                            : chipIdle
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3.5">
                  <span className="text-[15px] font-semibold">
                    Durée d'engagement demandée
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {DURATION_OPTIONS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => set("deploymentDuration", d.value)}
                        aria-pressed={formData.deploymentDuration === d.value}
                        className={`${chipBase} ${
                          formData.deploymentDuration === d.value
                            ? chipSelected
                            : chipIdle
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === "constraints" && (
              <div className="flex flex-col gap-2.5">
                <label
                  htmlFor="infrastructureConstraints"
                  className="text-[15px] font-semibold"
                >
                  Contraintes d'infrastructure{" "}
                  <span className="font-normal text-muted-foreground">
                    (optionnel)
                  </span>
                </label>
                <textarea
                  id="infrastructureConstraints"
                  placeholder="ex. : UE uniquement, RGPD, haute disponibilité, bare metal…"
                  value={formData.infrastructureConstraints}
                  onChange={e =>
                    set("infrastructureConstraints", e.target.value)
                  }
                  className={`${inputClass} min-h-[130px] resize-y font-sans`}
                />
                <span className="text-[12.5px] text-muted-foreground">
                  Ces exigences sont transmises avec votre demande. Le
                  classement automatique utilise le GPU et le budget
                  sélectionnés.
                </span>
              </div>
            )}

            {currentStep === "contact" && (
              <div className="flex flex-col gap-5">
                <div className="grid gap-[18px] md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="email"
                      className="text-[13.5px] font-semibold"
                    >
                      Adresse e-mail <span className="text-accent">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="vous@societe.com"
                      value={formData.email}
                      onChange={e => set("email", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="contactName"
                      className="text-[13.5px] font-semibold"
                    >
                      Nom complet <span className="text-accent">*</span>
                    </label>
                    <input
                      id="contactName"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Prénom Nom"
                      value={formData.contactName}
                      onChange={e => set("contactName", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="company"
                      className="text-[13.5px] font-semibold"
                    >
                      Société{" "}
                      <span className="font-normal text-muted-foreground">
                        (optionnel)
                      </span>
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      placeholder="Votre société"
                      value={formData.company}
                      onChange={e => set("company", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="contactRole"
                      className="text-[13.5px] font-semibold"
                    >
                      Votre rôle{" "}
                      <span className="font-normal text-muted-foreground">
                        (optionnel)
                      </span>
                    </label>
                    <input
                      id="contactRole"
                      name="organization-title"
                      type="text"
                      autoComplete="organization-title"
                      placeholder="ex. : ML Engineer"
                      value={formData.contactRole}
                      onChange={e => set("contactRole", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <label
                  htmlFor="privacy-consent"
                  className="flex cursor-pointer items-start gap-[11px] border-t border-border/70 pt-[18px]"
                >
                  <input
                    id="privacy-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-[13px] leading-[1.55] text-muted-foreground">
                    J'accepte que mes données soient traitées par Anavim
                    Advisory pour répondre à ma demande, conformément à la{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      politique de confidentialité du{" "}
                      {CONSENT_POLICY_UPDATED_AT_FR}
                    </a>
                    {" "}
                    (version {CONSENT_POLICY_VERSION}). Elle s'ouvre dans un nouvel onglet afin de
                    conserver ce formulaire.
                  </span>
                </label>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="m-0 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <p>{submitError}</p>
                {submitRequiresReload && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-3 rounded-[7px] border border-destructive/40 px-3 py-2 font-semibold"
                  >
                    Recharger la page
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3.5">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className="flex items-center justify-center rounded-[9px] border border-border px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-input disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Précédent
              </button>
              {currentStepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  className="glow-accent flex flex-1 items-center justify-center rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Suivant →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isStepValid() || isSubmitting}
                  className="glow-accent flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-accent px-5 py-3 text-[14px] font-semibold text-accent-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours…
                    </>
                  ) : (
                    "Envoyer & obtenir mes offres →"
                  )}
                </button>
              )}
            </div>
          </div>

          {/* "Votre demande" side panel */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface-sunken">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-[13px]">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[.14em] text-accent">
                Votre demande
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-live-dot" />
            </div>
            <div className="flex flex-col gap-3.5 p-5 font-mono text-[12.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">TYPE</span>
                <span className="text-right text-foreground">
                  {labelOf(WORKLOAD_TYPES, formData.workloadType)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">GPU</span>
                <span className="text-right text-foreground">
                  {labelOf(GPU_OPTIONS, formData.gpuRequirement)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">BUDGET</span>
                <span className="text-right text-foreground">
                  {labelOf(BUDGET_OPTIONS, formData.monthlyBudget)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">DURÉE</span>
                <span className="text-right text-foreground">
                  {labelOf(DURATION_OPTIONS, formData.deploymentDuration)}
                </span>
              </div>
              <div className="flex flex-col gap-[5px] border-t border-border/70 pt-3.5">
                <span className="text-[22px] font-bold text-accent">
                  {catalogueError ? "—" : matchingPool.length}{" "}
                  <span className="text-[12px] font-medium text-muted-foreground">
                    options du catalogue
                  </span>
                </span>
                <span className="text-[10.5px] tracking-[.08em] text-muted-foreground">
                  {poolRange}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
