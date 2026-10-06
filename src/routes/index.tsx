import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/")({
  component: () => (
    <Guarded>
      <HomePage />
    </Guarded>
  ),
});
