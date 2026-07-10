interface Props { message?: string }

export function ErrorBanner({ message }: Props) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
      <p className="text-sm text-red-700">{message ?? 'Something went wrong. Please try again.'}</p>
    </div>
  );
}
