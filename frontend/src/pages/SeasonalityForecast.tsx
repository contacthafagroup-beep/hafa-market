import { Link } from 'react-router-dom'
import { Calendar, TrendingUp, AlertCircle, Leaf } from 'lucide-react'

// Ethiopian agricultural calendar — based on Meher/Belg seasons
const SEASONAL_DATA = [
  {
    month: 1, name: 'January', nameAm: 'ጥር',
    available: ['Teff', 'Wheat', 'Sorghum', 'Coffee', 'Honey'],
    upcoming: ['Avocado', 'Mango'],
    scarce: ['Tomatoes', 'Onions'],
    tip: 'Post-harvest season — grain prices at yearly low. Stock up on teff and wheat.',
  },
  {
    month: 2, name: 'February', nameAm: 'የካቲት',
    available: ['Teff', 'Wheat', 'Coffee', 'Honey', 'Avocado'],
    upcoming: ['Mango', 'Papaya'],
    scarce: ['Vegetables'],
    tip: 'Avocado season begins. Coffee harvest wraps up — buy before prices rise.',
  },
  {
    month: 3, name: 'March', nameAm: 'መጋቢት',
    available: ['Avocado', 'Mango', 'Coffee', 'Teff'],
    upcoming: ['Tomatoes', 'Peppers'],
    scarce: ['Grains'],
    tip: 'Belg rains begin. Mango season peaks — great time for fruit sellers.',
  },
  {
    month: 4, name: 'April', nameAm: 'ሚያዚያ',
    available: ['Mango', 'Avocado', 'Papaya', 'Banana'],
    upcoming: ['Tomatoes', 'Onions', 'Cabbage'],
    scarce: ['Teff', 'Wheat'],
    tip: 'Easter (Fasika) season — demand for all food products spikes. Increase stock.',
  },
  {
    month: 5, name: 'May', nameAm: 'ግንቦት',
    available: ['Tomatoes', 'Onions', 'Mango', 'Watermelon'],
    upcoming: ['Maize', 'Sorghum'],
    scarce: ['Teff'],
    tip: 'Vegetable season in full swing. Watermelon demand peaks with heat.',
  },
  {
    month: 6, name: 'June', nameAm: 'ሰኔ',
    available: ['Tomatoes', 'Onions', 'Cabbage', 'Watermelon'],
    upcoming: ['Maize'],
    scarce: ['Fruits'],
    tip: 'Kiremt (rainy season) begins. Vegetable prices drop — good for buyers.',
  },
  {
    month: 7, name: 'July', nameAm: 'ሐምሌ',
    available: ['Maize', 'Sorghum', 'Vegetables'],
    upcoming: ['Teff harvest'],
    scarce: ['Fruits', 'Coffee'],
    tip: 'Heavy rains. Delivery challenges — plan logistics carefully.',
  },
  {
    month: 8, name: 'August', nameAm: 'ነሐሴ',
    available: ['Maize', 'Sorghum', 'Vegetables'],
    upcoming: ['Teff', 'Wheat harvest'],
    scarce: ['Fruits'],
    tip: 'Pre-harvest season. Grain prices at yearly high — sell remaining stock now.',
  },
  {
    month: 9, name: 'September', nameAm: 'መስከረም',
    available: ['Teff', 'Wheat', 'Maize', 'Honey'],
    upcoming: ['Coffee harvest'],
    scarce: [],
    tip: 'Ethiopian New Year (Enkutatash) — huge demand spike. Prepare extra stock!',
  },
  {
    month: 10, name: 'October', nameAm: 'ጥቅምት',
    available: ['Teff', 'Wheat', 'Sorghum', 'Honey', 'Coffee'],
    upcoming: ['Avocado'],
    scarce: [],
    tip: 'Meher harvest peak. Best time to buy grains in bulk at lowest prices.',
  },
  {
    month: 11, name: 'November', nameAm: 'ህዳር',
    available: ['Teff', 'Coffee', 'Honey', 'Avocado'],
    upcoming: ['Mango'],
    scarce: ['Vegetables'],
    tip: 'Coffee harvest in full swing. Ethiopian coffee at peak freshness.',
  },
  {
    month: 12, name: 'December', nameAm: 'ታህሳስ',
    available: ['Coffee', 'Teff', 'Honey', 'Avocado'],
    upcoming: ['Mango', 'Papaya'],
    scarce: ['Vegetables'],
    tip: 'Christmas (Genna) season — demand for all products peaks. Stock up early!',
  },
]

const PRODUCT_SEASONS: Record<string, { peak: number[]; available: number[]; emoji: string }> = {
  'Teff':       { peak: [9,10,11,12,1,2], available: [1,2,9,10,11,12], emoji: '🌾' },
  'Coffee':     { peak: [10,11,12,1],     available: [10,11,12,1,2],   emoji: '☕' },
  'Mango':      { peak: [3,4,5],          available: [2,3,4,5,6],      emoji: '🥭' },
  'Avocado':    { peak: [2,3,4,10,11],    available: [2,3,4,5,10,11,12], emoji: '🥑' },
  'Honey':      { peak: [9,10,11],        available: [9,10,11,12,1],   emoji: '🍯' },
  'Tomatoes':   { peak: [4,5,6],          available: [3,4,5,6,7],      emoji: '🍅' },
  'Watermelon': { peak: [5,6,7],          available: [4,5,6,7],        emoji: '🍉' },
  'Wheat':      { peak: [9,10,11],        available: [9,10,11,12,1,2], emoji: '🌾' },
}

export default function SeasonalityForecast() {
  const currentMonth = new Date().getMonth() + 1
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const currentData = SEASONAL_DATA.find(d => d.month === currentMonth)!
  const nextData = SEASONAL_DATA.find(d => d.month === nextMonth)!

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
          <Leaf size={16} className="text-green-primary" />
          <span className="text-xs font-bold text-green-primary uppercase tracking-wide">Ethiopian Agricultural Calendar</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">🌿 Seasonality Forecast</h1>
        <p className="text-gray-400 max-w-xl mx-auto text-sm">
          Know what's in season, what's coming, and when to buy or sell for maximum value.
        </p>
      </div>

      {/* Current + Next Month */}
      <div className="grid sm:grid-cols-2 gap-5 mb-8">
        {/* This month */}
        <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} />
            <span className="font-extrabold">This Month — {currentData.name}</span>
            <span className="text-white/60 text-sm">{currentData.nameAm}</span>
          </div>
          <div className="mb-3">
            <p className="text-xs text-white/60 uppercase tracking-wide mb-2">✅ In Season Now</p>
            <div className="flex flex-wrap gap-1.5">
              {currentData.available.map(item => (
                <span key={item} className="bg-white/20 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  {PRODUCT_SEASONS[item]?.emoji || '🌿'} {item}
                </span>
              ))}
            </div>
          </div>
          {currentData.scarce.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-white/60 uppercase tracking-wide mb-2">⚠️ Scarce / High Price</p>
              <div className="flex flex-wrap gap-1.5">
                {currentData.scarce.map(item => (
                  <span key={item} className="bg-red-400/30 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white/10 rounded-xl p-3 mt-3">
            <p className="text-xs text-white/80">💡 {currentData.tip}</p>
          </div>
        </div>

        {/* Next month */}
        <div className="bg-white rounded-2xl shadow-card p-5 border-2 border-orange-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-orange-500" />
            <span className="font-extrabold text-gray-900">Coming Next — {nextData.name}</span>
            <span className="text-gray-400 text-sm">{nextData.nameAm}</span>
          </div>
          <div className="mb-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">🔜 Coming Into Season</p>
            <div className="flex flex-wrap gap-1.5">
              {nextData.upcoming.map(item => (
                <span key={item} className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-full">
                  {PRODUCT_SEASONS[item]?.emoji || '🌿'} {item}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 mt-3">
            <p className="text-xs text-orange-700">💡 {nextData.tip}</p>
          </div>
          <Link to="/account/seasonal-alerts"
            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline">
            🔔 Set alerts for upcoming products →
          </Link>
        </div>
      </div>

      {/* Product Seasonality Calendar */}
      <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
        <h3 className="font-extrabold text-gray-900 mb-5">📅 Product Availability Calendar</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-gray-500 font-bold w-28">Product</th>
                {SEASONAL_DATA.map(m => (
                  <th key={m.month} className={`py-2 px-1 text-center font-bold w-8 ${m.month === currentMonth ? 'text-green-primary' : 'text-gray-400'}`}>
                    {m.name.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PRODUCT_SEASONS).map(([product, data]) => (
                <tr key={product} className="border-t border-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-700">
                    {data.emoji} {product}
                  </td>
                  {SEASONAL_DATA.map(m => {
                    const isPeak = data.peak.includes(m.month)
                    const isAvailable = data.available.includes(m.month)
                    const isCurrent = m.month === currentMonth
                    return (
                      <td key={m.month} className="py-2 px-1 text-center">
                        <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center text-[10px] font-bold ${
                          isPeak ? 'bg-green-primary text-white' :
                          isAvailable ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-300'
                        } ${isCurrent ? 'ring-2 ring-offset-1 ring-green-primary' : ''}`}>
                          {isPeak ? '●' : isAvailable ? '○' : '·'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-primary inline-block" /> Peak season</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-100 border border-green-300 inline-block" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-gray-100 inline-block" /> Off season</span>
        </div>
      </div>

      {/* Full year calendar */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SEASONAL_DATA.map(month => (
          <div key={month.month} className={`bg-white rounded-2xl shadow-card p-4 ${month.month === currentMonth ? 'border-2 border-green-primary' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-extrabold text-gray-900">{month.name}</p>
                <p className="text-xs text-gray-400">{month.nameAm}</p>
              </div>
              {month.month === currentMonth && (
                <span className="text-xs font-bold text-green-primary bg-green-50 px-2 py-0.5 rounded-full">Now</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {month.available.slice(0, 4).map(item => (
                <span key={item} className="text-[10px] bg-green-50 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                  {item}
                </span>
              ))}
              {month.available.length > 4 && (
                <span className="text-[10px] text-gray-400">+{month.available.length - 4}</span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 italic">{month.tip.slice(0, 60)}...</p>
          </div>
        ))}
      </div>
    </div>
  )
}
