'use client';

import { useState, type FormEvent } from 'react';

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#42A5F5] focus:outline-none';

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      alert('Please fill in Name, Email and Message');
      return;
    }

    setStatus('sending');

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: '57da9aec-329b-4966-b607-c4e62df2f68f',
          from_name: 'GK Enterprise Website',
          subject: formData.subject || `New enquiry from ${formData.name}`,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || 'Not provided',
          message: formData.message,
          ccemail: 'admin@gkenterprise.in',
        }),
      });

      const result = (await response.json()) as { success?: boolean };

      if (result.success) {
        setStatus('success');
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Hidden fields for Web3Forms (payload sent via fetch) */}

      <input
        type="text"
        placeholder="Your Name *"
        required
        value={formData.name}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
        className={inputClass}
        autoComplete="name"
      />

      <input
        type="email"
        placeholder="Your Email *"
        required
        value={formData.email}
        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
        className={inputClass}
        autoComplete="email"
      />

      <input
        type="tel"
        placeholder="Your Phone"
        value={formData.phone}
        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
        className={inputClass}
        autoComplete="tel"
      />

      <input
        type="text"
        placeholder="Subject"
        value={formData.subject}
        onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
        className={inputClass}
        autoComplete="off"
      />

      <textarea
        placeholder="Your Message *"
        required
        rows={5}
        value={formData.message}
        onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
        className={`${inputClass} resize-none`}
      />

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full py-3 bg-[#1565C0] hover:bg-[#0D2847] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>

      {status === 'success' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
          ✅ Message sent successfully! We will get back to you soon.
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          ❌ Failed to send message. Please try again or email us directly.
        </div>
      )}
    </form>
  );
}
