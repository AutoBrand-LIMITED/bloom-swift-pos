const StepBadge = ({ n, done }: { n: number; done: boolean }) => (
  <span className={`text-[11px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 leading-none ${
    done
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground"
  }`}>
    {done ? "✓" : n}
  </span>
);

export default StepBadge;
