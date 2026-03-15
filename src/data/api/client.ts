const INFO_ENDPOINT = "https://api.hyperliquid.xyz/info";

// Official docs:
// - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
// - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
export async function postInfo<TResponse, TBody extends Record<string, unknown>>(
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(INFO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid info request failed with ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
