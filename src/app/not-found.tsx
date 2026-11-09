import Link from "next/link";

export default function NotFound() {
  return (
    <div
      role="alert"
      className="bg-surface ring-border-strong animate-in fixed inset-x-4 top-20 z-50 mx-auto max-w-sm rounded-2xl p-5 text-center shadow-2xl ring-1"
    >
      <p className="font-display text-text text-2xl">Off the board</p>
      <p className="text-muted mt-1 text-sm">
        That page doesn’t exist. The analysis board is still right here.
      </p>
      <Link
        href="/"
        className="bg-accent text-accent-ink mt-4 inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium"
      >
        Back to the board
      </Link>
    </div>
  );
}
