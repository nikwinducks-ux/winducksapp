interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  showValue?: boolean;
}

export function ScoreBar({ label, value, max = 100, showValue = true }: ScoreBarProps) {
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {showValue && <span className="font-medium">{value}%</span>}
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
