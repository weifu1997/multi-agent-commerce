import type {
  ExperimentsResponse,
  HealthResponse,
  RecommendationRequest,
  RecommendationResponse,
} from "./types";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") {
        errorDetail = data.detail;
      } else if (data && typeof data.message === "string") {
        errorDetail = data.message;
      }
    } catch {
      errorDetail = res.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch("/health");
  return handleResponse<HealthResponse>(res);
}

export async function recommend(
  request: RecommendationRequest,
  signal?: AbortSignal
): Promise<RecommendationResponse> {
  const res = await fetch("/api/v1/recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<RecommendationResponse>(res);
}

export async function recommendGraph(
  request: RecommendationRequest,
  signal?: AbortSignal
): Promise<RecommendationResponse> {
  const res = await fetch("/api/v1/recommend/graph", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  return handleResponse<RecommendationResponse>(res);
}

export async function getExperiments(): Promise<ExperimentsResponse> {
  const res = await fetch("/api/v1/experiments");
  return handleResponse<ExperimentsResponse>(res);
}

export async function recordOutcome(
  experimentId: string,
  group: string,
  success: boolean
): Promise<{ status: string }> {
  const query = new URLSearchParams({
    group,
    success: String(success),
  });
  const res = await fetch(
    `/api/v1/experiments/${encodeURIComponent(experimentId)}/outcome?${query.toString()}`,
    {
      method: "POST",
    }
  );
  return handleResponse<{ status: string }>(res);
}
