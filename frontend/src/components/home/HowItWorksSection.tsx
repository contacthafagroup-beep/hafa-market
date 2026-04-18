import { useState } from 'react'

const STEPS = {
  buyers: [
    { num:'01', icon:'🔍', title:'Browse & Discover',    desc:'Search or browse thousands of fresh agricultural products by category, price, rating, or location.' },
    { num:'02', icon:'🛒', title:'Add to Cart & Pay',    desc:'Add items to your cart, choose your delivery address, and pay securely online or cash on delivery.' },
    { num:'03', icon:'📦', title:'Receive Delivery',     desc:'Sit back and relax. Track your order in real-time and receive fresh products at your door.' },
  ],
  sellers: [
    { num:'01', icon:'📝', title:'Register & Verify',   desc:'Create your seller account, verify your identity, and set up your farm store profile in minutes.' },
    { num:'02', icon:'📸', title:'List Your Products',  desc:'Upload your products with photos, descriptions, and pricing. Reach thousands of buyers instantly.' },
    { num:'03', icon:'💰', title:'Sell & Get Paid',     desc:'Receive orders, fulfill them, and get paid directly to your mobile money or bank account.' },
  ],
}

export default function HowItWorksSection() {
  const [tab, setTab] = useState<'buyers'|'sellers'>('buyers')

  return (
    <section className="py-16 bg-gradient-to-br from-green-50 to-green-100/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-2">Simple Process</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">How It <span className="text-green-primary">Works</span></h2>
          <p className="text-gray-400 mt-2 text-sm">Start shopping or selling in just 3 easy steps</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="flex bg-white rounded-full p-1 shadow-sm">
            {(['buyers','sellers'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-green-primary text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
                For {t}
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          {STEPS[tab].map((step, i) => (
            <div key={step.num} style={{ display: 'contents' }}>
              <div className="bg-white rounded-2xl p-8 text-center shadow-card flex-1 max-w-xs relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-green-primary text-white text-sm font-extrabold flex items-center justify-center shadow-lg">{step.num}</div>
                <div className="text-5xl mb-4 mt-2">{step.icon}</div>
                <h3 className="font-extrabold text-gray-800 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
              {i < STEPS[tab].length - 1 && (
                <div className="text-green-light text-2xl hidden md:block flex-shrink-0">→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
