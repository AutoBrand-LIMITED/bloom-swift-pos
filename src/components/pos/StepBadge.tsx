const StepBadge = ({ n, done, skipped }: { n: number; done: boolean; skipped?: boolean }) => (
  <span className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 leading-none transition-colors duration-300 ${
    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
  }`}>
    <span key={skipped ? "skip" : String(done)} className="animate-in fade-in zoom-in-75 duration-200">
      {skipped ? "–" : done ? "✓" : n}
    </span>
  </span>
);

export default StepBadge;
