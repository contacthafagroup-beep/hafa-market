// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── 1. OWNER USER ───────────────────────────────────────────────────────────
  console.log('👤 Creating owner account...');
  const passwordHash = await bcrypt.hash('Tilahun@2026', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'tilahunmekbib345@gmail.com' },
    update: {},
    create: {
      email: 'tilahunmekbib345@gmail.com',
      name: 'Tilahun Mekbib',
      role: 'ADMIN',
      passwordHash,
      isVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Owner user created: ${owner.email}`);

  // ─── 2. SELLER PROFILE ───────────────────────────────────────────────────────
  console.log('🏪 Creating seller profile...');
  const seller = await prisma.seller.upsert({
    where: { storeSlug: 'hafa-official' },
    update: {},
    create: {
      userId: owner.id,
      storeName: 'Hafa Market Official Store',
      storeSlug: 'hafa-official',
      city: 'Hossana',
      country: 'Ethiopia',
      status: 'VERIFIED',
      rating: 5.0,
      description:
        "Ethiopia's premier agricultural marketplace. Fresh produce, grains, coffee and specialty products from Hossana and the SNNPR region.",
    },
  });
  console.log(`✅ Seller profile created: ${seller.storeName}`);

  // ─── 3. CATEGORIES ───────────────────────────────────────────────────────────
  console.log('📂 Creating categories...');
  const categoryData = [
    { name: 'Vegetables',  nameAm: 'አትክልቶች',       nameOm: 'Kuduraa',      slug: 'vegetables', emoji: '🥬' },
    { name: 'Fruits',      nameAm: 'ፍራፍሬ',          nameOm: 'Fuduraa',      slug: 'fruits',     emoji: '🍎' },
    { name: 'Grains',      nameAm: 'እህሎች',           nameOm: 'Midhaan',      slug: 'grains',     emoji: '🌾' },
    { name: 'Legumes',     nameAm: 'ጥራጥሬ',          nameOm: 'Baaqelaa',     slug: 'legumes',    emoji: '🫘' },
    { name: 'Spices',      nameAm: 'ቅመማ ቅመም',       nameOm: 'Dhadhaa',      slug: 'spices',     emoji: '🌿' },
    { name: 'Poultry',     nameAm: 'ዶሮ እና ወተት',     nameOm: 'Lukkuu',       slug: 'poultry',    emoji: '🥚' },
    { name: 'Meat',        nameAm: 'ስጋ',             nameOm: 'Foon',         slug: 'meat',       emoji: '🥩' },
    { name: 'Coffee',      nameAm: 'ቡና',             nameOm: 'Bunaa',        slug: 'coffee',     emoji: '☕' },
    { name: 'Specialty',   nameAm: 'ልዩ ምርቶች',       nameOm: 'Oomisha Addaa', slug: 'specialty', emoji: '🍯' },
    { name: 'Processed',   nameAm: 'ተዘጋጅቶ ምግብ',    nameOm: 'Nyaata',       slug: 'processed',  emoji: '🍲' },
    { name: 'Household',   nameAm: 'የቤት ዕቃዎች',      nameOm: 'Mana',         slug: 'household',  emoji: '🏠' },
    { name: 'Services',    nameAm: 'አገልግሎት',         nameOm: 'Tajaajila',    slug: 'services',   emoji: '🚚' },
  ];

  const categories = {};
  for (const cat of categoryData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categories[cat.slug] = created;
    console.log(`  ✅ Category: ${cat.emoji} ${cat.name}`);
  }

  // ─── 4. PRODUCTS ─────────────────────────────────────────────────────────────
  console.log('🛒 Creating products...');

  const productsData = [
    // ── VEGETABLES ──
    {
      name: 'Fresh Tomatoes', nameAm: 'ቲማቲም', nameOm: 'Xaafii',
      slug: 'fresh-tomatoes', categorySlug: 'vegetables',
      price: 45, comparePrice: 60, unit: 'kg', stock: 500,
      isOrganic: false, isFeatured: true, soldCount: 450,
      rating: 4.8, reviewCount: 120,
      images: ['https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400'],
      description: 'Fresh, ripe tomatoes sourced directly from local farms in the SNNPR region.',
    },
    {
      name: 'Red Onions', nameAm: 'ቀይ ሽንኩርት', nameOm: 'Qullubbii Diimaa',
      slug: 'red-onions', categorySlug: 'vegetables',
      price: 35, comparePrice: 45, unit: 'kg', stock: 800,
      isOrganic: false, isFeatured: true, soldCount: 380,
      rating: 4.7, reviewCount: 95,
      images: ['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400'],
      description: 'Premium red onions from Hossana farms, perfect for Ethiopian cuisine.',
    },
    {
      name: 'Green Cabbage', nameAm: 'ጎመን', nameOm: 'Qaabeessa',
      slug: 'green-cabbage', categorySlug: 'vegetables',
      price: 25, comparePrice: 35, unit: 'kg', stock: 300,
      isOrganic: true, isFeatured: false, soldCount: 220,
      rating: 4.5, reviewCount: 60,
      images: ['https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400'],
      description: 'Organically grown green cabbage, fresh from the highland farms.',
    },
    {
      name: 'Carrots', nameAm: 'ካሮት', nameOm: 'Karoota',
      slug: 'carrots', categorySlug: 'vegetables',
      price: 40, comparePrice: 55, unit: 'kg', stock: 400,
      isOrganic: true, isFeatured: false, soldCount: 180,
      rating: 4.6, reviewCount: 45,
      images: ['https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400'],
      description: 'Sweet, organic carrots grown in the fertile soils of SNNPR.',
    },
    {
      name: 'Potatoes', nameAm: 'ድንች', nameOm: 'Qocaa',
      slug: 'potatoes', categorySlug: 'vegetables',
      price: 30, comparePrice: 40, unit: 'kg', stock: 1000,
      isOrganic: false, isFeatured: true, soldCount: 500,
      rating: 4.9, reviewCount: 200,
      images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400'],
      description: 'Fresh potatoes, a staple of Ethiopian households. Bulk available.',
    },
    {
      name: 'Green Peppers', nameAm: 'ቃሪያ', nameOm: 'Barbaree',
      slug: 'green-peppers', categorySlug: 'vegetables',
      price: 80, comparePrice: 100, unit: 'kg', stock: 200,
      isOrganic: false, isFeatured: false, soldCount: 150,
      rating: 4.4, reviewCount: 38,
      images: ['https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400'],
      description: 'Fresh green peppers, ideal for stews and salads.',
    },
    {
      name: 'Garlic', nameAm: 'ነጭ ሽንኩርት', nameOm: 'Qullubbii Adii',
      slug: 'garlic', categorySlug: 'vegetables',
      price: 120, comparePrice: 150, unit: 'kg', stock: 150,
      isOrganic: true, isFeatured: false, soldCount: 200,
      rating: 4.7, reviewCount: 55,
      images: ['https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400'],
      description: 'Organic garlic with strong aroma, essential for Ethiopian spice blends.',
    },
    {
      name: 'Spinach', nameAm: 'ቆስጣ', nameOm: 'Qocaa Magariisa',
      slug: 'spinach', categorySlug: 'vegetables',
      price: 30, comparePrice: 40, unit: 'bunch', stock: 200,
      isOrganic: true, isFeatured: false, soldCount: 120,
      rating: 4.5, reviewCount: 30,
      images: ['https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400'],
      description: 'Fresh organic spinach bunches, harvested daily.',
    },

    // ── FRUITS ──
    {
      name: 'Avocado', nameAm: 'አቮካዶ', nameOm: 'Avocado',
      slug: 'avocado', categorySlug: 'fruits',
      price: 60, comparePrice: 80, unit: 'kg', stock: 300,
      isOrganic: true, isFeatured: true, soldCount: 350,
      rating: 4.9, reviewCount: 140,
      images: ['https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400'],
      description: 'Creamy organic avocados from the lush farms of southern Ethiopia.',
    },
    {
      name: 'Banana', nameAm: 'ሙዝ', nameOm: 'Muuzii',
      slug: 'banana', categorySlug: 'fruits',
      price: 25, comparePrice: 35, unit: 'kg', stock: 500,
      isOrganic: false, isFeatured: true, soldCount: 420,
      rating: 4.8, reviewCount: 160,
      images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400'],
      description: 'Sweet ripe bananas, freshly harvested from local plantations.',
    },
    {
      name: 'Mango', nameAm: 'ማንጎ', nameOm: 'Maangoo',
      slug: 'mango', categorySlug: 'fruits',
      price: 50, comparePrice: 70, unit: 'kg', stock: 400,
      isOrganic: false, isFeatured: true, soldCount: 300,
      rating: 4.7, reviewCount: 110,
      images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?w=400'],
      description: 'Juicy Ethiopian mangoes, in season and full of flavor.',
    },
    {
      name: 'Papaya', nameAm: 'ፓፓያ', nameOm: 'Paappaayyaa',
      slug: 'papaya', categorySlug: 'fruits',
      price: 40, comparePrice: 55, unit: 'kg', stock: 200,
      isOrganic: false, isFeatured: false, soldCount: 160,
      rating: 4.5, reviewCount: 42,
      images: ['https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400'],
      description: 'Fresh papayas rich in vitamins, sourced from local farms.',
    },
    {
      name: 'Orange', nameAm: 'ብርቱካን', nameOm: 'Burtukaana',
      slug: 'orange', categorySlug: 'fruits',
      price: 35, comparePrice: 50, unit: 'kg', stock: 600,
      isOrganic: false, isFeatured: false, soldCount: 280,
      rating: 4.6, reviewCount: 75,
      images: ['https://images.unsplash.com/photo-1547514701-42782101795e?w=400'],
      description: 'Sweet and tangy oranges, perfect for fresh juice.',
    },

    // ── GRAINS ──
    {
      name: 'Teff Grain 5kg', nameAm: 'ጤፍ', nameOm: 'Xaafii',
      slug: 'teff-grain-5kg', categorySlug: 'grains',
      price: 280, comparePrice: 350, unit: 'bag', stock: 200,
      isOrganic: true, isFeatured: true, soldCount: 400,
      rating: 4.9, reviewCount: 180,
      images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
      description: 'Premium organic teff grain, the ancient Ethiopian superfood. 5kg bag.',
    },
    {
      name: 'White Wheat 10kg', nameAm: 'ስንዴ', nameOm: 'Qamadii',
      slug: 'white-wheat-10kg', categorySlug: 'grains',
      price: 350, comparePrice: 420, unit: 'bag', stock: 300,
      isOrganic: false, isFeatured: false, soldCount: 250,
      rating: 4.6, reviewCount: 80,
      images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
      description: 'High-quality white wheat, milled from Ethiopian highland farms. 10kg bag.',
    },
    {
      name: 'Maize', nameAm: 'በቆሎ', nameOm: 'Boqqolloo',
      slug: 'maize', categorySlug: 'grains',
      price: 25, comparePrice: 35, unit: 'kg', stock: 1000,
      isOrganic: false, isFeatured: false, soldCount: 320,
      rating: 4.5, reviewCount: 65,
      images: ['https://images.unsplash.com/photo-1601593346740-925612772716?w=400'],
      description: 'Fresh maize from the fertile lowlands, great for roasting or grinding.',
    },
    {
      name: 'Barley', nameAm: 'ገብስ', nameOm: 'Garbuu',
      slug: 'barley', categorySlug: 'grains',
      price: 30, comparePrice: 40, unit: 'kg', stock: 500,
      isOrganic: false, isFeatured: false, soldCount: 180,
      rating: 4.4, reviewCount: 40,
      images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
      description: 'Ethiopian highland barley, used for tella and traditional foods.',
    },
    {
      name: 'Sorghum', nameAm: 'ማሽላ', nameOm: 'Bishingaa',
      slug: 'sorghum', categorySlug: 'grains',
      price: 22, comparePrice: 30, unit: 'kg', stock: 800,
      isOrganic: false, isFeatured: false, soldCount: 140,
      rating: 4.3, reviewCount: 30,
      images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
      description: 'Drought-resistant sorghum grain, a staple in southern Ethiopia.',
    },

    // ── LEGUMES ──
    {
      name: 'Red Lentils', nameAm: 'ምስር', nameOm: 'Adaas Diimaa',
      slug: 'red-lentils', categorySlug: 'legumes',
      price: 90, comparePrice: 110, unit: 'kg', stock: 300,
      isOrganic: true, isFeatured: false, soldCount: 220,
      rating: 4.7, reviewCount: 70,
      images: ['https://images.unsplash.com/photo-1585996160917-5a2e4e5e5e5e?w=400'],
      description: 'Organic red lentils, perfect for misir wot and soups.',
    },
    {
      name: 'Chickpeas', nameAm: 'ሽምብራ', nameOm: 'Qorii',
      slug: 'chickpeas', categorySlug: 'legumes',
      price: 85, comparePrice: 100, unit: 'kg', stock: 400,
      isOrganic: false, isFeatured: false, soldCount: 190,
      rating: 4.6, reviewCount: 55,
      images: ['https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=400'],
      description: 'Premium chickpeas for shimbra asa and traditional fasting dishes.',
    },
    {
      name: 'Black-eyed Peas', nameAm: 'ባቄላ', nameOm: 'Baaqelaa',
      slug: 'black-eyed-peas', categorySlug: 'legumes',
      price: 70, comparePrice: 90, unit: 'kg', stock: 350,
      isOrganic: false, isFeatured: false, soldCount: 160,
      rating: 4.4, reviewCount: 40,
      images: ['https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=400'],
      description: 'Fresh black-eyed peas, a nutritious legume for Ethiopian stews.',
    },
    {
      name: 'Soybeans', nameAm: 'ሶያ', nameOm: 'Sooyaa',
      slug: 'soybeans', categorySlug: 'legumes',
      price: 75, comparePrice: 95, unit: 'kg', stock: 250,
      isOrganic: true, isFeatured: false, soldCount: 130,
      rating: 4.5, reviewCount: 35,
      images: ['https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=400'],
      description: 'Organic soybeans, high in protein and great for various dishes.',
    },

    // ── SPICES ──
    {
      name: 'Berbere Spice Mix 500g', nameAm: 'በርበሬ', nameOm: 'Barbaree Dhadhaa',
      slug: 'berbere-spice-mix-500g', categorySlug: 'spices',
      price: 150, comparePrice: 200, unit: 'pack', stock: 200,
      isOrganic: true, isFeatured: true, soldCount: 380,
      rating: 4.9, reviewCount: 170,
      images: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400'],
      description: 'Authentic Ethiopian berbere spice blend, hand-ground from organic chilies and spices. 500g pack.',
    },
    {
      name: 'Mitmita 250g', nameAm: 'ሚጥሚጣ', nameOm: 'Mitmitaa',
      slug: 'mitmita-250g', categorySlug: 'spices',
      price: 120, comparePrice: 160, unit: 'pack', stock: 150,
      isOrganic: true, isFeatured: false, soldCount: 200,
      rating: 4.8, reviewCount: 80,
      images: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400'],
      description: 'Fiery mitmita spice blend, a staple of Ethiopian kitchens. 250g pack.',
    },
    {
      name: 'Turmeric', nameAm: 'ቢጫ ዝንጅብል', nameOm: 'Ird',
      slug: 'turmeric', categorySlug: 'spices',
      price: 200, comparePrice: 250, unit: 'kg', stock: 100,
      isOrganic: true, isFeatured: false, soldCount: 150,
      rating: 4.7, reviewCount: 50,
      images: ['https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400'],
      description: 'Pure organic turmeric powder, freshly ground from Ethiopian roots.',
    },
    {
      name: 'Ginger', nameAm: 'ዝንጅብል', nameOm: 'Zinjibila',
      slug: 'ginger', categorySlug: 'spices',
      price: 180, comparePrice: 220, unit: 'kg', stock: 120,
      isOrganic: true, isFeatured: false, soldCount: 170,
      rating: 4.7, reviewCount: 58,
      images: ['https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400'],
      description: 'Fresh organic ginger root, aromatic and full of flavor.',
    },

    // ── COFFEE ──
    {
      name: 'Yirgacheffe Coffee Roasted 500g', nameAm: 'ይርጋጨፌ ቡና', nameOm: 'Bunaa Yirgacheffe',
      slug: 'yirgacheffe-coffee-roasted-500g', categorySlug: 'coffee',
      price: 350, comparePrice: 450, unit: 'bag', stock: 100,
      isOrganic: true, isFeatured: true, soldCount: 320,
      rating: 5.0, reviewCount: 190,
      images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400'],
      description: 'World-renowned Yirgacheffe single-origin coffee, medium roast. Floral and citrus notes. 500g bag.',
    },
    {
      name: 'Sidama Coffee Green 1kg', nameAm: 'ሲዳማ ቡና', nameOm: 'Bunaa Sidama',
      slug: 'sidama-coffee-green-1kg', categorySlug: 'coffee',
      price: 280, comparePrice: 350, unit: 'kg', stock: 80,
      isOrganic: true, isFeatured: true, soldCount: 280,
      rating: 4.9, reviewCount: 140,
      images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400'],
      description: 'Premium green (unroasted) Sidama coffee beans. Roast at home for ultimate freshness. 1kg.',
    },
    {
      name: 'Jimma Coffee Roasted 250g', nameAm: 'ጅማ ቡና', nameOm: 'Bunaa Jimmaa',
      slug: 'jimma-coffee-roasted-250g', categorySlug: 'coffee',
      price: 180, comparePrice: 230, unit: 'bag', stock: 120,
      isOrganic: false, isFeatured: false, soldCount: 200,
      rating: 4.7, reviewCount: 90,
      images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400'],
      description: 'Bold and earthy Jimma coffee, dark roast. A classic Ethiopian brew. 250g bag.',
    },
    {
      name: 'Harrar Coffee 500g', nameAm: 'ሐረር ቡና', nameOm: 'Bunaa Haraar',
      slug: 'harrar-coffee-500g', categorySlug: 'coffee',
      price: 320, comparePrice: 400, unit: 'bag', stock: 90,
      isOrganic: true, isFeatured: false, soldCount: 240,
      rating: 4.9, reviewCount: 120,
      images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400'],
      description: 'Exotic Harrar coffee with wine-like and blueberry notes. Dry-processed. 500g bag.',
    },

    // ── SPECIALTY ──
    {
      name: 'Pure Wildflower Honey 500g', nameAm: 'ንጹህ ማር', nameOm: 'Damma Qulqulluu',
      slug: 'pure-wildflower-honey-500g', categorySlug: 'specialty',
      price: 450, comparePrice: 600, unit: 'jar', stock: 80,
      isOrganic: true, isFeatured: true, soldCount: 350,
      rating: 5.0, reviewCount: 160,
      images: ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400'],
      description: 'Raw, unfiltered wildflower honey from the highlands of SNNPR. 500g jar.',
    },
    {
      name: 'Moringa Powder 250g', nameAm: 'ሞሪንጋ', nameOm: 'Moringaa',
      slug: 'moringa-powder-250g', categorySlug: 'specialty',
      price: 280, comparePrice: 350, unit: 'pack', stock: 100,
      isOrganic: true, isFeatured: false, soldCount: 180,
      rating: 4.8, reviewCount: 70,
      images: ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400'],
      description: 'Pure organic moringa leaf powder, a nutritional powerhouse. 250g pack.',
    },
    {
      name: 'Black Seed (Nigella) 250g', nameAm: 'ጥቁር አዝሙድ', nameOm: 'Abashii',
      slug: 'black-seed-nigella-250g', categorySlug: 'specialty',
      price: 200, comparePrice: 260, unit: 'pack', stock: 150,
      isOrganic: true, isFeatured: false, soldCount: 220,
      rating: 4.8, reviewCount: 85,
      images: ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400'],
      description: 'Premium black seed (Nigella sativa), known for its health benefits. 250g pack.',
    },
    {
      name: 'Flaxseed 500g', nameAm: 'ሰሊጥ', nameOm: 'Saliixii',
      slug: 'flaxseed-500g', categorySlug: 'specialty',
      price: 120, comparePrice: 160, unit: 'pack', stock: 200,
      isOrganic: true, isFeatured: false, soldCount: 160,
      rating: 4.6, reviewCount: 50,
      images: ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400'],
      description: 'Organic whole flaxseeds, rich in omega-3 and fiber. 500g pack.',
    },

    // ── POULTRY ──
    {
      name: 'Farm Fresh Eggs (30 pack)', nameAm: 'ዶሮ እንቁላል', nameOm: 'Hanqaaquu',
      slug: 'farm-fresh-eggs-30-pack', categorySlug: 'poultry',
      price: 180, comparePrice: 220, unit: 'tray', stock: 100,
      isOrganic: false, isFeatured: true, soldCount: 400,
      rating: 4.8, reviewCount: 150,
      images: ['https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400'],
      description: 'Fresh free-range eggs from local farms. 30-egg tray.',
    },
    {
      name: 'Fresh Whole Chicken', nameAm: 'ዶሮ', nameOm: 'Lukkuu',
      slug: 'fresh-whole-chicken', categorySlug: 'poultry',
      price: 350, comparePrice: 420, unit: 'kg', stock: 50,
      isOrganic: false, isFeatured: false, soldCount: 200,
      rating: 4.7, reviewCount: 80,
      images: ['https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400'],
      description: 'Fresh whole chicken from local farms, cleaned and ready to cook.',
    },
    {
      name: 'Fresh Cow Milk 1L', nameAm: 'ወተት', nameOm: 'Aannani',
      slug: 'fresh-cow-milk-1l', categorySlug: 'poultry',
      price: 45, comparePrice: 60, unit: 'liter', stock: 200,
      isOrganic: false, isFeatured: false, soldCount: 300,
      rating: 4.6, reviewCount: 90,
      images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400'],
      description: 'Fresh whole cow milk, collected daily from local dairy farms. 1 liter.',
    },

    // ── PROCESSED ──
    {
      name: 'Injera (10 pieces)', nameAm: 'እንጀራ', nameOm: 'Injeeraa',
      slug: 'injera-10-pieces', categorySlug: 'processed',
      price: 80, comparePrice: 100, unit: 'pack', stock: 150,
      isOrganic: false, isFeatured: true, soldCount: 450,
      rating: 4.9, reviewCount: 200,
      images: ['https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400'],
      description: 'Freshly made traditional Ethiopian injera from 100% teff. 10 pieces per pack.',
    },
    {
      name: 'Shiro Powder 500g', nameAm: 'ሽሮ', nameOm: 'Shiroo',
      slug: 'shiro-powder-500g', categorySlug: 'processed',
      price: 120, comparePrice: 150, unit: 'pack', stock: 200,
      isOrganic: false, isFeatured: false, soldCount: 280,
      rating: 4.7, reviewCount: 110,
      images: ['https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400'],
      description: 'Authentic Ethiopian shiro powder, spiced chickpea flour for shiro wot. 500g pack.',
    },
    {
      name: 'Niter Kibbeh (Spiced Butter) 500g', nameAm: 'ንጥር ቅቤ', nameOm: 'Dhadhaa Qulqulluu',
      slug: 'niter-kibbeh-500g', categorySlug: 'processed',
      price: 280, comparePrice: 350, unit: 'jar', stock: 80,
      isOrganic: false, isFeatured: false, soldCount: 200,
      rating: 4.8, reviewCount: 95,
      images: ['https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400'],
      description: 'Traditional Ethiopian spiced clarified butter (niter kibbeh), infused with herbs and spices. 500g jar.',
    },
  ];

  for (const p of productsData) {
    const { categorySlug, ...productFields } = p;
    const categoryId = categories[categorySlug].id;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...productFields,
        categoryId,
        sellerId: seller.id,
        status: 'ACTIVE',
        origin: 'Ethiopia',
      },
    });
    console.log(`  ✅ Product: ${p.name}`);
  }

  // ─── 5. PROMO CODES ──────────────────────────────────────────────────────────
  console.log('🎟️  Creating promo codes...');
  const promoCodes = [
    {
      code: 'HAFA10',
      description: '10% off all products at Hafa Market',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 0,
      maxUses: 10000,
      isActive: true,
    },
    {
      code: 'WELCOME20',
      description: '20% off your first order (min 100 ETB)',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderAmount: 100,
      maxUses: 500,
      isActive: true,
    },
    {
      code: 'COFFEE15',
      description: '15% off coffee category (min 200 ETB)',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minOrderAmount: 200,
      maxUses: 1000,
      isActive: true,
    },
  ];

  for (const promo of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: {},
      create: promo,
    });
    console.log(`  ✅ Promo code: ${promo.code}`);
  }

  // ─── 6. BLOG POSTS ───────────────────────────────────────────────────────────
  console.log('📝 Creating blog posts...');
  const blogPosts = [
    {
      title: "Why Ethiopian Coffee is the World's Best",
      slug: 'why-ethiopian-coffee-is-the-worlds-best',
      category: 'Coffee',
      excerpt: 'Discover why Ethiopia is the birthplace of coffee and why its varieties are prized worldwide.',
      content: `Ethiopia is the birthplace of coffee, and its diverse growing regions produce some of the most complex and sought-after beans in the world.

**Yirgacheffe** — Located in the Gedeo Zone of the SNNPR region, Yirgacheffe coffees are celebrated for their bright acidity, floral aromas, and distinctive citrus and bergamot notes. The high altitude (1,700–2,200m) and rich soil create ideal conditions for slow cherry development.

**Sidama** — The Sidama zone produces coffees with a full body and bright acidity. Expect notes of dark chocolate, blueberry, and jasmine. Sidama coffees are often wet-processed, resulting in a clean, vibrant cup.

**Harrar** — One of the oldest coffee-growing regions in the world, Harrar produces dry-processed (natural) coffees with a distinctive wine-like quality. Expect notes of blueberry, dark fruit, and a heavy, syrupy body.

Ethiopia's coffee culture is deeply embedded in daily life. The traditional coffee ceremony — roasting green beans, grinding by hand, and brewing in a clay jebena — is a ritual of hospitality and community.

At Hafa Market, we source directly from cooperatives in these regions, ensuring farmers receive fair prices and you receive the freshest, highest-quality coffee possible.`,
      isPublished: true,
      publishedAt: new Date(),
      authorId: owner.id,
      tags: ['coffee', 'ethiopia', 'yirgacheffe', 'sidama', 'harrar'],
    },
    {
      title: "Teff: Ethiopia's Ancient Superfood",
      slug: 'teff-ethiopias-ancient-superfood',
      category: 'Farming Tips',
      excerpt: 'Learn about teff, the tiny grain that powers Ethiopia, and why it is gaining global recognition.',
      content: `Teff (Eragrostis tef) is a tiny grain — about the size of a poppy seed — that has been cultivated in Ethiopia for thousands of years. It is the foundation of Ethiopian cuisine, most famously used to make injera, the spongy sourdough flatbread that serves as both plate and utensil.

**Nutritional Profile**
Teff is a nutritional powerhouse. It is naturally gluten-free, high in iron, calcium, and resistant starch. A 100g serving provides approximately 367 calories, 13g protein, 73g carbohydrates, and 8g fiber. Its high iron content makes it particularly valuable in a country where iron deficiency is common.

**Farming Teff**
Teff is remarkably resilient. It thrives in both waterlogged soils and drought conditions, making it ideal for Ethiopia's variable climate. It grows at altitudes from 1,800 to 2,400 meters and matures in just 60–90 days.

Key farming tips:
- Sow teff at the start of the rainy season (June–July in most highland areas)
- Use minimal tillage to prevent soil erosion
- Teff requires very little fertilizer compared to other grains
- Harvest when the grain is fully mature but before heavy rains cause lodging

**Global Recognition**
Teff is now exported to over 50 countries and is popular among health-conscious consumers worldwide. Ethiopian farmers are increasingly benefiting from this global demand.

At Hafa Market, we source organic teff directly from smallholder farmers in the SNNPR region, supporting local agriculture while bringing you the finest quality grain.`,
      isPublished: true,
      publishedAt: new Date(),
      authorId: owner.id,
      tags: ['teff', 'farming', 'superfood', 'injera', 'nutrition'],
    },
    {
      title: 'How to Buy Fresh Produce in Hossana',
      slug: 'how-to-buy-fresh-produce-in-hossana',
      category: 'Market Trends',
      excerpt: 'Your guide to navigating the vibrant markets of Hossana and getting the best fresh produce.',
      content: `Hossana, the capital of the Hadiya Zone in the SNNPR region, is a vibrant market town surrounded by fertile agricultural land. Whether you are a local resident or visiting, here is how to make the most of Hossana's fresh produce markets.

**Main Market (Merkato)**
The Hossana Main Market operates daily but is busiest on Mondays and Thursdays. You will find a wide variety of fresh vegetables, fruits, grains, and spices. Arrive early (before 9am) for the best selection and prices.

**What to Buy and When**
- **Vegetables**: Tomatoes, onions, cabbage, and potatoes are available year-round. Prices are lowest during harvest season (October–December).
- **Fruits**: Avocados and mangoes are in season from March to June. Bananas are available year-round.
- **Grains**: Teff and wheat are most abundant after the main harvest (November–January).
- **Coffee**: Fresh green coffee beans are available from November through February.

**Tips for Getting the Best Deals**
1. **Buy in bulk**: Prices drop significantly for larger quantities. Bring a friend and split bulk purchases.
2. **Negotiate respectfully**: Bargaining is expected and part of the culture. Start at 70% of the asking price.
3. **Check freshness**: For vegetables, look for firm texture and vibrant color. Avoid produce with soft spots or discoloration.
4. **Build relationships**: Regular customers often get better prices and first pick of fresh arrivals.
5. **Use Hafa Market**: For convenience, order online through Hafa Market and get fresh produce delivered to your door from verified local sellers.

**Pickup Stations**
Hafa Market operates pickup stations at the Main Market Square and near the Bus Terminal, making it easy to collect your orders without waiting for home delivery.`,
      isPublished: true,
      publishedAt: new Date(),
      authorId: owner.id,
      tags: ['hossana', 'market', 'fresh produce', 'shopping tips', 'ethiopia'],
    },
  ];

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: post,
    });
    console.log(`  ✅ Blog post: ${post.title}`);
  }

  // ─── 7. PICKUP STATIONS ──────────────────────────────────────────────────────
  console.log('📍 Creating pickup stations...');
  const pickupStations = [
    {
      name: 'Hossana Main Market',
      city: 'Hossana',
      address: 'Main Market Square',
      latitude: 7.5560,
      longitude: 37.8527,
      isActive: true,
      openHours: '7am-7pm',
    },
    {
      name: 'Hossana Bus Station',
      city: 'Hossana',
      address: 'Near Bus Terminal',
      latitude: 7.5520,
      longitude: 37.8490,
      isActive: true,
      openHours: '6am-8pm',
    },
    {
      name: 'Wolaita Sodo Branch',
      city: 'Wolaita Sodo',
      address: 'Commercial Street',
      latitude: 6.8500,
      longitude: 37.7500,
      isActive: true,
      openHours: '8am-6pm',
    },
  ];

  for (const station of pickupStations) {
    // PickupStation has no unique slug, use name+city as logical key
    const existing = await prisma.pickupStation.findFirst({
      where: { name: station.name, city: station.city },
    });
    if (!existing) {
      await prisma.pickupStation.create({ data: station });
    }
    console.log(`  ✅ Pickup station: ${station.name}`);
  }

  // ─── DONE ─────────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed completed successfully!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('                  CREDENTIALS SUMMARY                  ');
  console.log('═══════════════════════════════════════════════════════');
  console.log('👤 ADMIN / OWNER ACCOUNT');
  console.log(`   Email    : tilahunmekbib345@gmail.com`);
  console.log(`   Password : Tilahun@2026`);
  console.log(`   Role     : ADMIN`);
  console.log(`   Name     : Tilahun Mekbib`);
  console.log('───────────────────────────────────────────────────────');
  console.log('🏪 SELLER PROFILE');
  console.log(`   Store    : Hafa Market Official Store`);
  console.log(`   Slug     : hafa-official`);
  console.log(`   City     : Hossana, Ethiopia`);
  console.log(`   Status   : VERIFIED`);
  console.log('───────────────────────────────────────────────────────');
  console.log('🎟️  PROMO CODES');
  console.log(`   HAFA10    : 10% off, no minimum, max 10,000 uses`);
  console.log(`   WELCOME20 : 20% off first order, min 100 ETB, max 500 uses`);
  console.log(`   COFFEE15  : 15% off coffee, min 200 ETB, max 1,000 uses`);
  console.log('───────────────────────────────────────────────────────');
  console.log(`📦 Products seeded : ${productsData.length}`);
  console.log(`📂 Categories      : ${categoryData.length}`);
  console.log(`📝 Blog posts      : ${blogPosts.length}`);
  console.log(`📍 Pickup stations : ${pickupStations.length}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
