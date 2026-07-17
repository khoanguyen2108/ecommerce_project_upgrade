import type { Locale } from "@/features/i18n/locale";

interface ProductDescriptionContext {
  name?: string | null;
  slug?: string | null;
}

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
  "chrome hearts cross long sleeves": "Áo tay dài Chrome Hearts Cross",
  "lost in translation long sleeves": "Áo tay dài Lost In Translation",
  "grunge long sleeves": "Áo tay dài Grunge",
  "acne studios long sleeves": "Áo tay dài Acne Studios",
  "west coast choppers cross long sleeves": "Áo tay dài West Coast Choppers Cross",
  "henley shirt": "Áo Henley",
  "paly tee": "Áo thun Paly",
  "harun ukic tee": "Áo thun Harun Ukic",
  "y/project tee": "Áo thun Y/Project",
  "saint laurent heritage tee": "Áo thun Saint Laurent Heritage",
  "chrome hearts grillz tee": "Áo thun Chrome Hearts Grillz",
  "acne studio tee": "Áo thun Acne Studio",
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
  "a black graphic tee featuring colorful cross-inspired artwork across the front. a bold statement piece for gothic streetwear, denim outfits, and casual going-out looks.":
    "Áo thun đen với họa tiết thập giá nhiều màu nổi bật ở mặt trước. Một item statement phù hợp với phong cách gothic streetwear, phối cùng denim hoặc các outfit đi chơi thường ngày.",
  "a black leather jacket with bold cross-inspired details and silver-tone hardware. a strong statement outerwear piece for gothic, biker, darkwear, and luxury-streetwear outfits.":
    "Áo khoác da màu đen với chi tiết lấy cảm hứng từ họa tiết thập giá và phụ kiện kim loại tông bạc. Một món outerwear nổi bật cho phong cách gothic, biker, darkwear và luxury streetwear.",
  "a boxy heavyweight cotton tee with dropped shoulders and a durable rib collar.":
    "Áo thun cotton dày dáng boxy, vai rũ nhẹ và cổ bo rib bền form.",
  "a breathable linen-blend midi dress with a square neckline, side pockets, and easy drape.":
    "Đầm midi pha linen thoáng nhẹ, cổ vuông, có túi hai bên và độ rũ tự nhiên.",
  "a bias-cut satin skirt with an elastic waistband and a smooth midi-length silhouette.":
    "Chân váy satin cắt xéo với lưng thun và phom midi mềm mại.",
  "a crisp cotton oxford with a relaxed cut, button-down collar, and softly washed finish.":
    "Áo sơ mi Oxford cotton sắc nét với phom thoải mái, cổ button-down và bề mặt wash mềm.",
  "a fitted ribbed tank in a soft cotton blend, made for layering or wearing solo.":
    "Áo tank dệt gân ôm nhẹ từ cotton blend mềm, có thể mặc riêng hoặc phối layer.",
  "a lightweight cotton overshirt with utility pockets and enough room for layering.":
    "Áo overshirt cotton nhẹ với túi tiện dụng và phom đủ rộng để phối nhiều lớp.",
  "a minimal leather belt with a brushed metal buckle and clean stitched edges.":
    "Dây nịt da tối giản với khóa kim loại xước nhẹ và đường may gọn gàng.",
  "a soft midweight cardigan with a relaxed v-neck, rib trims, and corozo-style buttons.":
    "Áo cardigan dệt kim mềm, độ dày vừa phải, cổ chữ V thoải mái, bo rib và nút kiểu corozo.",
  "a structured cropped denim jacket with easy sleeves and a vintage-inspired wash.":
    "Áo khoác denim dáng croptop có phom đứng, tay áo thoải mái và wash cổ điển.",
  "a sturdy recycled-canvas tote with interior pocketing and reinforced handles.":
    "Túi tote canvas tái chế cứng cáp, có ngăn trong và quai xách gia cố chắc chắn.",
  "clean tapered chinos in a compact stretch twill with a weekday-to-weekend fit.":
    "Quần chino ống côn gọn gàng từ vải twill co giãn nhẹ, dễ mặc từ ngày thường đến cuối tuần.",
  "explore this belikeme category.":
    "Khám phá danh mục Belikeme này.",
  "finishing pieces for daily outfits.":
    "Những món phụ kiện hoàn thiện outfit hằng ngày.",
  "fluid wide-leg trousers with front pleats, a high rise, and a softly tailored fall.":
    "Quần tây ống rộng mềm rũ với ly trước, cạp cao và phom may thanh thoát.",
  "hi":
    "Mô tả sản phẩm đang được cập nhật. Bạn có thể xem hình ảnh, màu sắc và size còn hàng trước khi chọn mua.",
  "light jackets, overshirts, and soft seasonal layers.":
    "Áo khoác nhẹ, overshirt và các lớp phối mềm mại theo mùa.",
  "tees, shirts, tanks, and light knit layers.":
    "Áo thun, sơ mi, tank top và các lớp dệt kim nhẹ.",
  "trousers, skirts, chinos, and everyday separates.":
    "Quần dài, chân váy, quần chino và các món phối hằng ngày.",
};

const PRODUCT_DESCRIPTION_BY_KEY_VI: Record<string, string> = {
  "acne-studio-tee":
    "Áo thun Acne Studio tông đen wash với graphic chữ tối giản, dễ phối cùng denim đen, quần ống loe hoặc giày high-top.",
  "acne-studios-long-sleeves":
    "Áo tay dài Acne Studios tông trắng, phom gọn dễ layer và phù hợp với outfit tối giản hoặc streetwear nhẹ.",
  "baroque-engraved-belt":
    "Dây nịt Baroque Engraved với chi tiết khóa nổi bật, hợp làm điểm nhấn cho outfit denim, gothic hoặc luxury streetwear.",
  "boxy-heavyweight-tee":
    "Áo thun cotton dày dáng boxy, vai rũ nhẹ và cổ bo rib bền form.",
  "canvas-tote-bag":
    "Túi tote canvas tái chế cứng cáp, có ngăn trong và quai xách gia cố chắc chắn.",
  "cartier-x-chrome-hearts-gothic-watch":
    "Đồng hồ Cartier x Chrome Hearts phong cách gothic, tạo điểm nhấn phụ kiện mạnh cho các outfit darkwear và streetwear cao cấp.",
  "chrome-hearts-buckle-belt":
    "Dây nịt Chrome Hearts Buckle với phần khóa nổi bật, dễ tạo điểm nhấn cho quần denim, quần đen và outfit gothic.",
  "chrome-hearts-cemetery-cross-patch-tote":
    "Túi tote Chrome Hearts với patch Cemetery Cross, phù hợp để hoàn thiện outfit streetwear hoặc gothic hằng ngày.",
  "chrome-hearts-cross-long-sleeves":
    "Áo tay dài Chrome Hearts màu beige với họa tiết thập giá, hợp phối cùng quần denim đen hoặc boots để tạo mood gothic streetwear.",
  "chrome-hearts-dagger-slippers":
    "Dép Chrome Hearts Dagger có chi tiết đặc trưng, phù hợp với outfit casual nhưng vẫn giữ điểm nhấn luxury streetwear.",
  "chrome-hearts-durag":
    "Khăn trùm đầu Chrome Hearts giúp hoàn thiện outfit streetwear, darkwear hoặc các set có phụ kiện bạc.",
  "chrome-hearts-grillz-tee":
    "Áo thun Chrome Hearts Grillz tông đen với graphic nổi bật, phù hợp cho outfit streetwear cá tính.",
  "chrome-hearts-jacket":
    "Áo khoác da màu đen với chi tiết lấy cảm hứng từ họa tiết thập giá và phụ kiện kim loại tông bạc. Một món outerwear nổi bật cho phong cách gothic, biker, darkwear và luxury streetwear.",
  "chrome-hearts-jeans":
    "Quần jeans Chrome Hearts với chi tiết mang tinh thần gothic, dễ phối cùng áo thun đen, áo khoác da hoặc phụ kiện bạc.",
  "chrome-hearts-multi-cross-punk-ring":
    "Nhẫn Chrome Hearts Multi-Cross Punk với thiết kế nhiều thập giá, dùng làm điểm nhấn phụ kiện cho outfit gothic hoặc darkwear.",
  "chrome-hearts-multi-cross-tee":
    "Áo thun đen với họa tiết thập giá nhiều màu nổi bật ở mặt trước. Một item statement phù hợp với phong cách gothic streetwear, phối cùng denim hoặc các outfit đi chơi thường ngày.",
  "chrome-hearts-sterling-cuban-bracelet":
    "Vòng tay Chrome Hearts Sterling Cuban tông bạc, hợp phối cùng nhẫn, đồng hồ hoặc outfit streetwear tối màu.",
  "cropped-denim-jacket":
    "Áo khoác denim dáng croptop có phom đứng, tay áo thoải mái và wash cổ điển.",
  "grunge-long-sleeves":
    "Áo tay dài Grunge tông trắng với graphic bụi bặm, hợp phối cùng denim đen hoặc quần ống rộng.",
  "harun-ukic-tee":
    "Áo thun Harun Ukic tông đen với graphic nổi bật, phù hợp cho outfit streetwear và đi chơi.",
  "henley-shirt":
    "Áo Henley tông kem với chất vải gân nhẹ, dễ phối theo hướng casual, vintage hoặc tối giản.",
  "hoodie":
    "Áo hoodie mềm, dễ phối nhiều lớp cho outfit thường ngày hoặc streetwear.",
  "lightweight-utility-overshirt":
    "Áo overshirt cotton nhẹ với túi tiện dụng và phom đủ rộng để phối nhiều lớp.",
  "linen-blend-midi-dress":
    "Đầm midi pha linen thoáng nhẹ, cổ vuông, có túi hai bên và độ rũ tự nhiên.",
  "lost-in-translation-long-sleeves":
    "Áo tay dài Lost In Translation tông đen với graphic điện ảnh, phù hợp với outfit grunge, gothic hoặc streetwear.",
  "luster-flared-denim":
    "Quần denim ống loe Luster với tông đen bóng nhẹ, tạo dáng dài chân và hợp phối cùng áo thun hoặc boots.",
  "minimal-leather-belt":
    "Dây nịt da tối giản với khóa kim loại xước nhẹ và đường may gọn gàng.",
  "monolithic-sunglasses":
    "Kính mát Monolithic phom mạnh, tạo điểm nhấn sắc gọn cho outfit streetwear hoặc darkwear.",
  "paly-tee":
    "Áo thun Paly tông beige nhạt, dễ phối khi cần lựa chọn gần màu trắng cho outfit streetwear hoặc casual.",
  "pleated-wide-leg-trousers":
    "Quần tây ống rộng mềm rũ với ly trước, cạp cao và phom may thanh thoát.",
  "relaxed-oxford-shirt":
    "Áo sơ mi Oxford cotton sắc nét với phom thoải mái, cổ button-down và bề mặt wash mềm.",
  "ribbed-knit-tank":
    "Áo tank dệt gân ôm nhẹ từ cotton blend mềm, có thể mặc riêng hoặc phối layer.",
  "rick-owens-laced-high-top":
    "Giày Rick Owens Laced High-Top có phom cổ cao và dây buộc đặc trưng, hợp với outfit darkwear, avant-garde hoặc streetwear.",
  "saint-laurent-heritage-tee":
    "Áo thun Saint Laurent Heritage tông kem vintage, dễ phối với denim đen, quần ống rộng hoặc phụ kiện bạc.",
  "satin-slip-skirt":
    "Chân váy satin cắt xéo với lưng thun và phom midi mềm mại.",
  "stussy-knit-beanie":
    "Mũ len Stussy Knit giúp hoàn thiện outfit streetwear, giữ tổng thể gọn và dễ phối.",
  "tapered-chino-pants":
    "Quần chino ống côn gọn gàng từ vải twill co giãn nhẹ, dễ mặc từ ngày thường đến cuối tuần.",
  "tee":
    "Áo thun basic dễ phối, phù hợp cho outfit thường ngày hoặc phối layer.",
  "west-coast-choppers-cross-long-sleeves":
    "Áo tay dài West Coast Choppers Cross tông trắng với graphic thập giá, hợp phối cùng denim hoặc boots.",
  "y-project-tee":
    "Áo thun Y/Project với hiệu ứng wash và graphic nổi bật, phù hợp cho outfit streetwear cá tính.",
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
  context: ProductDescriptionContext = {},
): string | null {
  if (locale !== "vi") return description || null;

  const contextual = localizeProductDescriptionByContext(context);
  if (contextual) return contextual;

  if (!description) return null;

  const exact = DESCRIPTION_VI[normalizeKey(description)];
  if (exact) return exact;

  if (looksVietnamese(description)) return description;

  return buildGenericProductDescription(context) || description;
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

function localizeProductDescriptionByContext(
  context: ProductDescriptionContext,
): string | null {
  const keys = buildDescriptionLookupKeys(context);

  for (const key of keys) {
    const exact = PRODUCT_DESCRIPTION_BY_KEY_VI[key];
    if (exact) return exact;
  }

  return null;
}

function buildDescriptionLookupKeys(context: ProductDescriptionContext): string[] {
  const keys = new Set<string>();

  for (const value of [context.slug, context.name]) {
    if (!value) continue;

    const normalized = normalizeKey(value);
    keys.add(normalized);
    keys.add(normalized.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""));
  }

  return [...keys].filter(Boolean);
}

function buildGenericProductDescription(
  context: ProductDescriptionContext,
): string | null {
  if (!context.name) return null;

  const productName = localizeProductName(context.name, "vi");
  const normalizedName = normalizeKey(productName);

  if (/áo thun|áo tay dài|áo sơ mi|áo henley|áo hoodie|áo tank/.test(normalizedName)) {
    return `${productName} có phom dễ mặc, phù hợp để phối cùng denim, quần đen hoặc các outfit thường ngày.`;
  }

  if (/áo khoác|cardigan|overshirt/.test(normalizedName)) {
    return `${productName} là lớp khoác dễ phối, giúp outfit có chiều sâu hơn khi đi chơi hoặc mặc hằng ngày.`;
  }

  if (/quần|denim|trousers|chino|skirt|chân váy/.test(normalizedName)) {
    return `${productName} có phom dễ phối, phù hợp đi cùng áo thun, áo sơ mi hoặc giày statement.`;
  }

  if (/giày|bốt|dép|sneaker/.test(normalizedName)) {
    return `${productName} giúp hoàn thiện outfit và tạo điểm nhấn rõ hơn cho tổng thể.`;
  }

  if (/túi|dây nịt|khăn|kính|vòng|mũ|nhẫn|đồng hồ/.test(normalizedName)) {
    return `${productName} là phụ kiện hoàn thiện outfit, phù hợp để tạo điểm nhấn mà vẫn dễ phối.`;
  }

  return `${productName} có thiết kế dễ phối, phù hợp để hoàn thiện nhiều outfit hằng ngày.`;
}

function looksVietnamese(value: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    value,
  );
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
