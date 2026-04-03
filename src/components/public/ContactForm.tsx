'use client';

import { useState, type FormEvent } from 'react';

const services = [
  'Cold chain transport',
  'General fleet',
  'Fleet management / technology',
  'Other',
];

export function ContactForm() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState(services[0]);
  const [message, setMessage] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = [
      `Name: ${name}`,
      `Company: ${company}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Service: ${service}`,
      '',
      message,
    ].join('\n');
    const subject = encodeURIComponent(`Website enquiry — ${service}`);
    const mailto = `mailto:ganesh@gkenterprise.in?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label htmlFor="gk-name" className="block font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#0D2847] mb-1.5">
          Name
        </label>
        <input
          id="gk-name"
          name="name"
          required
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          className="rounded-lg border border-[#E0E8F0] bg-white px-4 py-3 font-gk-rajdhani w-full"
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="gk-company" className="block font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#0D2847] mb-1.5">
          Company
        </label>
        <input
          id="gk-company"
          name="company"
          value={company}
          onChange={(ev) => setCompany(ev.target.value)}
          className="rounded-lg border border-[#E0E8F0] bg-white px-4 py-3 font-gk-rajdhani w-full"
          autoComplete="organization"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="gk-phone" className="block font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#0D2847] mb-1.5">
            Phone
          </label>
          <input
            id="gk-phone"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            className="rounded-lg border border-[#E0E8F0] bg-white px-4 py-3 font-gk-rajdhani w-full"
            autoComplete="tel"
          />
        </div>
        <div>
          <label htmlFor="gk-email" className="block font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#0D2847] mb-1.5">
            Email
          </label>
          <input
            id="gk-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="rounded-lg border border-[#E0E8F0] bg-white px-4 py-3 font-gk-rajdhani w-full"
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <label htmlFor="gk-service" className="block font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#0D2847] mb-1.5">
          Service
        </label>
        <select
          id="gk-service"
          name="service"
          value={service}
          onChange={(ev) => setService(ev.target.value)}
          className="rounded-lg border border-[#E0E8F0] bg-white px-4 py-3 font-gk-rajdhani w-full"
        >
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="gk-message" className="block font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#0D2847] mb-1.5">
          Message
        </label>
        <textarea
          id="gk-message"
          name="message"
          rows={4}
          value={message}
          onChange={(ev) => setMessage(ev.target.value)}
          className="rounded-lg border border-[#E0E8F0] bg-white px-4 py-3 font-gk-rajdhani w-full"
        />
      </div>
      <button
        type="submit"
        className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-[#1565C0] text-white font-gk-barlow font-bold uppercase tracking-wider hover:bg-[#0D2847] transition-colors"
      >
        Send message
      </button>
    </form>
  );
}
