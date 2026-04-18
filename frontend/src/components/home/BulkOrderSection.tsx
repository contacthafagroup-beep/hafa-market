import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ChefHat, Hotel, PartyPopper, GraduationCap, Stethoscope, CheckCircle, Truck, Clock, FileText, Star, RefreshCw, Headphones } from 'lucide-react'

const ORG_TYPES = [
  { icon: <ChefHat size={20}/>,       label: 'Restaurants',  labelAm: 'ምግብ ቤቶች',    bg: '#fef2f2', color: '#ef4444' },
  { icon: <Hotel size={20}/>,         label: 'Hotels',       labelAm: 'ሆቴሎች',        bg: '#eff6ff', color: '#3b82f6' },
  { icon: <Building2 size={20}/>,     label: 'Cafes',        labelAm: 'ካፌዎች',        bg: '#fffbeb', color: '#f59e0b' },
  { icon: <PartyPopper size={20}/>,   label: 'Events',       labelAm: 'ዝግጅቶች',      bg: '#f5f3ff', color: '#8b5cf6' },
  { icon: <GraduationCap size={20}/>, label: 'Schools',      labelAm: 'ትምህርት ቤቶች',  bg: '#ecfeff', color: '#06b6d4' },
  { icon: <Stethoscope size={20}/>,   label: 'Hospitals',    labelAm: 'ሆስፒታሎች',    bg: '#f0fdf4', color: '#16a34a' },
]

const BULK_CATEGORIES = [
  { emoji:'🥬', name:'Vegetables',  nameAm:'አትክልቶች',   min:'20kg+',   discount:'15%' },
  { emoji:'🌾', name:'Grains',      nameAm:'እህሎች',      min:'50kg+',   discount:'20%' },
  { emoji:'☕', name:'Coffee',      nameAm:'ቡና',         min:'10kg+',   discount:'10%' },
  { emoji:'🥩', name:'Meat',        nameAm:'ሥጋ',         min:'10kg+',   discount:'12%' },
  { emoji:'🍯', name:'Honey',       nameAm:'ማር',         min:'5kg+',    discount:'8%'  },
  { emoji:'🥚', name:'Eggs',        nameAm:'እንቁላሎች',   min:'100pcs+', discount:'18%' },
  { emoji:'🧅', name:'Onions',      nameAm:'ሽንኩርት',    min:'25kg+',   discount:'14%' },
  { emoji:'🌿', name:'Spices',      nameAm:'ቅመሞች',      min:'5kg+',    discount:'10%' },
]

const FEATURES = [
  { icon: <Clock size={16}/>,       en: 'Custom quote in 2 hours',       am: 'በ2 ሰዓት ዋጋ ይደርሳል' },
  { icon: <RefreshCw size={16}/>,   en: 'Weekly recurring orders',        am: 'ሳምንታዊ ተደጋጋሚ ትዕዛዝ' },
  { icon: <FileText size={16}/>,    en: 'Invoice & receipt provided',     am: 'ደረሰኝ እና ሂሳብ ይሰጣል' },
  { icon: <Truck size={16}/>,       en: 'Priority delivery citywide',     am: 'ቅድሚያ ማድረስ በከተማ' },
  { icon: <Star size={16}/>,        en: 'Bulk discounts up to 20%',       am: 'እስከ 20% ቅናሽ' },
  { icon: <Headphones size={16}/>,  en: 'Dedicated account manager',      am: 'ልዩ የደንበኛ አስተዳዳሪ' },
  { icon: <CheckCircle size={16}/>, en: 'Verified quality products',      am: 'የተረጋገጠ ጥራት ያላቸው ምርቶች' },
  { icon: <Building2 size={16}/>,   en: 'Serving 500+ businesses',        am: '500+ ድርጅቶችን እናገለግላለን' },
]

const CITIES = [
  'Addis Ababa · አዲስ አበባ',
  'Hossana · ሆሳና',
  'Hawassa · ሐዋሳ',
  'Bahir Dar · ባህር ዳር',
  'Dire Dawa · ድሬ ዳዋ',
  'Mekelle · መቀሌ',
  'Gondar · ጎንደር',
  'Jimma · ጅማ',
  'Adama · አዳማ',
]

export default function BulkOrderSection() {
  return (
    <section className="py-24 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-2">
              🏢 B2B · ጅምላ ትዕዛዝ · Bulk Orders
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 mb-1">
              Order in Bulk, <span className="text-green-primary">Save More</span>
            </h2>
            <p className="text-lg font-bold text-gray-600 mb-2">
              ጅምላ ይዘዙ፣ <span className="text-green-primary">የበለጠ ይቆጥቡ</span>
            </p>
            <p className="text-gray-400 text-sm">
              For restaurants, hotels, cafes, events & organizations across Ethiopia 🇪🇹
              <br />
              <span className="text-gray-400">ለምግብ ቤቶች፣ ሆቴሎች፣ ካፌዎች፣ ዝግጅቶች እና ድርጅቶች በኢትዮጵያ</span>
            </p>
          </div>
          <Link to="/bulk-order"
            className="inline-flex items-center gap-2 bg-green-primary hover:bg-green-dark text-white px-7 py-3.5 rounded-full font-bold text-sm transition-all hover:gap-3 shadow-md flex-shrink-0">
            Get a Quote / ዋጋ ያግኙ <ArrowRight size={16}/>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-8">

            {/* Who it's for */}
            <div className="bg-white rounded-2xl shadow-card p-7">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm font-extrabold text-gray-800">Who it's for</p>
                  <p className="text-xs text-gray-400">ለማን ነው</p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {ORG_TYPES.map(o => (
                  <Link key={o.label} to={`/bulk-order?type=${o.label.toUpperCase()}`}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent hover:border-gray-200 hover:shadow-sm transition-all group text-center">
                    <div style={{ background: o.bg, color: o.color }}
                      className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm">
                      {o.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 group-hover:text-green-primary transition-colors leading-tight">{o.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{o.labelAm}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="mb-5">
                <p className="text-sm font-extrabold text-gray-800">Popular bulk categories</p>
                <p className="text-xs text-gray-400">ታዋቂ የጅምላ ምድቦች</p>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {BULK_CATEGORIES.map(c => (
                  <Link key={c.name} to={`/bulk-order?category=${c.name.toLowerCase()}`}
                    className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 hover:bg-green-50 rounded-xl transition-all group border-2 border-transparent hover:border-green-100 text-center">
                    <span className="text-2xl">{c.emoji}</span>
                    <p className="text-[11px] font-bold text-gray-700 group-hover:text-green-primary transition-colors leading-tight">{c.name}</p>
                    <p className="text-[9px] text-gray-400">{c.nameAm}</p>
                    <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">
                      -{c.discount}
                    </span>
                    <span className="text-[9px] text-gray-400">{c.min}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Cities */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="mb-4">
                <p className="text-sm font-extrabold text-gray-800">We deliver across Ethiopia</p>
                <p className="text-xs text-gray-400">በኢትዮጵያ ሁሉ እናደርሳለን</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(city => (
                  <span key={city} className="bg-green-50 border border-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    📍 {city}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right 1/3 */}
          <div className="flex flex-col gap-6">

            {/* Features */}
            <div className="bg-white rounded-2xl shadow-card p-6 flex-1">
              <div className="mb-5">
                <p className="text-sm font-extrabold text-gray-800">What you get</p>
                <p className="text-xs text-gray-400">የሚያገኙት ጥቅም</p>
              </div>
              <div className="space-y-3.5">
                {FEATURES.map(f => (
                  <div key={f.en} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-green-primary flex-shrink-0 mt-0.5">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 leading-tight">{f.en}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{f.am}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA card */}
            <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-6 text-white">
              <div className="text-4xl mb-3">🏢</div>
              <h3 className="font-extrabold text-xl mb-0.5">Ready to order?</h3>
              <p className="text-white/70 text-sm mb-1">ለማዘዝ ዝግጁ ነዎት?</p>
              <p className="text-white/60 text-xs mb-5">
                We respond within 2 hours with a custom quote.<br/>
                <span>በ2 ሰዓት ውስጥ ዋጋ ይልካሉ።</span>
              </p>
              <Link to="/bulk-order"
                className="block text-center bg-white text-green-primary font-bold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors mb-2.5">
                📋 Submit Request · ጥያቄ ያስገቡ
              </Link>
              <a href="tel:+251911000000"
                className="block text-center bg-white/10 border border-white/20 text-white font-semibold py-3 rounded-xl text-sm hover:bg-white/20 transition-colors">
                📞 Call Us · ይደውሉ
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
