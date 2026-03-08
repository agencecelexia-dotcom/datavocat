"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart } from "@/components/stats/timeline-chart";

export default function ChronologiePage() {
  // TODO: Fetch timeline data from API when decisions are available
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Évolution chronologique
        </h1>
        <p className="text-muted-foreground">
          Tendances des décisions dans le temps
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution annuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineChart data={[]} />
        </CardContent>
      </Card>
    </div>
  );
}
