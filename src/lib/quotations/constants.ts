export const QUOTATION_STATUSES = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED_TO_INVOICE',
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: 'bg-[#7A9AB8]/15 text-[#5C6F82]',
  SENT: 'bg-[#42A5F5]/15 text-[#1565C0]',
  ACCEPTED: 'bg-[#16A34A]/15 text-[#15803d]',
  REJECTED: 'bg-[#DC2626]/15 text-[#b91c1c]',
  EXPIRED: 'bg-[#F59E0B]/15 text-[#c2410c]',
  CONVERTED_TO_INVOICE: 'bg-[#7C3AED]/15 text-[#6d28d9]',
};

/** Align labels with backend `VehicleQuoteType` when deployed; OTHER uses free text. */
export const VEHICLE_QUOTE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'REEFER_VAN', label: 'Reefer van' },
  { value: 'REEFER_TRUCK', label: 'Reefer truck' },
  { value: 'REEFER_CONTAINER', label: 'Reefer container' },
  { value: 'REFRIGERATED_PICKUP', label: 'Refrigerated pickup' },
  { value: 'DRY_VAN', label: 'Dry van' },
  { value: 'OTHER', label: 'Other' },
];

export const DEFAULT_QUOTATION_SUBJECT = 'Proposal for the hire of Refrigerated Van Service';

export const DEFAULT_QUOTATION_TERMS = `1. The vehicle will be maintained in good working condition with timely services.
2. GPS tracking system installed for real-time monitoring.
3. The rate is based on current fuel prices and may be revised as per market.
4. Toll charges extra (supported by toll receipts) unless mentioned otherwise.
5. Payment terms: 15 days from invoice date.
6. Quotation valid for 30 days from date of issue.`;
