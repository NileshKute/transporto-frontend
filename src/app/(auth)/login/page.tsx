'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Truck, Snowflake, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const demoAccounts = [
  { role: 'Super Admin', email: 'admin@transporto.in', password: 'admin123', icon: '👨‍💼' },
  { role: 'Manager', email: 'priya@transporto.in', password: 'admin123', icon: '👩‍💼' },
  { role: 'Driver', email: 'rajesh@transporto.in', password: 'driver123', icon: '🚛' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account: typeof demoAccounts[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - G K Enterprise Branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#0A1628] to-[#0D2847] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#1565C0] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#42A5F5] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 w-full">
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-[60px] h-[60px] rounded-lg bg-gradient-to-br from-[#0D2847] to-[#1A4A7A] flex items-center justify-center relative flex-shrink-0">
                <span className="font-['Bebas_Neue'] text-3xl text-white">G</span>
                <span className="font-['Bebas_Neue'] text-3xl text-[#42A5F5]">K</span>
                <div className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#42A5F5] rounded-full" />
              </div>
              <h1 className="font-['Oswald'] text-2xl font-bold text-white tracking-wider">G K ENTERPRISE</h1>
            </div>
            <p className="font-['Barlow_Condensed'] text-[#42A5F5] tracking-[4px] uppercase">COLD CHAIN LOGISTICS</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 text-[#64B5F6]">
              <div className="w-12 h-12 rounded-xl bg-[#42A5F5]/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-[#42A5F5]" />
              </div>
              <div>
                <p className="font-semibold text-white font-['Oswald']">Track Vehicles in Real-time</p>
                <p className="text-sm text-[#64B5F6] font-['Rajdhani']">Monitor your entire fleet from one dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[#64B5F6]">
              <div className="w-12 h-12 rounded-xl bg-[#42A5F5]/10 flex items-center justify-center">
                <Snowflake className="w-6 h-6 text-[#42A5F5]" />
              </div>
              <div>
                <p className="font-semibold text-white font-['Oswald']">Cold Storage Monitoring 24/7</p>
                <p className="text-sm text-[#64B5F6] font-['Rajdhani']">Temperature alerts and live monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[#64B5F6]">
              <div className="w-12 h-12 rounded-xl bg-[#42A5F5]/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-[#42A5F5]" />
              </div>
              <div>
                <p className="font-semibold text-white font-['Oswald']">Complete Business Analytics</p>
                <p className="text-sm text-[#64B5F6] font-['Rajdhani']">Fuel costs, trip reports, and more</p>
              </div>
            </div>
          </div>

          <p className="mt-16 text-sm text-[#7A9AB8] font-['Rajdhani']">Navi Mumbai · Since 2019</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0D2847] to-[#1A4A7A] flex items-center justify-center border border-[#1A4A7A]">
              <span className="font-['Bebas_Neue'] text-lg text-white">G</span>
              <span className="font-['Bebas_Neue'] text-lg text-[#42A5F5]">K</span>
            </div>
            <span className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wider">G K ENTERPRISE</span>
          </div>

          <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] mb-2">Welcome back</h1>
          <p className="font-['Rajdhani'] text-[#7A9AB8] mb-8">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-sm font-['Rajdhani']">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-[#E0E8F0] text-[#0D2847] placeholder:text-[#7A9AB8] focus:outline-none focus:ring-2 focus:ring-[#42A5F5]/20 focus:border-[#42A5F5] transition-shadow font-['Rajdhani']"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-lg border border-[#E0E8F0] text-[#0D2847] placeholder:text-[#7A9AB8] focus:outline-none focus:ring-2 focus:ring-[#42A5F5]/20 focus:border-[#42A5F5] transition-shadow font-['Rajdhani']"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-[#7A9AB8] hover:text-[#0D2847]">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#1565C0] hover:bg-[#0D2847] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8">
            <p className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#7A9AB8] mb-3">Demo Accounts</p>
            <div className="space-y-2">
              {demoAccounts.map(account => (
                <button
                  key={account.email}
                  onClick={() => fillDemo(account)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-[#E0E8F0] hover:border-[#42A5F5] hover:bg-[#42A5F5]/5 transition-all text-left group font-['Rajdhani']"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{account.icon}</span>
                    <span className="text-sm font-medium text-[#0D2847] group-hover:text-[#1565C0]">{account.role}</span>
                  </div>
                  <span className="text-xs text-[#7A9AB8] font-mono">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
