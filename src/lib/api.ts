const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export interface HealthResponse {
  status: "ok";
  service: string;
}

export async function checkApiHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
