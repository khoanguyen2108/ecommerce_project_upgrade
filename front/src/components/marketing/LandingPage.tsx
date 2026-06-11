import {
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { categories, newArrivals } from "@/features/marketing/storefront-data";

export function LandingPage() {
  return (
    <main>
      <section className="hero-section" aria-labelledby="hero-heading">
        <Image
          alt="Models wearing minimalist neutral clothing in a fashion campaign"
          className="hero-section__image"
          fill
          priority
          sizes="100vw"
          src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85"
        />
        <div className="hero-section__shade" />
        <div className="hero-section__content">
          <p className="eyebrow">New season essentials</p>
          <h1 id="hero-heading">Elevate your everyday wardrobe</h1>
          <p>
            Crisp cotton, soft tailoring, and easy layers selected for real
            days, repeat wear, and clean silhouettes.
          </p>
          <div className="hero-section__actions">
            <Link className="button button--primary" href="#new-arrivals">
              Explore products <ArrowRight size={18} />
            </Link>
            <Link className="button button--secondary button--on-image" href="#categories">
              Browse categories
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--categories" id="categories">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Shop by edit</p>
          <h2>Featured categories</h2>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-tile" href={category.href} key={category.name}>
              <Image
                alt={`${category.name} category`}
                className="category-tile__image"
                fill
                sizes="(min-width: 900px) 33vw, 100vw"
                src={category.imageUrl}
              />
              <div className="category-tile__label">
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section--muted" id="new-arrivals">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Just landed</p>
            <h2>New arrivals</h2>
          </div>
          <Link className="text-link" href="#new-arrivals">
            View all
          </Link>
        </div>
        <div className="product-grid">
          {newArrivals.map((product) => (
            <article className="product-card" key={product.name}>
              <div className="product-card__image-wrap">
                <Image
                  alt={product.name}
                  className="product-card__image"
                  fill
                  sizes="(min-width: 1100px) 25vw, (min-width: 640px) 50vw, 100vw"
                  src={product.imageUrl}
                />
              </div>
              <div className="product-card__body">
                <h3>{product.name}</h3>
                <p className="product-card__price">{product.price}</p>
                <p className="product-card__meta">
                  {product.colors.join(" / ")} - {product.sizes.join(", ")}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section trust-section" id="trust">
        <div className="trust-grid">
          <TrustItem
            icon={<Truck size={24} />}
            title="Fast delivery"
            text="Packed within one business day for in-stock items."
          />
          <TrustItem
            icon={<RotateCcw size={24} />}
            title="Easy returns"
            text="Seven-day return window for unworn items with tags."
          />
          <TrustItem
            icon={<ShieldCheck size={24} />}
            title="Secure payment"
            text="Payment handoff is handled by backend-verified flows."
          />
          <TrustItem
            icon={<Headphones size={24} />}
            title="Support"
            text="Human help for sizing, delivery, and account questions."
          />
        </div>
      </section>

      <section className="campaign-band" id="delivery">
        <div>
          <p className="eyebrow">Weekend edit</p>
          <h2>Soft structure for long city days</h2>
          <p>
            Layer quiet textures, neutral tones, and reliable cuts without
            making the outfit feel overworked.
          </p>
        </div>
        <Link className="button button--light" href="#new-arrivals">
          Shop the edit
        </Link>
      </section>
    </main>
  );
}

interface TrustItemProps {
  icon: React.ReactNode;
  title: string;
  text: string;
}

function TrustItem({ icon, title, text }: TrustItemProps) {
  return (
    <article className="trust-item">
      <div className="trust-item__icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}
