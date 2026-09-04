import { SearchOptions, SearchResult } from "@/types/research";

export interface ResearchProvider {
  name: string;
  isConfigured(): boolean;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
