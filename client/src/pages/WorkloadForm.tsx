import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

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
  const [consent, setConsent] = useState(false);

  const steps: FormStep[] = ["workload", "requirements", "constraints", "contact"];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const lead = await createLeadMutation.mutateAsync({
        email: formData.email,
        company: formData.company,
        contactName: formData.contactName,
        contactRole: formData.contactRole,
        workloadType: formData.workloadType,
        gpuRequirement: formData.gpuRequirement,
        monthlyBudget: formData.monthlyBudget ? parseFloat(formData.monthlyBudget) : undefined,
        deploymentDuration: formData.deploymentDuration,
        infrastructureConstraints: formData.infrastructureConstraints,
      });

      // Carry the lead id through the funnel so results are matched to this workload.
      setLocation(lead?.id ? `/processing?leadId=${lead.id}` : "/processing");
    } catch (error) {
      console.error("Error submitting form:", error);
      setIsSubmitting(false);
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case "workload":
        return formData.workloadType !== "" && formData.gpuRequirement !== "";
      case "requirements":
        return formData.monthlyBudget !== "" && formData.deploymentDuration !== "";
      case "constraints":
        return true; // Optional step
      case "contact":
        return formData.email !== "" && formData.contactName !== "" && consent;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="container max-w-2xl">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </button>

          <h1 className="text-4xl font-bold mb-4">Tell us about your workload</h1>
          <p className="text-lg text-muted-foreground">
            We'll find the perfect infrastructure match for your needs.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between text-sm text-muted-foreground mb-3">
            <span>Step {currentStepIndex + 1} of {steps.length}</span>
            <span className="capitalize">{currentStep.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Content */}
        <div className="tech-card mb-8">
          {/* Step 1: Workload Type */}
          {currentStep === "workload" && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="workloadType" className="text-base font-semibold mb-2 block">
                  What type of workload do you need?
                </Label>
                <Select value={formData.workloadType} onValueChange={(value) => handleInputChange("workloadType", value)}>
                  <SelectTrigger className="tech-input">
                    <SelectValue placeholder="Select workload type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm-training">LLM Training</SelectItem>
                    <SelectItem value="inference">Inference</SelectItem>
                    <SelectItem value="data-processing">Data Processing</SelectItem>
                    <SelectItem value="computer-vision">Computer Vision</SelectItem>
                    <SelectItem value="research">Research & Development</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="gpuRequirement" className="text-base font-semibold mb-2 block">
                  Preferred GPU type
                </Label>
                <Select value={formData.gpuRequirement} onValueChange={(value) => handleInputChange("gpuRequirement", value)}>
                  <SelectTrigger className="tech-input">
                    <SelectValue placeholder="Select GPU type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h100">NVIDIA H100</SelectItem>
                    <SelectItem value="a100">NVIDIA A100</SelectItem>
                    <SelectItem value="rtx4090">NVIDIA RTX 4090</SelectItem>
                    <SelectItem value="l40s">NVIDIA L40S</SelectItem>
                    <SelectItem value="any">Any (Recommend for me)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Requirements */}
          {currentStep === "requirements" && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="monthlyBudget" className="text-base font-semibold mb-2 block">
                  Monthly budget (€)
                </Label>
                <Input
                  id="monthlyBudget"
                  type="number"
                  placeholder="e.g., 5000"
                  value={formData.monthlyBudget}
                  onChange={(e) => handleInputChange("monthlyBudget", e.target.value)}
                  className="tech-input"
                />
              </div>

              <div>
                <Label htmlFor="deploymentDuration" className="text-base font-semibold mb-2 block">
                  How long do you need the infrastructure?
                </Label>
                <Select value={formData.deploymentDuration} onValueChange={(value) => handleInputChange("deploymentDuration", value)}>
                  <SelectTrigger className="tech-input">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-week">1 week</SelectItem>
                    <SelectItem value="1-month">1 month</SelectItem>
                    <SelectItem value="3-months">3 months</SelectItem>
                    <SelectItem value="6-months">6 months</SelectItem>
                    <SelectItem value="12-months">12 months</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Constraints */}
          {currentStep === "constraints" && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="constraints" className="text-base font-semibold mb-2 block">
                  Infrastructure constraints (optional)
                </Label>
                <Textarea
                  id="constraints"
                  placeholder="e.g., EU only, GDPR compliant, High availability required, Bare metal only..."
                  value={formData.infrastructureConstraints}
                  onChange={(e) => handleInputChange("infrastructureConstraints", e.target.value)}
                  className="tech-input min-h-32"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Tell us about any specific requirements or constraints for your infrastructure.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Contact */}
          {currentStep === "contact" && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="email" className="text-base font-semibold mb-2 block">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@company.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="tech-input"
                />
              </div>

              <div>
                <Label htmlFor="contactName" className="text-base font-semibold mb-2 block">
                  Full name
                </Label>
                <Input
                  id="contactName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange("contactName", e.target.value)}
                  className="tech-input"
                />
              </div>

              <div>
                <Label htmlFor="company" className="text-base font-semibold mb-2 block">
                  Company name (optional)
                </Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Your Company"
                  value={formData.company}
                  onChange={(e) => handleInputChange("company", e.target.value)}
                  className="tech-input"
                />
              </div>

              <div>
                <Label htmlFor="contactRole" className="text-base font-semibold mb-2 block">
                  Your role (optional)
                </Label>
                <Input
                  id="contactRole"
                  type="text"
                  placeholder="e.g., ML Engineer, DevOps Lead"
                  value={formData.contactRole}
                  onChange={(e) => handleInputChange("contactRole", e.target.value)}
                  className="tech-input"
                />
              </div>

              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="consent"
                  className="mt-1"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <label htmlFor="consent" className="text-sm text-muted-foreground">
                  J'accepte que mes données soient traitées par Anavim Advisory pour répondre à ma
                  demande, conformément à la{" "}
                  <a href="/privacy" className="text-accent hover:underline">
                    politique de confidentialité
                  </a>
                  .
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentStepIndex < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isStepValid() || isSubmitting}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit & Get Offers"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
