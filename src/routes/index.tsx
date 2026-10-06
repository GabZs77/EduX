import { createFileRoute } from "@tanstack/react-router";
import { BoletimPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/")({
  component: () => (
    <Guarded>
      <BoletimPage />
    </Guarded>
  ),
});
