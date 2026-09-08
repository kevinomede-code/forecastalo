import { createFileRoute } from "@tanstack/react-router";
import AppSidebar from "@/components/AppSidebar";

export const Route = createFileRoute("/system")({
  head: () => ({
    meta: [
      { title: "System — How Forecastalo Is Built" },
      {
        name: "description",
        content:
          "A look under the hood of Forecastalo: the data pipeline, models and scoring machinery behind the screening tool.",
      },
      { property: "og:title", content: "Forecastalo System" },
      {
        property: "og:description",
        content: "The data pipeline, models and scoring machinery behind Forecastalo.",
      },
    ],
  }),
  component: SystemPage,
});

function SystemPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="min-h-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-soft">
          <h1 className="text-xl font-semibold tracking-tight">System</h1>
          <p className="mt-2 text-sm text-muted-foreground">Content is coming.</p>
        </div>
      </main>
    </div>
  );
}
