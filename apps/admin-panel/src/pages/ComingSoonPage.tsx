interface Props { title: string; icon?: string }

export function ComingSoonPage({ title, icon = '🚧' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500 max-w-xs">
        This module is coming in the next phase. Backend API is ready — UI is being built.
      </p>
    </div>
  );
}
