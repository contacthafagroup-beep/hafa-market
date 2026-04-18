import { Link } from 'react-router-dom'

const DEALS = [
  { title:'Fresh Vegetables', tag:'Limited Time', desc:'Up to', highlight:'40% OFF', sub:'on all organic vegetables', emoji:'🥬🥦🥕', gradient:'from-[#1b5e20] to-[#2E7D32]', slug:'vegetables' },
  { title:'Farming Tools',    tag:'Flash Sale',   desc:'Premium tools starting from', highlight:'$9.99', sub:'', emoji:'🛠️⛏️🌿', gradient:'from-[#bf360c] to-[#e64a19]', slug:'tools' },
  { title:'Grains & Cereals', tag:'Bulk Buy',     desc:'Buy 10kg+ and save', highlight:'25%', sub:'instantly', emoji:'🌾🌽🍚', gradient:'from-[#0d47a1] to-[#1565c0]', slug:'grains' },
]

export default function DealsSection() {
  return (
    <section className="py-10 bg-white">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-5">
        {DEALS.map(d => (
          <Link key={d.title} to={`/products?category=${d.slug}`}
            className={`bg-gradient-to-br ${d.gradient} rounded-2xl p-6 flex items-center justify-between overflow-hidden relative group hover:-translate-y-1 hover:shadow-xl transition-all duration-200`}>
            <div className="text-white z-10">
              <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-2 uppercase tracking-wide">{d.tag}</span>
              <h3 className="text-lg font-extrabold mb-1">{d.title}</h3>
              <p className="text-white/80 text-sm">{d.desc} <strong className="text-white text-base">{d.highlight}</strong> {d.sub}</p>
              <span className="inline-block mt-3 bg-white text-gray-800 text-xs font-bold px-4 py-1.5 rounded-full group-hover:bg-orange-primary group-hover:text-white transition-colors">Shop Now</span>
            </div>
            <div className="text-4xl opacity-30 absolute right-4 bottom-2 text-5xl">{d.emoji}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}
