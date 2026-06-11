export interface CategoryPreview {
  name: string;
  description: string;
  imageUrl: string;
  href: string;
}

export interface ProductPreview {
  name: string;
  price: string;
  colors: string[];
  sizes: string[];
  imageUrl: string;
}

export const categories: CategoryPreview[] = [
  {
    name: "Daily Tees",
    description: "Clean cotton layers for every rotation.",
    href: "#new-arrivals",
    imageUrl:
      "https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Outerwear",
    description: "Light jackets, overshirts, and city-ready cover.",
    href: "#new-arrivals",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Soft Tailoring",
    description: "Relaxed trousers and structured essentials.",
    href: "#new-arrivals",
    imageUrl:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
  },
];

export const newArrivals: ProductPreview[] = [
  {
    name: "Boxy Cotton Overshirt",
    price: "890,000 VND",
    colors: ["Washed black", "Stone"],
    sizes: ["S", "M", "L"],
    imageUrl:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Wide-Leg Pleated Trouser",
    price: "1,190,000 VND",
    colors: ["Oat", "Charcoal"],
    sizes: ["S", "M", "L", "XL"],
    imageUrl:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Rib Knit Everyday Tee",
    price: "420,000 VND",
    colors: ["White", "Olive", "Black"],
    sizes: ["XS", "S", "M", "L"],
    imageUrl:
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Linen Blend Work Jacket",
    price: "1,490,000 VND",
    colors: ["Sage", "Ink"],
    sizes: ["M", "L", "XL"],
    imageUrl:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80",
  },
];
