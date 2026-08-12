export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" role="progressbar" aria-label="Savings progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
