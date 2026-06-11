import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="about">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link className="brand-mark" href="/">
            BELIKEME
          </Link>
          <p>Elevated everyday clothing for a modern wardrobe.</p>
        </div>

        <div className="site-footer__links" aria-label="Footer links">
          <div>
            <h2>Support</h2>
            <Link href="/#delivery">Shipping and returns</Link>
            <Link href="/login">Account help</Link>
            <Link href="/#new-arrivals">New arrivals</Link>
          </div>
          <div>
            <h2>Store</h2>
            <Link href="/#categories">Categories</Link>
            <Link href="/#trust">Why Belikeme</Link>
            <Link href="/register">Create account</Link>
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>&copy; 2026 BELIKEME. ALL RIGHTS RESERVED.</span>
      </div>
    </footer>
  );
}
