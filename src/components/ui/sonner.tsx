import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast: [
            "group toast",
            "!rounded-xl !border !shadow-md !py-3 !px-4",
            "!bg-card !text-foreground !border-border",
            "!text-sm !font-medium",
          ].join(" "),
          title: "!font-semibold !text-[13px]",
          description: "!text-xs !text-muted-foreground !mt-0.5",
          icon: "!w-4 !h-4",
          success: [
            "!border-primary/20 !bg-primary/[0.04]",
            "[&>[data-icon]]:!text-primary",
          ].join(" "),
          error: [
            "!border-destructive/20 !bg-destructive/[0.04]",
            "[&>[data-icon]]:!text-destructive",
          ].join(" "),
          warning: [
            "!border-amber-300/40 !bg-amber-50/60",
            "[&>[data-icon]]:!text-amber-600",
          ].join(" "),
          info: [
            "!border-border !bg-card",
            "[&>[data-icon]]:!text-muted-foreground",
          ].join(" "),
          actionButton: "!bg-primary !text-primary-foreground !text-xs !rounded-lg",
          cancelButton: "!bg-muted !text-muted-foreground !text-xs !rounded-lg",
          closeButton: "!border-border !bg-card hover:!bg-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
