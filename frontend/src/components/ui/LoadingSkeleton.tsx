interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({
  lines = 3,
  className = "",
}: LoadingSkeletonProps) {
  return (
    <div aria-hidden="true" className={`skeleton-stack ${className}`.trim()}>
      {Array.from({ length: lines }, (_, index) => (
        <span
          className="skeleton-line"
          key={index}
          style={{ width: `${100 - (index % 3) * 13}%` }}
        />
      ))}
    </div>
  );
}
