import { useState } from 'react'

const SCREENS = [
  {
    tab: 'Shopping',
    caption: 'Easy Shopping Experience',
    desc: 'Browse and discover thousands of fresh products with smart search and filters',
    phone: (
      <div className="bg-white rounded-[22px] overflow-hidden h-full text-[10px]">
        <div className="bg-gradient-to-r from-[#1b5e20] to-[#2E7D32] text-white px-3 py-2 flex justify-between font-bold text-[11px]"><span>🌿 Hafa</span><span>🛒</span></div>
        <div className="bg-gray-100 mx-2 mt-2 rounded-full px-3 py-1.5 text-gray-400">🔍 Search products...</div>
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 text-white mx-2 mt-2 rounded-xl p-2 font-bold text-center">🔥 40% OFF Vegetables Today!</div>
        <div className="flex justify-around px-2 py-2 text-lg border-b border-gray-100">{'🥬🍎🌾☕🍯'.split('').map((e,i)=><span key={i}>{e}</span>)}</div>
        <div className="px-2 pt-1 font-bold text-gray-700">Featured</div>
        <div className="grid grid-cols-2 gap-1.5 px-2 pt-1">
          {[['🥭','Mango','$4.49'],['🥚','Eggs x12','$3.99'],['☕','Coffee','$9.99'],['🍯','Honey','$8.99']].map(([e,n,p])=>(
            <div key={n} className="bg-gray-50 rounded-xl p-2 text-center"><div className="text-2xl">{e}</div><div className="font-semibold text-gray-700 text-[9px]">{n}</div><div className="text-green-primary font-bold text-[9px]">{p}</div></div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tab: 'Checkout',
    caption: 'Secure Checkout',
    desc: 'Fast, safe payment with multiple options — card, mobile money, or cash on delivery',
    phone: (
      <div className="bg-white rounded-[22px] overflow-hidden h-full text-[10px]">
        <div className="bg-gradient-to-r from-[#1b5e20] to-[#2E7D32] text-white px-3 py-2 font-bold text-[11px]">🛒 My Cart (3)</div>
        {[['🥭','Mangoes 1kg','$4.49','×2'],['☕','Ethiopian Coffee','$9.99','×1'],['🍯','Pure Honey','$8.99','×1']].map(([e,n,p,q])=>(
          <div key={n} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50">
            <span className="text-xl">{e}</span>
            <div className="flex-1"><div className="font-bold text-gray-700">{n}</div><div className="text-green-primary font-bold">{p}</div></div>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-bold">{q}</span>
          </div>
        ))}
        <div className="px-3 py-2 bg-green-50 mx-2 mt-2 rounded-xl text-green-primary font-bold">🎁 Promo: HAFA10</div>
        <div className="flex justify-between px-3 py-2 font-extrabold text-gray-800"><span>Total</span><span className="text-green-primary">$28.46</span></div>
        <div className="bg-green-primary text-white text-center py-2 mx-2 rounded-xl font-bold">Checkout →</div>
      </div>
    ),
  },
  {
    tab: 'Tracking',
    caption: 'Real-Time Tracking',
    desc: 'Track your orders live from farm to your doorstep with instant notifications',
    phone: (
      <div className="bg-white rounded-[22px] overflow-hidden h-full text-[10px]">
        <div className="bg-gradient-to-r from-[#1b5e20] to-[#2E7D32] text-white px-3 py-2 font-bold text-[11px]">📦 Track Order</div>
        <div className="bg-gray-50 mx-2 mt-2 rounded-xl p-2 text-center text-gray-500">Order #HM-2026-0892</div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 mx-2 mt-2 rounded-xl h-16 flex items-center justify-center text-2xl">🗺️</div>
        <div className="px-3 mt-2 space-y-1.5">
          {[['✅','Order Placed','done'],['✅','Processing','done'],['🚚','On the Way','active'],['🏠','Delivered','']].map(([icon,label,state])=>(
            <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${state==='done'?'bg-green-50 text-green-primary':state==='active'?'bg-green-primary text-white font-bold':'bg-gray-50 text-gray-400'}`}>
              <span>{icon}</span><span>{label}</span>
            </div>
          ))}
        </div>
        <div className="bg-orange-400 text-white text-center py-1.5 mx-2 mt-2 rounded-xl font-bold">🕐 ETA: 25 minutes</div>
      </div>
    ),
  },
]

export default function AppPreviewSection() {
  const [active, setActive] = useState(0)

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-2">Platform Experience</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">Shop Smarter on <span className="text-green-primary">Any Device</span></h2>
          <p className="text-gray-400 mt-2 text-sm">A seamless, beautiful experience on mobile, tablet, or desktop</p>
        </div>

        <div className="flex justify-center gap-2 mb-10">
          {SCREENS.map((s, i) => (
            <button key={s.tab} onClick={() => setActive(i)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${active === i ? 'bg-green-primary text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-green-primary'}`}>
              {s.tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center gap-10 max-w-4xl mx-auto">
          {/* Phone */}
          <div className="flex-shrink-0">
            <div className="w-52 bg-gray-900 rounded-[36px] p-3 shadow-2xl border-4 border-gray-800">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-2" />
              <div className="h-[400px] rounded-[22px] overflow-hidden">
                {SCREENS[active].phone}
              </div>
            </div>
          </div>
          {/* Info */}
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-3">{SCREENS[active].caption}</h3>
            <p className="text-gray-500 leading-relaxed mb-6">{SCREENS[active].desc}</p>
            <ul className="space-y-2">
              {[['✅','Personalized recommendations'],['✅','Real-time order tracking'],['✅','Secure payment processing'],['✅','6 language support']].map(([icon,text])=>(
                <li key={text} className="flex items-center gap-2 text-sm text-gray-700"><span>{icon}</span>{text}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
