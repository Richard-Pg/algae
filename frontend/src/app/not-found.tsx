import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start px-4 py-24">
      <p className="label">404</p>
      <h1 className="mt-3 font-serif text-5xl">Nothing in this field of view</h1>
      <p className="mt-4 text-lg text-muted">The page you were looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-2">
        <ButtonLink href="/">Identify an image</ButtonLink>
        <ButtonLink href="/species" variant="secondary">Species library</ButtonLink>
      </div>
    </div>
  );
}
