/**
 * Ethiopian Calendar (Ge'ez Calendar) converter
 * Ethiopian calendar is ~7-8 years behind Gregorian
 * Has 13 months: 12 months of 30 days + Pagume (5-6 days)
 */

const ETH_MONTHS = [
  'መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዚያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
]

const ETH_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
]

// Fasting periods (approximate Gregorian dates)
const FASTING_PERIODS = [
  { name: 'ጾመ ነቢያት (Advent Fast)', nameEn: 'Advent Fast', start: { month: 11, day: 25 }, end: { month: 0, day: 7 } },
  { name: 'ጾመ ጋድ (Gad Fast)', nameEn: 'Gad Fast', start: { month: 0, day: 7 }, end: { month: 0, day: 19 } },
  { name: 'ጾመ ፍልሰታ (Filseta)', nameEn: 'Filseta Fast', start: { month: 7, day: 1 }, end: { month: 7, day: 15 } },
]

// Fasting-appropriate product categories
const FASTING_CATEGORIES = ['vegetables', 'fruits', 'grains', 'legumes', 'spices']

export function gregorianToEthiopian(date: Date): { year: number; month: number; day: number; monthName: string; monthNameEn: string } {
  const jdn = Math.floor((date.getTime() / 86400000) + 2440587.5)
  const r = (jdn - 1723856) % 1461
  const n = r % 365 + 365 * Math.floor(r / 1460)
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460)
  const month = Math.floor(n / 30)
  const day = n % 30 + 1
  return {
    year,
    month,
    day,
    monthName: ETH_MONTHS[month] || 'ጳጉሜ',
    monthNameEn: ETH_MONTHS_EN[month] || 'Pagume',
  }
}

export function isCurrentlyFasting(): boolean {
  const now = new Date()
  const m = now.getMonth()
  const d = now.getDate()
  return FASTING_PERIODS.some(fp => {
    const start = fp.start.month * 100 + fp.start.day
    const end = fp.end.month * 100 + fp.end.day
    const current = m * 100 + d
    if (start <= end) return current >= start && current <= end
    return current >= start || current <= end
  })
}

export function getFastingCategories(): string[] {
  return isCurrentlyFasting() ? FASTING_CATEGORIES : []
}

interface Props {
  value?: string // ISO date string
  onChange: (gregorian: string, ethiopian: string) => void
  label?: string
}

export default function EthiopianCalendarPicker({ value, onChange, label }: Props) {
  const today = new Date()
  const ethToday = gregorianToEthiopian(today)
  const fasting = isCurrentlyFasting()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const greg = e.target.value
    if (!greg) return
    const date = new Date(greg)
    const eth = gregorianToEthiopian(date)
    const ethStr = `${eth.day} ${eth.monthName} ${eth.year} (${eth.monthNameEn})`
    onChange(greg, ethStr)
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}

      <input type="date" defaultValue={value}
        min={today.toISOString().split('T')[0]}
        onChange={handleChange}
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />

      {/* Ethiopian date display */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
        <span className="text-2xl">🇪🇹</span>
        <div>
          <p className="text-xs font-bold text-amber-800">Ethiopian Calendar (ዘመን ኢትዮጵያ)</p>
          <p className="text-sm font-extrabold text-amber-900">
            {value ? (() => {
              const eth = gregorianToEthiopian(new Date(value))
              return `${eth.day} ${eth.monthName} ${eth.year}`
            })() : `Today: ${ethToday.day} ${ethToday.monthName} ${ethToday.year}`}
          </p>
        </div>
      </div>

      {/* Fasting period notice */}
      {fasting && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-bold text-green-700 mb-1">🕊️ Fasting Period (ጾም)</p>
          <p className="text-xs text-green-600">Showing fasting-appropriate products. Vegetables, fruits, grains and legumes are highlighted.</p>
        </div>
      )}
    </div>
  )
}
