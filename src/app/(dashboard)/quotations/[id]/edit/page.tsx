'use client';

import { useParams } from 'next/navigation';
import QuotationForm from '../../QuotationForm';

export default function EditQuotationPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  if (!id) {
    return <p className="font-['Rajdhani'] text-[#7A9AB8]">Invalid quotation.</p>;
  }
  return <QuotationForm quotationId={id} />;
}
