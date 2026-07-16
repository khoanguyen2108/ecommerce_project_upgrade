import type { Locale } from "@/features/i18n/locale";

const CATEGORY_NAME_VI: Record<string, string> = {
  accessories: "Phụ kiện",
  bags: "Túi",
  beanie: "Mũ len",
  beanies: "Mũ len",
  belt: "Dây nịt",
  belts: "Dây nịt",
  bomber: "Áo khoác bomber",
  bombers: "Áo khoác bomber",
  bottoms: "Quần",
  bracelet: "Vòng tay",
  bracelets: "Vòng tay",
  denim: "Quần denim",
  durag: "Khăn trùm đầu",
  durags: "Khăn trùm đầu",
  handbag: "Túi",
  handbags: "Túi",
  jacket: "Áo khoác",
  jackets: "Áo khoác",
  jeans: "Quần jeans",
  "long sleeve": "Áo tay dài",
  "long sleeves": "Áo tay dài",
  men: "Nam",
  "new season": "Mùa mới",
  outerwear: "Áo khoác ngoài",
  shoes: "Giày",
  slippers: "Dép",
  boots: "Bốt",
  ring: "Nhẫn",
  rings: "Nhẫn",
  sunglasses: "Kính mát",
  tanktop: "Áo tanktop",
  "tank top": "Áo tanktop",
  tee: "Áo thun",
  tees: "Áo thun",
  tote: "Túi tote",
  totes: "Túi tote",
  tops: "Áo",
  watch: "Đồng hồ",
  watches: "Đồng hồ",
  women: "Nữ",
};

const PRODUCT_NAME_VI: Record<string, string> = {
  "boxy heavyweight tee": "Áo thun dày dáng boxy",
  "canvas tote bag": "Túi tote canvas",
  "ashen vertex boots": "Bốt Ashen Vertex",
  "apex predator denim": "Quần denim Apex Predator",
  "baroque engraved belt": "Dây nịt Baroque Engraved",
  "cartier x chrome hearts gothic watch": "Đồng hồ Cartier x Chrome Hearts Gothic",
  "chrome hearts buckle belt": "Dây nịt Chrome Hearts Buckle",
  "chrome hearts durag": "Khăn trùm đầu Chrome Hearts",
  "chrome hearts jacket": "Áo khoác Chrome Hearts",
  "chrome hearts jeans": "Quần jeans Chrome Hearts",
  "chrome hearts multi-cross tee": "Áo thun Multi-Cross Chrome Hearts",
  "chrome hearts multi-cross punk ring": "Nhẫn Chrome Hearts Multi-Cross Punk",
  "chrome hearts dagger slippers": "Dép Chrome Hearts Dagger",
  "chrome hearts cemetery cross patch tote": "Túi tote Chrome Hearts Cemetery Cross Patch",
  "chrome hearts sterling cuban bracelet": "Vòng tay Chrome Hearts Sterling Cuban",
  "cropped denim jacket": "Áo khoác denim dáng croptop",
  "downtown leather tote": "Túi tote Downtown Leather",
  "ironclad bomber": "Áo khoác bomber Ironclad",
  "lightweight utility overshirt": "Áo khoác overshirt tiện dụng nhẹ",
  "linen blend midi dress": "Đầm midi pha linen",
  "luster flared denim": "Quần denim Luster Flared",
  "maison margiela distressed tongue tanktop": "Áo tanktop Maison Margiela Distressed Tongue",
  "minimal leather belt": "Thắt lưng da tối giản",
  "midnight rider": "Quần Midnight Rider",
  "monolithic sunglasses": "Kính mát Monolithic",
  "philipp plein crystal skull sneakers": "Giày sneaker Crystal Skull Philipp Plein",
  "pleated wide-leg trousers": "Quần ống rộng xếp ly",
  "racer worldwide washed denim": "Quần denim Racer Worldwide Washed",
  "relaxed oxford shirt": "Áo sơ mi Oxford dáng thoải mái",
  "rick owens laced high-top": "Giày Rick Owens Laced High-Top",
  "ribbed knit tank": "Áo tank top dệt gân",
  "sashiko denim": "Quần denim Sashiko",
  "satin slip skirt": "Chân váy satin dáng slip",
  "soft knit cardigan": "Áo cardigan dệt kim mềm",
  "stussy knit beanie": "Mũ len Stussy Knit",
  "tapered chino pants": "Quần chino ống côn",
};

const COLOR_VI: Record<string, string> = {
  beige: "Be",
  black: "Đen",
  blue: "Xanh dương",
  brown: "Nâu",
  cream: "Kem",
  darkwash: "Xanh denim đậm",
  gray: "Xám",
  green: "Xanh lá",
  grey: "Xám",
  indigo: "Chàm",
  navy: "Xanh navy",
  olive: "Xanh olive",
  pink: "Hồng",
  red: "Đỏ",
  silver: "Bạc",
  stone: "Màu đá",
  white: "Trắng",
};

const DESCRIPTION_VI: Record<string, string> = {
  "a black leather jacket with bold cross-inspired details and silver-tone hardware. a strong statement outerwear piece for gothic, biker, darkwear, and luxury-streetwear outfits.":
    "Áo khoác da màu đen với chi tiết lấy cảm hứng từ họa tiết thập giá và phụ kiện kim loại tông bạc. Một món outerwear nổi bật cho phong cách gothic, biker, darkwear và luxury streetwear.",
  "explore this belikeme category.":
    "Khám phá danh mục Belikeme này.",
  "finishing pieces for daily outfits.":
    "Những món phụ kiện hoàn thiện outfit hằng ngày.",
  "light jackets, overshirts, and soft seasonal layers.":
    "Áo khoác nhẹ, overshirt và các lớp phối mềm mại theo mùa.",
  "tees, shirts, tanks, and light knit layers.":
    "Áo thun, sơ mi, tank top và các lớp dệt kim nhẹ.",
  "trousers, skirts, chinos, and everyday separates.":
    "Quần dài, chân váy, quần chino và các món phối hằng ngày.",
};

const PRODUCT_TYPE_SUFFIXES: Array<[RegExp, string]> = [
  [/\blong\s+sleeves?$/i, "Áo tay dài"],
  [/\btank\s*tops?$/i, "Áo tanktop"],
  [/\btanktops?$/i, "Áo tanktop"],
  [/\b(multi-cross\s+)?tee$/i, "Áo thun"],
  [/\bt-?shirt$/i, "Áo thun"],
  [/\bbombers?$/i, "Áo khoác bomber"],
  [/\bjacket$/i, "Áo khoác"],
  [/\bdenim$/i, "Quần denim"],
  [/\bjeans$/i, "Quần jeans"],
  [/\bsneakers?$/i, "Giày sneaker"],
  [/\bslippers?$/i, "Dép"],
  [/\bboots?$/i, "Bốt"],
  [/\bhigh-?tops?$/i, "Giày"],
  [/\bshoes?$/i, "Giày"],
  [/\bpants$/i, "Quần"],
  [/\btrousers$/i, "Quần tây"],
  [/\bshirt$/i, "Áo sơ mi"],
  [/\bhoodie$/i, "Áo hoodie"],
  [/\bskirt$/i, "Chân váy"],
  [/\bdress$/i, "Đầm"],
  [/\bhandbags?$/i, "Túi"],
  [/\btotes?$/i, "Túi tote"],
  [/\bbag$/i, "Túi"],
  [/\bbelts?$/i, "Dây nịt"],
  [/\bdurags?$/i, "Khăn trùm đầu"],
  [/\bsunglasses$/i, "Kính mát"],
  [/\bbracelets?$/i, "Vòng tay"],
  [/\bbeanies$/i, "Mũ len"],
  [/\bbeanie$/i, "Mũ len"],
  [/\brings?$/i, "Nhẫn"],
  [/\bwatches$/i, "Đồng hồ"],
  [/\bwatch$/i, "Đồng hồ"],
];

export function localizeCategoryName(
  name: string | null | undefined,
  locale: Locale,
): string {
  return localizeByMap(name, locale, CATEGORY_NAME_VI);
}

export function localizeCategoryDescription(
  description: string | null | undefined,
  locale: Locale,
): string | null {
  return localizeDescription(description, locale);
}

export function localizeProductName(
  name: string | null | undefined,
  locale: Locale,
): string {
  if (!name) return "";
  if (locale !== "vi") return name;

  const exact = PRODUCT_NAME_VI[normalizeKey(name)];
  if (exact) return exact;

  for (const [pattern, vietnameseType] of PRODUCT_TYPE_SUFFIXES) {
    if (!pattern.test(name)) continue;

    const body = name.replace(pattern, "").trim();
    return body ? `${vietnameseType} ${body}` : vietnameseType;
  }

  return replaceCatalogTerms(name);
}

export function localizeProductDescription(
  description: string | null | undefined,
  locale: Locale,
): string | null {
  return localizeDescription(description, locale);
}

export function localizeColorName(
  color: string | null | undefined,
  locale: Locale,
): string {
  return localizeByMap(color, locale, COLOR_VI);
}

function localizeDescription(
  description: string | null | undefined,
  locale: Locale,
): string | null {
  if (!description) return null;
  if (locale !== "vi") return description;

  const exact = DESCRIPTION_VI[normalizeKey(description)];
  if (exact) return exact;

  return replaceCatalogTerms(description);
}

function localizeByMap(
  value: string | null | undefined,
  locale: Locale,
  map: Record<string, string>,
): string {
  if (!value) return "";
  if (locale !== "vi") return value;

  return map[normalizeKey(value)] || replaceCatalogTerms(value);
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function replaceCatalogTerms(value: string): string {
  return value
    .replace(/\bNew Season\b/gi, "Mùa mới")
    .replace(/\bAccessories\b/gi, "Phụ kiện")
    .replace(/\bBottoms\b/gi, "Quần")
    .replace(/\bDenim\b/gi, "Quần denim")
    .replace(/\bHandbags?\b/gi, "Túi")
    .replace(/\bTotes?\b/gi, "Túi tote")
    .replace(/\bBelts?\b/gi, "Dây nịt")
    .replace(/\bDurags?\b/gi, "Khăn trùm đầu")
    .replace(/\bSunglasses\b/gi, "Kính mát")
    .replace(/\bBracelets?\b/gi, "Vòng tay")
    .replace(/\bBeanies\b/gi, "Mũ len")
    .replace(/\bBeanie\b/gi, "Mũ len")
    .replace(/\bRings?\b/gi, "Nhẫn")
    .replace(/\bWatches\b/gi, "Đồng hồ")
    .replace(/\bWatch\b/gi, "Đồng hồ")
    .replace(/\bLong Sleeves?\b/gi, "Áo tay dài")
    .replace(/\bBombers?\b/gi, "Áo khoác bomber")
    .replace(/\bOuterwear\b/gi, "Áo khoác ngoài")
    .replace(/\bJackets?\b/gi, "Áo khoác")
    .replace(/\bTees?\b/gi, "Áo thun")
    .replace(/\bT-?shirts?\b/gi, "Áo thun")
    .replace(/\bJeans\b/gi, "Quần jeans")
    .replace(/\bSneakers?\b/gi, "Giày sneaker")
    .replace(/\bSlippers?\b/gi, "Dép")
    .replace(/\bBoots?\b/gi, "Bốt")
    .replace(/\bShoes?\b/gi, "Giày")
    .replace(/\bPants\b/gi, "Quần")
    .replace(/\bTrousers\b/gi, "Quần tây")
    .replace(/\bShirts?\b/gi, "Áo sơ mi")
    .replace(/\bTanktops?\b/gi, "Áo tanktop")
    .replace(/\bTank Tops?\b/gi, "Áo tanktop")
    .replace(/\bColors?\b/gi, "Màu")
    .replace(/\bBlack\b/gi, "Đen")
    .replace(/\bWhite\b/gi, "Trắng")
    .replace(/\bsize\b/gi, "size")
    .replace(/\bcategory\b/gi, "danh mục")
    .replace(/\bcategories\b/gi, "danh mục")
    .replace(/\bproduct\b/gi, "sản phẩm")
    .replace(/\bproducts\b/gi, "sản phẩm");
}
