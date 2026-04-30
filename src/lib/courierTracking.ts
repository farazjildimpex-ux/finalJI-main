// Tap-to-track URL builders for the most common couriers used by JILD IMPEX.
// Keep this list short and predictable — the user picks the provider, we
// build the public tracking URL, and the device opens it in the browser.

export interface CourierProvider {
  id: string;
  label: string;
  buildUrl: (ref: string) => string;
}

export const COURIERS: CourierProvider[] = [
  { id: 'dhl',      label: 'DHL Express',  buildUrl: (r) => `https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(r)}` },
  { id: 'fedex',    label: 'FedEx',        buildUrl: (r) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(r)}` },
  { id: 'ups',      label: 'UPS',          buildUrl: (r) => `https://www.ups.com/track?tracknum=${encodeURIComponent(r)}` },
  { id: 'aramex',   label: 'Aramex',       buildUrl: (r) => `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(r)}` },
  { id: 'bluedart', label: 'BlueDart',     buildUrl: (r) => `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(r)}` },
  { id: 'dtdc',     label: 'DTDC',         buildUrl: (r) => `https://www.dtdc.in/trace.asp?strCnno=${encodeURIComponent(r)}` },
  { id: 'indiapost',label: 'India Post',   buildUrl: (r) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?trackingNumber=${encodeURIComponent(r)}` },
  { id: 'tnt',      label: 'TNT',          buildUrl: (r) => `https://www.tnt.com/express/en_in/site/shipping-tools/tracking.html?searchType=con&cons=${encodeURIComponent(r)}` },
  { id: 'other',    label: 'Other',        buildUrl: (r) => `https://www.google.com/search?q=track+courier+${encodeURIComponent(r)}` },
];

export function getCourier(id?: string | null): CourierProvider | undefined {
  if (!id) return undefined;
  return COURIERS.find((c) => c.id === id);
}

export function buildTrackingUrl(providerId?: string | null, reference?: string | null): string | null {
  if (!providerId || !reference?.trim()) return null;
  const c = getCourier(providerId);
  if (!c) return null;
  return c.buildUrl(reference.trim());
}
