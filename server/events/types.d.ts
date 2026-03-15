export interface NewsRequest {
  type: "category" | "search";
  value: string;
}

export interface FreeCryptoNewsArticle {
  title: string;
  description: string;
  pubDate: string;
  publishedAt?: string;
  source: string | { title?: string };
  sourceKey: string;
  category: string;
  link: string | null;
  published_at?: string;
  created_at?: string;
  url?: string | null;
  original_url?: string | null;
  id?: string | number;
  kind?: string;
  votes?: {
    positive?: number;
    negative?: number;
    important?: number;
    saved?: number;
    comments?: number;
  };
  instruments?: Array<{
    code?: string;
    title?: string;
  }>;
}

export type AliasMap = Record<string, string[]>;

export interface PriceEventShape {
  id: string;
  timestamp: number;
  title: string;
  source: string;
  asset?: string;
  url?: string | null;
  sentiment?: "positive" | "negative" | "neutral";
}

export interface MatchedArticle {
  post: FreeCryptoNewsArticle;
  asset: string;
}

export interface ScoredEvent {
  event: PriceEventShape;
  score: number;
}
