'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

export const fleetPhotos = [
  { src: '/images/fleet/hero-fleet.jpg', alt: 'G K Enterprise fleet lineup', caption: 'Our refrigerated fleet' },
  { src: '/images/fleet/reefer-truck-side.jpg', alt: 'Eicher reefer truck side view', caption: 'Eicher reefer truck — 5 ton' },
  { src: '/images/fleet/reefer-interior.jpg', alt: 'Reefer box interior with cooling', caption: 'Carrier cooling unit — temperature controlled' },
  { src: '/images/fleet/gk-branded-truck.jpg', alt: 'G K Enterprise branded vehicle', caption: 'G K Enterprise branded reefer' },
  { src: '/images/fleet/bolero-reefer-side.jpg', alt: 'Mahindra Bolero reefer side view', caption: 'Mahindra Bolero reefer — last mile' },
  { src: '/images/fleet/bolero-side-clean.jpg', alt: 'Bolero reefer container side', caption: 'Reefer container — clean side view' },
  { src: '/images/fleet/eicher-front.jpg', alt: 'Eicher Pro reefer front view', caption: 'Eicher Pro reefer — front view' },
  { src: '/images/fleet/truck-back-branding.jpg', alt: 'Truck rear with G K Enterprise branding', caption: 'G K Enterprise — branded reefer back' },
  { src: '/images/fleet/eicher-reefer-open.jpg', alt: 'Eicher reefer open container', caption: 'Reefer container — open view' },
  { src: '/images/fleet/fleet-lineup-drivers.jpg', alt: 'Fleet vehicles with drivers', caption: 'Our fleet & team' },
] as const;

export function FleetPhotoGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIndex, close]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fleetPhotos.map((photo, idx) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className="group text-left rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#42A5F5]"
          >
            <div className="relative h-64 overflow-hidden bg-[#E0E8F0]">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-gk-barlow font-semibold text-sm md:text-base leading-snug">{photo.caption}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Fleet photo"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 z-[102] p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full h-[min(85vh,800px)] rounded-lg overflow-hidden bg-black">
              <Image
                src={fleetPhotos[openIndex].src}
                alt={fleetPhotos[openIndex].alt}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
            <p className="text-center text-white font-gk-rajdhani mt-4 text-sm md:text-base px-2">
              {fleetPhotos[openIndex].caption}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
