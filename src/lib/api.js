export const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "https://meeto-server.onrender.com").replace(/\/+$/, "");

export async function checkApiHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
  return response.json();
}
