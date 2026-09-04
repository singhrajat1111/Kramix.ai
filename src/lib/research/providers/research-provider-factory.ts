import { ResearchProvider } from "./research-provider.interface";
import { DemoResearchProvider } from "./demo-research-provider";
import { WebResearchProvider } from "./web-research-provider";

export function getResearchProvider(requestedMode?: "live" | "demo"): ResearchProvider {
  if (requestedMode === "demo") {
    return new DemoResearchProvider();
  }

  const webProvider = new WebResearchProvider();
  if (webProvider.isConfigured() || requestedMode === "live") {
    return webProvider;
  }

  return new DemoResearchProvider();
}
