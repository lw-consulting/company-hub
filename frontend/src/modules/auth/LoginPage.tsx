import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || 'Anmeldung fehlgeschlagen');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-neutral-900 items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full border border-white/20" />
          <div className="absolute bottom-20 right-20 w-64 h-64 rounded-full border border-white/20" />
        </div>
        <div className="relative z-10 max-w-md">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-10">
            <span className="text-neutral-900 text-lg font-black">CH</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Ihr zentrales<br />Unternehmensportal
          </h1>
          <p className="text-neutral-400 text-lg mt-4 leading-relaxed">
            Alles an einem Ort. Zeiterfassung, Kommunikation, Aufgaben und mehr.
          </p>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-surface-secondary dark:bg-neutral-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-12">
            <div className="w-10 h-10 bg-neutral-900 dark:bg-white rounded-xl flex items-center justify-center mb-4">
              <span className="text-white dark:text-neutral-900 text-sm font-black">CH</span>
            </div>
          </div>

          <h2 className="text-display text-neutral-900 dark:text-white">Willkommen</h2>
          <p className="text-muted mt-2 mb-10">Melden Sie sich an, um fortzufahren</p>

          {error && (
            <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">E-Mail</label>
              <input
                type="email"
                className="input"
                placeholder="name@unternehmen.at"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Passwort</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder="Passwort eingeben"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3.5 text-base mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Anmelden
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
