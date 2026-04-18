import { Truck, Medal, Tag, Smartphone, ShieldCheck, Headphones } from 'lucide-react'

const FEATURES = [
  { icon:<Truck size={22}/>,        title:'Fast Delivery',        desc:'Get your orders delivered within 24–48 hours right to your doorstep, anywhere in the city.', num:'01', bg:'bg-green-50',  color:'text-green-primary' },
  { icon:<Medal size={22}/>,        title:'High-Quality Products', desc:'All products are verified and sourced directly from trusted, certified local farmers.',         num:'02', bg:'bg-orange-50', color:'text-orange-600' },
  { icon:<Tag size={22}/>,          title:'Affordable Prices',     desc:'Competitive pricing with regular deals and bulk discounts. No middlemen, better prices.',       num:'03', bg:'bg-blue-50',   color:'text-blue-600' },
  { icon:<Smartphone size={22}/>,   title:'Easy Ordering',         desc:'Simple, intuitive interface — order in just a few taps or clicks from any device.',            num:'04', bg:'bg-purple-50', color:'text-purple-600' },
  { icon:<ShieldCheck size={22}/>,  title:'Trusted Platform',      desc:'Secure payments, buyer protection, verified seller profiles, and dispute resolution.',          num:'05', bg:'bg-teal-50',   color:'text-teal-600' },
  { icon:<Headphones size={22}/>,   title:'24/7 Support',          desc:'Our dedicated support team is always available via chat, call, or email to help you.',          num:'06', bg:'bg-red-50',    color:'text-red-600' },
]

export default function WhyUsSection() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-2">Why Hafa Market</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">Built for <span className="text-green-primary">Farmers & Buyers</span></h2>
          <p className="text-gray-400 mt-2 max-w-md mx-auto text-sm">We make agricultural commerce simple, fast, and reliable for everyone.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.num} className={`${f.bg} rounded-2xl p-7 relative overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200`}>
              <div className={`w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center mb-4 shadow-sm ${f.color}`}>{f.icon}</div>
              <h3 className="font-extrabold text-gray-800 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              <div className="absolute bottom-4 right-5 text-5xl font-black text-black/5">{f.num}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
