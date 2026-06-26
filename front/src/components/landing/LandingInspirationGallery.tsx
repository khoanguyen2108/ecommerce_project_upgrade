"use client";

import { useEffect, useState } from "react";
import { getLandingGallery } from "@/features/landing/api";
import type { LandingGalleryImage } from "@/features/landing/types";

interface LandingGalleryState {
  images: LandingGalleryImage[];
  isLoading: boolean;
}

export function LandingInspirationGallery() {
  const [gallery, setGallery] = useState<LandingGalleryState>({
    images: [],
    isLoading: true,
  });
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadGallery() {
      setGallery((current) => ({ ...current, isLoading: true }));

      try {
        const images = await getLandingGallery();

        if (!isMounted) {
          return;
        }

        setFailedImageIds(new Set());
        setGallery({
          images,
          isLoading: false,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setGallery({
          images: [],
          isLoading: false,
        });
      }
    }

    void loadGallery();

    return () => {
      isMounted = false;
    };
  }, []);

  if (gallery.isLoading) {
    return (
      <section
        aria-label="Style inspiration loading"
        className="landing-gallery landing-gallery--loading"
      >
        <GalleryHeading />
        <div className="landing-gallery__track" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="landing-gallery__skeleton" key={index} />
          ))}
        </div>
      </section>
    );
  }

  const visibleImages = gallery.images.filter(
    (image) => !failedImageIds.has(image.id),
  );

  if (visibleImages.length === 0) {
    return null;
  }

  return (
    <section className="landing-gallery" aria-labelledby="landing-gallery-heading">
      <GalleryHeading />
      <div className="landing-gallery__track">
        {visibleImages.slice(0, 10).map((image, index) => (
          <figure
            className={`landing-gallery__item ${
              index === 0 ? "landing-gallery__item--feature" : ""
            }`}
            key={image.id}
          >
            <img
              alt={getImageAlt(image)}
              className="landing-gallery__image"
              loading={index < 2 ? "eager" : "lazy"}
              onError={() =>
                setFailedImageIds((current) => {
                  const next = new Set(current);
                  next.add(image.id);
                  return next;
                })
              }
              src={image.imageUrl}
            />
            {image.title || image.caption ? (
              <figcaption className="landing-gallery__caption">
                {image.title ? <strong>{image.title}</strong> : null}
                {image.caption ? <span>{image.caption}</span> : null}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

function GalleryHeading() {
  return (
    <div className="landing-gallery__heading">
      <p className="eyebrow">STYLE FILE</p>
      <h2 id="landing-gallery-heading">Looks worth saving</h2>
      <p>
        A rotating moodboard of pieces, movement, and everyday confidence from
        Belikeme.
      </p>
    </div>
  );
}

function getImageAlt(image: LandingGalleryImage): string {
  const altText = image.altText?.trim();

  if (altText) {
    return altText;
  }

  return image.title?.trim() || "Belikeme style inspiration";
}
