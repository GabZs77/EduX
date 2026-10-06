import { createFileRoute } from "@tanstack/react-router";
import { ApostilasPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/apostilas")({
  component: () => (
    <Guarded>
      <ApostilasPage />
    </Guarded>
  ),
});
