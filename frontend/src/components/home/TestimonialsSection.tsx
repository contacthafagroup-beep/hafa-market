import { useState } from 'react'

const TESTIMONIALS = [
  { stars:5, text:'"Hafa Market has completely changed how I buy vegetables. The quality is amazing and delivery is always on time. I\'ve saved so much money compared to local markets!"', name:'Amina Hassan', role:'Home Buyer · Nairobi, Kenya', avatar:'👩🏾', featured:false },
  { stars:5, text:'"As a farmer, Hafa Market gives me a direct channel to sell my produce without middlemen. My income has increased by 40% since I joined. This platform is a game changer!"', name:'Kwame Asante', role:'Farmer · Accra, Ghana', avatar:'👨🏿', featured:true },
  { stars:4, text:'"The farming tools section is incredible. I found everything I needed at prices much lower than local stores. The customer support team is also very responsive!"', name:'Ibrahim Musa', role:'Farm Owner · Lagos, Nigeria', avatar:'👨🏽', featured:false },
  { stars:5, text:'"I love how easy it is to track my orders. The real-time tracking feature gives me peace of mind. Fresh produce delivered right to my restaurant every morning!"', name:'Fatima Diallo', role:'Restaurant Owner · Dakar, Senegal', avatar:'👩🏿', featured:false },
]

export default function TestimonialsSection() {
  const [active, setActive] = useState(0)

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-2">Customer Stories</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">What Our <span className="text-green-primary">Community Says</span></h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${t.featured ? 'bg-gradient-to-br from-[#1b5e20] to-[#2E7D32] text-white' : 'bg-white shadow-card'}`}>
              <div className={`text-lg mb-3 ${t.featured ? 'text-yellow-300' : 'text-orange-400'}`}>{'★'.repeat(t.stars)}</div>
              <p className={`text-sm leading-relaxed mb-5 italic ${t.featured ? 'text-white/90' : 'text-gray-500'}`}>{t.text}</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{t.avatar}</span>
                <div>
                  <div className={`font-bold text-sm ${t.featured ? 'text-white' : 'text-gray-800'}`}>{t.name}</div>
                  <div className={`text-xs ${t.featured ? 'text-white/60' : 'text-gray-400'}`}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {TESTIMONIALS.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${active === i ? 'w-6 bg-green-primary' : 'w-2 bg-gray-300'}`} />
          ))}
        </div>
      </div>
    </section>
  )
}
