import {
  AlertCircle,
  Check,
  Circle,
  CreditCard,
  MessageSquareText,
  Package,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkflowSectionId = "customer" | "items" | "delivery" | "notes" | "payment";
export type WorkflowSectionStatus = "complete" | "error" | "optional" | "pending";

export interface WorkflowSection {
  id: WorkflowSectionId;
  label: string;
  status: WorkflowSectionStatus;
  errorCount?: number;
}

interface PosWorkflowTabsProps {
  sections: WorkflowSection[];
  activeSection: WorkflowSectionId;
  onSelect: (section: WorkflowSectionId) => void;
}

const sectionIcons: Record<WorkflowSectionId, LucideIcon> = {
  customer: UserRound,
  items: Package,
  delivery: Truck,
  notes: MessageSquareText,
  payment: CreditCard,
};

const statusLabel = (section: WorkflowSection): string => {
  if (section.status === "complete") return "已完成";
  if (section.status === "error") return `${section.errorCount || 1} 項待修正`;
  if (section.status === "optional") return "選填";
  return "待填";
};

const PosWorkflowTabs = ({ sections, activeSection, onSelect }: PosWorkflowTabsProps) => (
  <nav aria-label="訂單填寫進度" className="border-t border-border/80 bg-card/95 px-3 py-2">
    <div className="mx-auto flex max-w-[1320px] gap-2 overflow-x-auto pb-0.5">
      {sections.map((section, index) => {
        const Icon = sectionIcons[section.id];
        const active = activeSection === section.id;
        const StatusIcon = section.status === "complete"
          ? Check
          : section.status === "error"
            ? AlertCircle
            : Circle;

        return (
          <button
            key={section.id}
            type="button"
            aria-current={active ? "step" : undefined}
            aria-label={`${index + 1}. ${section.label}，${statusLabel(section)}`}
            onClick={() => onSelect(section.id)}
            className={cn(
              "group flex min-h-12 min-w-[150px] flex-1 touch-manipulation items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : "border-transparent bg-background/60 text-muted-foreground hover:border-border hover:bg-background",
              section.status === "error" && "border-destructive/40 bg-destructive/5",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                section.status === "error" && "bg-destructive text-destructive-foreground",
              )}
            >
              {section.status === "complete" ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{section.label}</span>
              </span>
              <span
                className={cn(
                  "mt-0.5 flex items-center gap-1 text-[11px]",
                  section.status === "complete" && "text-success",
                  section.status === "error" && "text-destructive",
                )}
              >
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {statusLabel(section)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default PosWorkflowTabs;
