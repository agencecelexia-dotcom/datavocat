"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="font-serif text-2xl font-bold">
          Une erreur est survenue
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Nous nous excusons pour la gene occasionnee. Veuillez reessayer ou
          contacter le support si le probleme persiste.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Reessayer
      </Button>
    </div>
  );
}
