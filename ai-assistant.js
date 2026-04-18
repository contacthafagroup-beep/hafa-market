'use strict';
// ===== HAFA AI KNOWLEDGE BASE =====
const HAFA_KB = {
  categories: [
    'Fresh Produce: Vegetables (Tomatoes, Onions, Cabbage, Carrots, Potatoes, Green Beans, Peppers, Eggplant, Beetroots, Lettuce, Spinach, Kale, Garlic)',
    'Fresh Produce: Fruits (Avocado, Banana, Mango, Papaya, Pineapple, Orange, Lemon, Watermelon, Guava, Grapes)',
    'Grains (Teff, Wheat, Maize, Barley, Sorghum)',
    'Legumes (Beans, Lentils, Chickpeas, Peas, Soybeans)',
    'Spices & Herbs (Turmeric, Ginger, Cardamom, Black Pepper, Cloves, Cinnamon, Fenugreek, Basil, Mint)',
    'Poultry & Dairy (Eggs, Milk, Chicken)',
    'Livestock & Meat (Cattle, Sheep, Goats, Beef, Mutton, Goat Meat)',
    'Coffee & Beverages (Roasted Coffee, Raw Coffee)',
    'Specialty Products (Honey, Moringa, Aloe Vera, Natural Products)',
    'Processed & Ready Foods (ዶሮ ወጥ / Doro Wot, Processed Chicken, Snacks, Injera)',
    'Household & Essentials (Detergents, Cleaning Products, Household Items)',
    'Services / አገልግሎት (Delivery, Logistics, Marketplace Services)',
  ],
  delivery: { time:'24–48 hours', free:'$50+', cities:'30+ cities across Africa', tracking:'Real-time via app & SMS' },
  payment: ['Credit/Debit Card','Mobile Money (M-Pesa, MTN MoMo)','Cash on Delivery','PayPal'],
  returns: { days:7, refund:'3–5 business days', condition:'Unused, original condition' },
  support: { hours:'Mon–Sat 8am–8pm', phone:'+254 700 000 000', email:'hello@hafamarket.com', response:'2 hours' },
  deals: { promo:'HAFA10 = 10% off first order', flash:'Every Friday', current:'40% off vegetables, tools from $9.99, 25% bulk grains' },
  stats: { customers:'50,000+', products:'10,000+', farmers:'500+', cities:'30+', satisfaction:'98%' },
  seller: { steps:['Register & verify','List products','Receive orders','Get paid to mobile money/bank'], commission:'Low rates, direct payouts' },
};

// ===== LANGUAGES =====
const LANGS = {
  en:{ name:'English', flag:'🇬🇧', dir:'ltr',
    greeting:"Hi! I'm **Hafa AI** 🌿 — your smart agricultural shopping assistant. I know everything about Hafa Market! Ask me about products, delivery, deals, or anything else.",
    placeholder:'Ask me anything... (products, delivery, deals)',
    thinking:'Thinking...', listening:'Listening... speak now 🎤', send:'Send',
    suggestions:['What products do you sell?','How does delivery work?','How do I become a seller?',"What are today's deals?",'How do I track my order?'],
  },
  am:{ name:'አማርኛ', flag:'🇪🇹', dir:'ltr',
    greeting:'ሰላም! እኔ **ሃፋ AI** ነኝ 🌿 — የእርስዎ ብልህ የግብርና ግዢ ረዳት። ስለ ሃፋ ማርኬት ሁሉንም ነገር አውቃለሁ!',
    placeholder:'ማንኛውንም ጥያቄ ይጠይቁ...',
    thinking:'እያሰብኩ ነው...', listening:'እያዳመጥኩ ነው... አሁን ይናገሩ 🎤', send:'ላክ',
    suggestions:['ምን ምርቶች ይሸጣሉ?','ዕቃ ማድረስ እንዴት ይሰራል?','ሻጭ እንዴት መሆን ይቻላል?','የዛሬ ቅናሾች ምንድናቸው?'],
  },
  om:{ name:'Afaan Oromoo', flag:'🇪🇹', dir:'ltr',
    greeting:"Akkam! Ani **Hafa AI** 🌿 — gargaaraa bitachuu kee. Waa'ee Hafa Market hunda beeka!",
    placeholder:'Gaaffii kamiiyyuu gaafadhu...',
    thinking:'Yaadaa jira...', listening:'Dhaggeeffachaa jira... amma dubbadhu 🎤', send:'Ergi',
    suggestions:['Meeshaalee maal gurgurtu?','Geejjibni akkamitti hojjeta?','Gurgurtaa ta\'uu akkamitti?','Hir\'inni har\'aa maali?'],
  },
  sw:{ name:'Kiswahili', flag:'🇰🇪', dir:'ltr',
    greeting:'Habari! Mimi ni **Hafa AI** 🌿 — msaidizi wako wa ununuzi wa kilimo. Najua kila kitu kuhusu Hafa Market!',
    placeholder:'Uliza chochote...',
    thinking:'Nafikiri...', listening:'Sikiliza... sema sasa 🎤', send:'Tuma',
    suggestions:['Mnauza bidhaa gani?','Uwasilishaji unafanyaje?','Ninawezaje kuwa muuzaji?','Ofa za leo ni zipi?'],
  },
  fr:{ name:'Français', flag:'🇫🇷', dir:'ltr',
    greeting:"Bonjour! Je suis **Hafa AI** 🌿 — votre assistant shopping agricole. Je connais tout sur Hafa Market!",
    placeholder:'Posez n\'importe quelle question...',
    thinking:'Je réfléchis...', listening:'J\'écoute... parlez maintenant 🎤', send:'Envoyer',
    suggestions:['Quels produits vendez-vous?','Comment fonctionne la livraison?','Comment devenir vendeur?','Quelles sont les offres?'],
  },
  ar:{ name:'العربية', flag:'🇸🇦', dir:'rtl',
    greeting:'مرحباً! أنا **Hafa AI** 🌿 — مساعدك الذكي للتسوق الزراعي. أعرف كل شيء عن Hafa Market!',
    placeholder:'اسألني أي شيء...',
    thinking:'أفكر...', listening:'أستمع... تحدث الآن 🎤', send:'إرسال',
    suggestions:['ما المنتجات التي تبيعونها؟','كيف يعمل التوصيل؟','كيف أصبح بائعاً؟','ما هي عروض اليوم؟'],
  },
};

// ===== RESPONSE ENGINE =====
function getAIResponse(msg, lang) {
  const m = msg.toLowerCase();
  const L = lang || 'en';
  const responses = {
    en: {
      product: `🛒 **Hafa Market Products:**\n\nWe offer **10,000+ products** across these categories:\n\n🥬 **Vegetables** — Tomatoes, Onions, Cabbage, Carrots, Potatoes, Peppers, Spinach, Kale, Garlic...\n🍎 **Fruits** — Avocado, Banana, Mango, Papaya, Pineapple, Orange, Watermelon, Guava...\n🌾 **Grains** — Teff, Wheat, Maize, Barley, Sorghum\n🫘 **Legumes** — Beans, Lentils, Chickpeas, Peas, Soybeans\n🌿 **Spices & Herbs** — Turmeric, Ginger, Cardamom, Black Pepper, Cinnamon...\n🥚 **Poultry & Dairy** — Eggs, Milk, Chicken\n🥩 **Meat** — Beef, Mutton, Goat Meat\n☕ **Coffee** — Roasted & Raw Ethiopian Coffee\n🍯 **Specialty** — Honey, Moringa, Aloe Vera\n🍲 **Processed Foods** — ዶሮ ወጥ (Doro Wot), Injera, Snacks\n🏠 **Household** — Detergents, Cleaning Products\n🚚 **Services** — Delivery, Logistics\n\nAll sourced from **500+ verified local farmers**. What are you looking for?`,
      delivery: `📦 **Delivery Information:**\n\n⏱️ **Delivery Time:** 24–48 hours to your doorstep\n🚚 **Free Delivery** on all orders over $50\n📍 **Coverage:** 30+ cities across Africa (Nairobi, Accra, Lagos, Dakar...)\n📱 **Real-time Tracking** via app and SMS notifications\n🏠 **Options:** Home delivery or pickup points\n\n💡 Tip: Use code **HAFA10** for 10% off your first order!`,
      payment: `💳 **Payment Methods:**\n\n✅ Credit/Debit Card (Visa, Mastercard)\n✅ Mobile Money — M-Pesa, MTN MoMo, Airtel Money\n✅ Cash on Delivery\n✅ PayPal\n\n🔒 **Security:** All payments are SSL encrypted with 100% buyer protection.\n💱 **Currencies:** USD, KES, GHS, NGN supported`,
      seller: `🌿 **Become a Seller on Hafa Market:**\n\n**Why sell with us?**\n• Access to 50,000+ buyers across Africa\n• Low commission rates\n• Direct payouts to mobile money or bank\n• Free marketing & analytics dashboard\n• Dedicated seller support\n\n**How to start:**\n1️⃣ Click "Become a Seller" button\n2️⃣ Fill in your farm/business details\n3️⃣ Verify your identity (takes 24hrs)\n4️⃣ Set up your store & upload products\n5️⃣ Start receiving orders!\n\nShall I open the seller registration form for you?`,
      deal: `🔥 **Today's Deals & Offers:**\n\n🥬 Up to **40% OFF** on all organic vegetables\n🛠️ Farming tools starting from just **$9.99**\n🌾 Buy 10kg+ grains and save **25%** instantly\n\n🎁 **Promo Code:** Use **HAFA10** for 10% off your first order!\n⚡ **Flash Sales:** Every Friday — massive discounts!\n📧 Subscribe to our newsletter to never miss a deal.`,
      return: `↩️ **Return & Refund Policy:**\n\n✅ **7-day** return window from delivery date\n📸 For damaged items: contact us within 24 hours with a photo\n💰 Refund processed within **3–5 business days**\n📦 Free return shipping on damaged/wrong items\n🔄 Replacement available for damaged products\n\n📞 Contact support: hello@hafamarket.com or +254 700 000 000`,
      support: `📞 **Customer Support:**\n\n🕐 **Hours:** Monday–Saturday, 8am–8pm\n📱 **Phone:** +254 700 000 000\n📧 **Email:** hello@hafamarket.com\n💬 **Live Chat:** Right here with me!\n📱 **WhatsApp:** +254 700 000 000\n⚡ **Response Time:** Within 2 hours\n\nI'm available 24/7 to answer your questions! What else can I help you with?`,
      track: `📍 **Order Tracking:**\n\n1. Log into your Hafa Market account\n2. Go to "My Orders"\n3. Click on your order to see real-time status\n\n**Order Statuses:**\n✅ Order Placed → ✅ Processing → 🚚 On the Way → 📦 Delivered\n\nYou'll also receive **SMS & email notifications** at every step. Need help with a specific order?`,
      account: `👤 **Account Benefits:**\n\n✅ Full order history & one-click reorder\n✅ Save multiple delivery addresses\n✅ Wishlist — save products for later\n✅ Loyalty points & rewards\n✅ Exclusive member-only deals\n✅ Faster checkout\n✅ Manage returns & refunds\n\n🆓 Creating an account is **completely free** and takes less than 2 minutes!\nWant me to open the signup form?`,
      quality: `⭐ **Quality Guarantee:**\n\n✅ All products verified before listing\n🌿 Certified organic options available\n🚜 Sourced directly from 500+ trusted farmers\n📦 Fresh delivery — same/next day\n🔄 7-day return if not satisfied\n🏆 **98% customer satisfaction rate**\n\nEvery seller on Hafa Market is verified and rated by real buyers.`,
      price: `💰 **Pricing at Hafa Market:**\n\nSome popular prices:\n🥦 Broccoli — **$2.99/kg**\n🍅 Tomatoes — **$1.99/kg**\n🥕 Carrots — **$1.49/kg**\n🥭 Mangoes — **$4.49/kg**\n🌾 Wheat 5kg — **$7.99**\n🍚 Rice 10kg — **$14.99**\n⛏️ Garden Hoe — **$12.99**\n\n💡 Use code **HAFA10** for 10% off your first order!\n🚚 Free delivery on orders over **$50**`,
      about: `🌍 **About Hafa Market:**\n\nHafa Market is Africa's premier agricultural e-commerce platform, connecting farmers directly with buyers.\n\n📊 **Our Numbers:**\n• 50,000+ happy customers\n• 500+ verified farmers\n• 10,000+ products listed\n• 30+ cities covered\n• 98% satisfaction rate\n• Founded in 2024\n\n🌱 **Our Mission:** Make fresh, quality agricultural products accessible and affordable for everyone while empowering local farmers.\n\n📍 **Locations:** Nairobi, Accra, Lagos, Dakar and expanding!`,
      hello: `👋 Hello! I'm **Hafa AI** 🌿, your smart agricultural shopping assistant!\n\nI can help you with:\n🛒 Finding products & prices\n📦 Delivery information\n💳 Payment options\n🌿 Becoming a seller\n🔥 Current deals & promo codes\n📞 Customer support\n📍 Order tracking\n⭐ Quality & returns\n\nWhat would you like to know today?`,
    },
    am: {
      product: `🛒 **የሃፋ ማርኬት ምርቶች:**\n\nበ5 ምድቦች **10,000+ ምርቶች** እናቀርባለን:\n\n🥬 **አትክልቶች** — 240+ ዕቃዎች (ብሮኮሊ $2.99, ቲማቲም $1.99...)\n🍎 **ፍራፍሬዎች** — 180+ ዕቃዎች (ማንጎ $4.49, ፖም $3.29...)\n🌾 **እህሎች** — 120+ ዕቃዎች (ስንዴ 5ኪ $7.99, ሩዝ 10ኪ $14.99...)\n🌱 **ዘሮች እና ማዳበሪያዎች** — 95+ ዕቃዎች\n🛠️ **የእርሻ መሳሪያዎች** — 310+ ዕቃዎች\n\nሁሉም ምርቶች ከ**500+ ተረጋጋጭ ገበሬዎች** ቀጥታ ናቸው።`,
      delivery: `📦 **የማድረስ መረጃ:**\n\n⏱️ **ጊዜ:** ወደ በሩ 24–48 ሰዓታት\n🚚 ከ$50 በላይ ለሆኑ ትዕዛዞች **ነፃ ማድረስ**\n📍 **ሽፋን:** በአፍሪካ 30+ ከተሞች\n📱 **ቀጥታ ክትትል** በአፕ እና SMS\n\n💡 ለ10% ቅናሽ **HAFA10** ኮድ ይጠቀሙ!`,
      payment: `💳 **የክፍያ ዘዴዎች:**\n\n✅ ክሬዲት/ዴቢት ካርድ\n✅ ሞባይል ሞኒ (M-Pesa, MTN MoMo)\n✅ ሲደርስ ክፍያ\n✅ PayPal\n\n🔒 ሁሉም ክፍያዎች **100% ደህንነቱ የተጠበቀ** ነው።`,
      deal: `🔥 **የዛሬ ቅናሾች:**\n\n🥬 ሁሉም ኦርጋኒክ አትክልቶች እስከ **40% ቅናሽ**\n🛠️ የእርሻ መሳሪያዎች ከ**$9.99** ጀምሮ\n🌾 10 ኪሎ+ እህሎች ሲገዙ **25% ቅናሽ**\n\n🎁 **HAFA10** ኮድ ለ10% ቅናሽ ይጠቀሙ!`,
      seller: `🌿 **በሃፋ ማርኬት ሻጭ ይሁኑ:**\n\n1️⃣ "ሻጭ ይሁኑ" ቁልፍ ይጫኑ\n2️⃣ የእርሻ/ንግድ ዝርዝሮችዎን ይሙሉ\n3️⃣ ማንነትዎን ያረጋግጡ\n4️⃣ መደብርዎን ያዋቅሩ\n5️⃣ ለ50,000+ ገዢዎች መሸጥ ይጀምሩ!\n\n💰 ዝቅተኛ ኮሚሽን፣ ቀጥታ ክፍያ ወደ ሞባይል ሞኒ ወይም ባንክ።`,
      hello: `👋 ሰላም! እኔ **ሃፋ AI** ነኝ 🌿\n\nበሚከተሉት ነገሮች ልረዳዎ እችላለሁ:\n🛒 ምርቶችን ማግኘት\n📦 የማድረስ መረጃ\n💳 የክፍያ አማራጮች\n🌿 ሻጭ መሆን\n🔥 አሁን ያሉ ቅናሾች\n\nምን ማወቅ ይፈልጋሉ?`,
      support: `📞 **የደንበኛ ድጋፍ:**\n\n🕐 ሰዓታት: ሰኞ–ቅዳሜ፣ ጠዋት 8–ምሽት 8\n📱 ስልክ: +254 700 000 000\n📧 ኢሜይል: hello@hafamarket.com\n⚡ የምላሽ ጊዜ: በ2 ሰዓት ውስጥ`,
      return: `↩️ **የመመለስ ፖሊሲ:**\n\n✅ **7 ቀን** የመመለስ ጊዜ\n📸 ከፎቶ ጋር ድጋፍን ያነጋግሩ\n💰 ገንዘብ ተመላሽ በ**3–5 የስራ ቀናት**`,
      track: `📍 **ትዕዛዝ ክትትል:**\n\n1. ወደ ሂሳብዎ ይግቡ\n2. "የእኔ ትዕዛዞች" ይሂዱ\n3. ትዕዛዝዎን ጠቅ ያድርጉ\n\nSMS እና ኢሜይል ማሳወቂያዎችም ይደርሱዎታል።`,
      quality: `⭐ **የጥራት ዋስትና:**\n\n✅ ሁሉም ምርቶች ከዝርዝር በፊት ተረጋግጠዋል\n🌿 የተረጋገጡ ኦርጋኒክ አማራጮች\n🚜 ከ500+ ታማኝ ገበሬዎች ቀጥታ\n\n**98% የደንበኛ እርካታ ደረጃ** አለን!`,
      price: `💰 **ዋጋዎች:**\n\n🥦 ብሮኮሊ — **$2.99/ኪ**\n🍅 ቲማቲም — **$1.99/ኪ**\n🥕 ካሮት — **$1.49/ኪ**\n🥭 ማንጎ — **$4.49/ኪ**\n🌾 ስንዴ 5ኪ — **$7.99**\n\n💡 **HAFA10** ኮድ ለ10% ቅናሽ!`,
      about: `🌍 **ስለ ሃፋ ማርኬት:**\n\nሃፋ ማርኬት ገበሬዎችን ቀጥታ ከገዢዎች ጋር የሚያገናኝ የአፍሪካ ዋና የግብርና ኢ-ኮሜርስ መድረክ ነው።\n\n📊 **ቁጥሮቻችን:**\n• 50,000+ ደስተኛ ደንበኞች\n• 500+ ተረጋጋጭ ገበሬዎች\n• 10,000+ ምርቶች\n• 30+ ከተሞች\n• 98% እርካታ ደረጃ`,
      account: `👤 **የሂሳብ ጥቅሞች:**\n\n✅ የትዕዛዝ ታሪክ\n✅ የተቀመጡ አድራሻዎች\n✅ ዊሽሊስት\n✅ የታማኝነት ነጥቦች\n\nሂሳብ መፍጠር **ነፃ** ነው!`,
    },
  };

  // Copy en responses to other langs if missing
  ['om','sw','fr','ar'].forEach(l => {
    if (!responses[l]) responses[l] = { ...responses.en };
  });
  responses.om = {
    ...responses.en,
    hello: `👋 Akkam! Ani **Hafa AI** 🌿\n\nKan armaan gadii irratti si gargaaruu danda\'a:\n🛒 Meeshaalee argachuu\n📦 Odeeffannoo geejjibaa\n💳 Filannoo kaffaltii\n🌿 Gurgurtaa ta\'uu\n\nMaal beekuu barbaaddaa?`,
    product: `🛒 **Meeshaalee Hafa Market:**\n\nKutaalee 5 keessatti meeshaalee **10,000+** dhiyeessina:\n\n🥬 **Kuduraalee** — 240+\n🍎 **Fuduraalee** — 180+\n🌾 **Midhaan** — 120+\n🌱 **Sanyii fi Xaa\'oo** — 95+\n🛠️ **Meeshaalee Qonnaa** — 310+`,
    deal: `🔥 **Hir\'ina Har\'aa:**\n\n🥬 Kuduraalee hunda irratti hir\'ina **40%**\n🛠️ Meeshaalee qonnaa **$9.99** irraa\n🌾 Midhaan kg 10+ bituu fi **25%** qusadhu\n\n🎁 Koodii **HAFA10** fayyadami!`,
  };

  const r = responses[L] || responses.en;

  if (/hello|hi|hey|salam|selam|akkam|habari|bonjour|مرحب/i.test(m)) return r.hello || responses.en.hello;
  if (/product|item|sell|categor|vegetab|fruit|grain|seed|tool|meeshaa|kuduraa|ምርት|bidhaa|produit|منتج/i.test(m)) return r.product || responses.en.product;
  if (/deliver|ship|fast|time|when|geejjib|ማድረስ|uwasilish|livraison|توصيل/i.test(m)) return r.delivery || responses.en.delivery;
  if (/pay|payment|money|mpesa|card|cash|kaffalt|ክፍያ|malipo|paiement|دفع/i.test(m)) return r.payment || responses.en.payment;
  if (/sell|seller|farm|vendor|gurgurt|ሻጭ|muuzaji|vendeur|بائع/i.test(m)) return r.seller || responses.en.seller;
  if (/deal|discount|offer|promo|sale|coupon|hir\'in|ቅናሽ|ofa|offre|عرض/i.test(m)) return r.deal || responses.en.deal;
  if (/return|refund|broken|damage|wrong|deebis|መመለስ|rudisha|retour|إرجاع/i.test(m)) return r.return || responses.en.return;
  if (/support|help|contact|phone|email|gargaar|ድጋፍ|msaada|support|دعم/i.test(m)) return r.support || responses.en.support;
  if (/track|order|status|where|kuttaa|ክትትል|fuatilia|suivi|تتبع/i.test(m)) return r.track || responses.en.track;
  if (/account|login|signup|register|herrega|ሂሳብ|akaunti|compte|حساب/i.test(m)) return r.account || responses.en.account;
  if (/quality|organic|fresh|certif|qulqull|ጥራት|ubora|qualité|جودة/i.test(m)) return r.quality || responses.en.quality;
  if (/price|cost|cheap|afford|baasii|ዋጋ|bei|prix|سعر/i.test(m)) return r.price || responses.en.price;
  if (/about|who|what is|hafa|company|waa\'ee|ስለ|kuhusu|à propos|عن/i.test(m)) return r.about || responses.en.about;

  // Default
  const defaults = {
    en: `I'm not sure about that specific question, but I'm here to help! 😊\n\nHafa Market is your one-stop agricultural marketplace with **10,000+ products**, fast delivery, and **500+ verified farmers**.\n\nTry asking me about:\n• 🛒 Products & prices\n• 📦 Delivery & tracking\n• 💳 Payment methods\n• 🔥 Current deals\n• 🌿 Becoming a seller\n• 📞 Customer support`,
    am: `ስለዚህ ጥያቄ እርግጠኛ አይደለሁም፣ ግን ልረዳዎ ዝግጁ ነኝ! 😊\n\nስለ ምርቶች፣ ማድረስ፣ ክፍያ ወይም ሻጭ መሆን ይጠይቁ።`,
    om: `Gaaffii sana irratti mirkana\'aa miti, garuu si gargaaruuf qophaa\'a dha! 😊\n\nWaa\'ee meeshaalee, geejjibaa, kaffaltii ykn gurgurtaa ta\'uu gaafadhu.`,
    sw: `Sijui kuhusu swali hilo haswa, lakini niko hapa kukusaidia! 😊\n\nJaribu kuuliza kuhusu bidhaa, uwasilishaji, malipo au kuwa muuzaji.`,
    fr: `Je ne suis pas sûr de cette question, mais je suis là pour vous aider! 😊\n\nEssayez de demander sur les produits, la livraison, le paiement ou comment devenir vendeur.`,
    ar: `لست متأكداً من هذا السؤال، لكنني هنا للمساعدة! 😊\n\nجرب السؤال عن المنتجات أو التوصيل أو الدفع أو كيفية أن تصبح بائعاً.`,
  };
  return defaults[L] || defaults.en;
}

// ===== AI STATE =====
let aiLang = 'en';
let aiOpen = false;
let aiMessages = [];
let aiRecognition = null;
let aiListening = false;
let aiTypingTimer = null;

// ===== WHATSAPP CONFIG =====
const WA_NUMBER = '254700000000'; // replace with real number
const WA_MESSAGE = encodeURIComponent('Hello! I need help with Hafa Market 🌿');

function openWhatsApp() {
  window.open(`https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`, '_blank');
  closeLauncher();
}

let launcherOpen = false;
function toggleLauncher() {
  launcherOpen = !launcherOpen;
  document.getElementById('launcherMenu').classList.toggle('open', launcherOpen);
  document.getElementById('launcherMainBtn').classList.toggle('rotated', launcherOpen);
}
function closeLauncher() {
  launcherOpen = false;
  document.getElementById('launcherMenu').classList.remove('open');
  document.getElementById('launcherMainBtn').classList.remove('rotated');
}
function openAIFromLauncher() {
  closeLauncher();
  if (!aiOpen) toggleAI();
}

// ===== BUILD AI WIDGET HTML =====
function buildAIWidget() {
  const widget = document.createElement('div');
  widget.id = 'hafaAI';
  widget.innerHTML = `

  <!-- ===== AI TRIGGER BUTTON ===== -->
  <button class="ai-trigger-btn" id="aiTriggerBtn" onclick="toggleAI()" aria-label="Open Hafa AI Assistant">
    <span class="ai-trigger-emoji">🤖</span>
    <span class="ai-trigger-lbl">Hafa AI</span>
    <span class="ai-trigger-ring"></span>
    <span class="ai-notif" id="aiNotif">1</span>
  </button>

  <!-- Chat Window -->
  <div class="ai-window" id="aiWindow">
    <!-- Header -->
    <div class="ai-header">
      <div class="ai-header-left">
        <div class="ai-avatar">🤖</div>
        <div class="ai-header-info">
          <strong>Hafa AI Assistant</strong>
          <span class="ai-status"><span class="ai-dot"></span> Online — Always here</span>
        </div>
      </div>
      <div class="ai-header-actions">
        <!-- Language Selector -->
        <div class="ai-lang-wrap">
          <button class="ai-lang-btn" id="aiLangBtn" onclick="toggleLangMenu()" title="Change Language">
            <span id="aiLangFlag">🇬🇧</span>
            <i class="fas fa-chevron-down" style="font-size:.6rem"></i>
          </button>
          <div class="ai-lang-menu" id="aiLangMenu">
            ${Object.entries(LANGS).map(([k,v]) => `<button onclick="setAILang('${k}')" class="ai-lang-opt ${k==='en'?'active':''}">${v.flag} ${v.name}</button>`).join('')}
          </div>
        </div>
        <button class="ai-header-btn" onclick="clearAIChat()" title="Clear chat"><i class="fas fa-trash"></i></button>
        <button class="ai-header-btn" onclick="toggleAI()" title="Close"><i class="fas fa-times"></i></button>
      </div>
    </div>

    <!-- Messages -->
    <div class="ai-messages" id="aiMessages"></div>

    <!-- Suggestions -->
    <div class="ai-suggestions" id="aiSuggestions"></div>

    <!-- Image Preview -->
    <div class="ai-img-preview" id="aiImgPreview" style="display:none">
      <img id="aiPreviewImg" src="" alt="preview" />
      <button onclick="clearImagePreview()"><i class="fas fa-times"></i></button>
    </div>

    <!-- Input Area -->
    <div class="ai-input-area">
      <div class="ai-input-wrap">
        <button class="ai-input-btn" onclick="triggerImageUpload()" title="Send image"><i class="fas fa-image"></i></button>
        <input type="file" id="aiImageInput" accept="image/*" style="display:none" onchange="handleImageUpload(event)" />
        <textarea class="ai-textarea" id="aiInput" placeholder="${LANGS[aiLang].placeholder}" rows="1"
          onkeydown="handleAIKey(event)" oninput="autoResizeTA(this)"></textarea>
        <button class="ai-input-btn ai-mic-btn ${aiListening?'listening':''}" id="aiMicBtn" onclick="toggleVoice()" title="Voice input">
          <i class="fas fa-microphone"></i>
        </button>
        <button class="ai-send-btn" onclick="sendAIMessage()" title="Send">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
      <div class="ai-input-footer">
        <span>🌿 Powered by Hafa AI</span>
        <span>Supports: Chat · Voice · Image</span>
      </div>
    </div>
  </div>`;
  document.body.appendChild(widget);
}

// ===== TOGGLE AI =====
function toggleAI() {
  aiOpen = !aiOpen;
  document.getElementById('aiWindow').classList.toggle('open', aiOpen);
  const notif = document.getElementById('aiNotif');
  if (notif) notif.style.display = 'none';
  if (aiOpen && aiMessages.length === 0) {
    setTimeout(() => addAIMessage('bot', LANGS[aiLang].greeting), 400);
    setTimeout(() => renderSuggestions(), 1200);
  }
}

// ===== LANGUAGE =====
function setAILang(lang) {
  aiLang = lang;
  document.getElementById('aiLangFlag').textContent = LANGS[lang].flag;
  document.getElementById('aiInput').placeholder = LANGS[lang].placeholder;
  document.getElementById('aiLangMenu').classList.remove('open');
  document.querySelectorAll('.ai-lang-opt').forEach(b => b.classList.remove('active'));
  document.querySelector(`.ai-lang-opt[onclick="setAILang('${lang}')"]`).classList.add('active');
  document.getElementById('aiWindow').setAttribute('dir', LANGS[lang].dir);
  renderSuggestions();
  addAIMessage('bot', LANGS[lang].greeting);
}

function toggleLangMenu() {
  document.getElementById('aiLangMenu').classList.toggle('open');
}

// ===== MESSAGES =====
function addAIMessage(role, text, imgSrc) {
  const container = document.getElementById('aiMessages');
  const msg = { role, text, imgSrc, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) };
  aiMessages.push(msg);

  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${role}`;

  const formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  div.innerHTML = `
    ${role === 'bot' ? '<div class="ai-msg-avatar">🤖</div>' : ''}
    <div class="ai-msg-bubble">
      ${imgSrc ? `<img src="${imgSrc}" class="ai-msg-img" alt="uploaded" />` : ''}
      ${text ? `<div class="ai-msg-text">${formattedText}</div>` : ''}
      <div class="ai-msg-time">${msg.time}</div>
    </div>`;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function showTyping() {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-bot ai-typing-indicator';
  div.id = 'aiTyping';
  div.innerHTML = `<div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById('aiTyping');
  if (t) t.remove();
}

// ===== SEND MESSAGE =====
function sendAIMessage(text) {
  const input = document.getElementById('aiInput');
  const msg = text || input.value.trim();
  if (!msg) return;

  addAIMessage('user', msg);
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('aiSuggestions').innerHTML = '';

  showTyping();
  const delay = 800 + Math.random() * 800;
  setTimeout(() => {
    hideTyping();
    const response = getAIResponse(msg, aiLang);
    addAIMessage('bot', response);
    setTimeout(() => renderSuggestions(), 500);

    // Special actions
    if (/signup|create account|register/i.test(msg)) {
      setTimeout(() => { if (typeof openModal === 'function') openModal('signupModal'); }, 1500);
    }
    if (/seller|sell with/i.test(msg)) {
      setTimeout(() => { if (typeof openModal === 'function') openModal('sellerModal'); }, 1500);
    }
  }, delay);
}

function handleAIKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
}

function autoResizeTA(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ===== SUGGESTIONS =====
function renderSuggestions() {
  const el = document.getElementById('aiSuggestions');
  const sugs = LANGS[aiLang].suggestions || LANGS.en.suggestions;
  el.innerHTML = sugs.map(s => `<button class="ai-sug" onclick="sendAIMessage('${s}')">${s}</button>`).join('');
}

// ===== CLEAR =====
function clearAIChat() {
  aiMessages = [];
  document.getElementById('aiMessages').innerHTML = '';
  document.getElementById('aiSuggestions').innerHTML = '';
  setTimeout(() => { addAIMessage('bot', LANGS[aiLang].greeting); renderSuggestions(); }, 300);
}

// ===== VOICE INPUT =====
function toggleVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    addAIMessage('bot', '⚠️ Voice input is not supported in your browser. Please try Chrome or Edge.');
    return;
  }
  if (aiListening) {
    aiRecognition && aiRecognition.stop();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  aiRecognition = new SR();
  const langMap = { en:'en-US', am:'am-ET', om:'om-ET', sw:'sw-KE', fr:'fr-FR', ar:'ar-SA' };
  aiRecognition.lang = langMap[aiLang] || 'en-US';
  aiRecognition.continuous = false;
  aiRecognition.interimResults = true;

  aiListening = true;
  document.getElementById('aiMicBtn').classList.add('listening');
  document.getElementById('aiInput').placeholder = LANGS[aiLang].listening;

  aiRecognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('aiInput').value = transcript;
  };
  aiRecognition.onend = () => {
    aiListening = false;
    document.getElementById('aiMicBtn').classList.remove('listening');
    document.getElementById('aiInput').placeholder = LANGS[aiLang].placeholder;
    const val = document.getElementById('aiInput').value.trim();
    if (val) sendAIMessage();
  };
  aiRecognition.onerror = () => {
    aiListening = false;
    document.getElementById('aiMicBtn').classList.remove('listening');
    document.getElementById('aiInput').placeholder = LANGS[aiLang].placeholder;
  };
  aiRecognition.start();
}

// ===== IMAGE UPLOAD =====
function triggerImageUpload() {
  document.getElementById('aiImageInput').click();
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = ev.target.result;
    document.getElementById('aiPreviewImg').src = src;
    document.getElementById('aiImgPreview').style.display = 'flex';
    addAIMessage('user', '📸 Image sent', src);
    setTimeout(() => {
      hideTyping();
      addAIMessage('bot', `📸 Thanks for sharing that image! I can see you've uploaded a photo.\n\nWhile I'm analyzing it, here's what I can help with:\n\n🔍 If this is a **product image** — I can help you find similar items on Hafa Market!\n🌿 If it's a **plant/crop** — I can suggest related products like seeds, fertilizers, or tools.\n📦 If it's an **order issue** — please also contact our support team at hello@hafamarket.com\n\nWhat would you like to know about this image?`);
      setTimeout(() => renderSuggestions(), 500);
    }, 1500);
    showTyping();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function clearImagePreview() {
  document.getElementById('aiImgPreview').style.display = 'none';
  document.getElementById('aiPreviewImg').src = '';
}

// ===== CLOSE ON OUTSIDE CLICK =====
document.addEventListener('click', (e) => {
  if (!e.target.closest('#hafaAI')) {
    if (launcherOpen) closeLauncher();
  }
  if (!e.target.closest('.ai-lang-wrap')) {
    const menu = document.getElementById('aiLangMenu');
    if (menu) menu.classList.remove('open');
  }
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  buildAIWidget();
  // Show notification after 4 seconds
  setTimeout(() => {
    const notif = document.getElementById('aiNotif');
    if (notif && !aiOpen) notif.style.display = 'flex';
  }, 4000);
});
