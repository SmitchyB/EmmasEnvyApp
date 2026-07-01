import { Button } from "@/components/ui/Button";

export function HomeFinalCta() {
  return (
    <section className="space-y-4 text-center">
      <h2 className="text-2xl font-semibold text-white">Ready for your next set?</h2>
      <p className="mx-auto max-w-md text-white/75">
        Book your appointment and let Emma bring your nail vision to life.
      </p>
      <Button href="/book">Book an appointment</Button>
    </section>
  );
}
