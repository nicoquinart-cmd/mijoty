export type ChronodriveMatch = {
  found: boolean;
  productName?: string | null;
  brand?: string | null;
  packageText?: string | null;
  price?: number | null;
  pricePerUnit?: string | null;
  url?: string | null;
  confidence?: number | null;
  checkedAt?: string | null;
  note?: string | null;
};

export async function findChronodrivePrice(params: {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  barcode?: string | null;
}): Promise<ChronodriveMatch> {
  const search = new URLSearchParams();
  search.set('name', params.name);
  if (params.quantity != null) search.set('quantity', String(params.quantity));
  if (params.unit) search.set('unit', params.unit);
  if (params.barcode) search.set('barcode', params.barcode);

  const response = await fetch(`/api/chronodrive-price?${search.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Recherche Chronodrive indisponible');
  }
  return response.json();
}
