const StepBadge = ({ n, done }: { n: number; done: boolean }) => (
  <span className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 leading-none transition-colors duration-300 ${
    done
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground"
  }`}>
    <span key={String(done)} className="animate-in fade-in zoom-in-75 duration-200">
      {done ? "✓" : n}
    </span>
  </span>
);

export default StepBadge;
