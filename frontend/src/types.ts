export interface Product {
  product_id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  brand?: string;
  seller_id?: string;
  stock?: number;
  tags?: string[];
  score?: number;
  image_url?: string;
}

export interface UserProfile {
  user_id: string;
  age?: number | null;
  gender?: string | null;
  city?: string | null;
  segments: string[];
  preferred_categories: string[];
  price_range: [number, number];
  recent_views?: string[];
  recent_purchases?: string[];
  rfm_score?: Record<string, number>;
  real_time_tags?: Record<string, any>;
}

export interface LowStockAlert {
  product_id: string;
  current_stock: number;
  threshold?: number;
  [key: string]: any;
}

export interface AgentResult {
  agent_name: string;
  success: boolean;
  latency_ms: number;
  error?: string | null;
  data?: Record<string, any>;
  confidence?: number;
  // Subclass extras from HTTP contract:
  profile?: UserProfile | null;
  products?: Product[];
  recall_strategy?: string;
  available_products?: string[];
  low_stock_alerts?: LowStockAlert[];
  purchase_limits?: Record<string, number>;
  copies?: Array<Record<string, string>>;
  prompt_template_used?: string;
}

export interface ExperimentAssignment {
  group: string;
  config: Record<string, any>;
  assign: "hash" | "thompson";
}

export interface RecommendationResponse {
  request_id: string;
  user_id: string;
  products: Product[];
  marketing_copies: Array<Record<string, string>>;
  experiment_group: string;
  experiments: Record<string, ExperimentAssignment>;
  agent_results: Record<string, AgentResult>;
  total_latency_ms: number;
}

export interface RecommendationRequest {
  user_id: string;
  scene?: string;
  num_items: number;
  context: Record<string, any>;
}

export interface ExperimentGroup {
  name: string;
  weight: number;
  config: Record<string, any>;
  successes: number;
  failures: number;
}

export interface ExperimentStats {
  mean: number;
  samples: number;
  [key: string]: any;
}

export interface ExperimentDetail {
  name: string;
  enabled: boolean;
  groups: ExperimentGroup[];
  stats: Record<string, ExperimentStats>;
}

export type ExperimentsResponse = Record<string, ExperimentDetail>;

export interface HealthResponse {
  status: string;
  model: string;
}

export type OrchestratorType = "supervisor" | "graph";

export interface PresetProfile {
  id: string;
  name: string;
  badge: string;
  description: string;
  context: Record<string, any>;
}
