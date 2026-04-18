import { Link } from 'react-router-dom'
import { Facebook, Twitter, Instagram, Youtube, MessageCircle } from 'lucide-react'

export default function Footer({ className }: { className?: string }) {
  return (
    <footer className={`bg-[#0a1f0b] text-white${className ? ' ' + className : ''}`}>
      <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand */}
        <div className="lg:col-span-2">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1b5e20] to-[#43a047] rounded-xl flex items-center justify-center text-xl">🌿</div>
            <div>
              <div className="text-lg font-extrabold">Hafa <span className="text-[#A5D6A7]">Market</span></div>
              <div className="text-xs text-white/40">Farm Fresh Delivered</div>
            </div>
          </Link>
          <p className="text-white/50 text-sm leading-relaxed mb-5">Africa's premier agricultural marketplace connecting farmers and buyers across Ethiopia, Kenya, Ghana, Nigeria, Senegal and 30+ cities.</p>
          <div className="flex gap-2.5 mb-5">
            {[Facebook, Twitter, Instagram, Youtube, MessageCircle].map((Icon, i) => (
              <a key={i} href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#2E7D32] transition-colors">
                <Icon size={15} />
              </a>
            ))}
          </div>
          {/* App download */}
          <div className="flex gap-2 flex-wrap">
            {[['fab fa-google-play','Get it on','Google Play'],['fab fa-apple','Download on','App Store']].map(([icon,sub,name]) => (
              <a key={name} href="#" className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2 hover:bg-white/15 transition-colors">
                <i className={`${icon} text-xl`} />
                <div><div className="text-[9px] text-white/50">{sub}</div><div className="text-xs font-bold">{name}</div></div>
              </a>
            ))}
          </div>
        </div>

        {/* Links */}
        {[
          { title:'Quick Links', links:[['Home','/'],['Products','/products'],['Deals','/products?sort=soldCount'],['Live Commerce','/live'],['Forum','/forum'],['Farmer Direct','/farmer-direct'],['Leaderboard','/leaderboard'],['Pickup Stations','/pickup-stations'],['Bundles','/bundles'],['Mandi Prices','/mandi-prices'],['Seasonality','/seasonality'],['Blog','/blog']] },
          { title:'B2B & Bulk',  links:[['Bulk Order','/bulk-order'],['Quick Order Grid','/quick-order'],['Volume Pricing','/volume-pricing'],['RFQ Workspace','/rfq'],['Purchase Orders','/purchase-orders'],['Net-30 Credit','/net30'],['Approval Chains','/approval-chains']] },
          { title:'Categories',  links:[['Vegetables','/products?category=vegetables'],['Fruits','/products?category=fruits'],['Grains','/products?category=grains'],['Coffee','/products?category=coffee'],['Specialty','/products?category=specialty'],['Household','/products?category=household']] },
          { title:'Support',     links:[['Help Center','#'],['Contact Us','#'],['Privacy Policy','#'],['Terms of Service','#'],['Seller Portal','/dashboard'],['FAQ','#']] },
        ].map(col => (
          <div key={col.title}>
            <h4 className="font-bold text-sm mb-4 pb-2 border-b border-white/10">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map(([label, to]) => (
                <li key={label}><Link to={to} className="text-white/50 text-sm hover:text-[#A5D6A7] transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-white/10 py-5">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">© 2026 Hafa Market. All rights reserved. Made with 💚 for African Farmers.</p>
          <div className="flex items-center gap-3 text-white/40 text-sm">
            <span title="Visa" className="text-lg">💳</span>
            <span title="Mastercard" className="text-lg">💳</span>
            <span title="M-Pesa" className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded">M-Pesa</span>
            <span title="Chapa"  className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded">Chapa</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
