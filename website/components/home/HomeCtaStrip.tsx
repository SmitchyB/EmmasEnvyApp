import { Button } from "@/components/ui/Button";

export function HomeCtaStrip() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Button href="/book">Book an appointment</Button>
      <Button href="/portfolio" variant="secondary">
        View portfolio
      </Button>
    </div>
  );
}
