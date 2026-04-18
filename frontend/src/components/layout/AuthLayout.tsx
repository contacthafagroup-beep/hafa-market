import { Outlet, Link } from 'react-router-dom'

export default function AuthLayout() {
  // Don't block auth pages with loading spinner — just render the form
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-dark via-green-primary to-green-mid flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🌿</div>
          <div>
            <div className="text-2xl font-extrabold">Hafa Market</div>
            <div className="text-sm text-white/70">Farm Fresh Delivered</div>
          </div>
        </Link>
        <div>
          <h2 className="text-4xl font-black leading-tight mb-4">Africa's Premier Agricultural Marketplace</h2>
          <p className="text-white/75 text-lg leading-relaxed">Join 50,000+ farmers and buyers. Fresh products, fast delivery, and the best prices.</p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[['50K+','Customers'],['500+','Farmers'],['10K+','Products']].map(([n,l]) => (
              <div key={l} className="bg-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-orange-300">{n}</div>
                <div className="text-xs text-white/70 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/40 text-sm">© 2026 Hafa Market</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white lg:rounded-l-3xl">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-green-primary rounded-xl flex items-center justify-center text-lg">🌿</div>
            <span className="text-xl font-extrabold text-gray-900">Hafa <span className="text-green-primary">Market</span></span>
          </Link>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
