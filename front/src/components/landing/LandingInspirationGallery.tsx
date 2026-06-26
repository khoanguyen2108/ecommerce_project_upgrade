"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLandingGallery } from "@/features/landing/api";
import type { LandingGalleryImage } from "@/features/landing/types";

interface LandingGalleryState {
  images: LandingGalleryImage[];
  isLoading: boolean;
}

export function LandingInspirationGallery() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [gallery, setGallery] = useState<LandingGalleryState>({
    images: [],
    isLoading: true,
  });
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleImages = gallery.images.filter(
    (image) => !failedImageIds.has(image.id),
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

  useEffect(() => {
    const updateTimer = window.setTimeout(updateScrollState, 0);

    window.addEventListener("resize", updateScrollState);

    return () => {
      window.clearTimeout(updateTimer);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [gallery.isLoading, visibleImages.length]);

  function updateScrollState() {
    const track = trackRef.current;

    if (!track) {
      setScrollState({
        canScrollLeft: false,
        canScrollRight: false,
      });
      return;
    }

    const maxScrollLeft = track.scrollWidth - track.clientWidth;

    setScrollState({
      canScrollLeft: track.scrollLeft > 4,
      canScrollRight: track.scrollLeft < maxScrollLeft - 4,
    });
  }

  function scrollGallery(direction: "previous" | "next") {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    track.scrollBy({
      behavior: "smooth",
      left:
        direction === "next"
          ? track.clientWidth * 0.82
          : -track.clientWidth * 0.82,
    });

    window.setTimeout(updateScrollState, 280);
  }

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

  if (visibleImages.length === 0) {
    return null;
  }

  return (
    <section className="landing-gallery" aria-labelledby="landing-gallery-heading">
      <div className="landing-gallery__topline">
        <GalleryHeading />
        {visibleImages.length > 1 ? (
          <div
            className="landing-gallery__controls"
            aria-label="Style file carousel controls"
          >
            <button
              aria-label="Previous inspiration images"
              className="icon-button landing-gallery__control"
              disabled={!scrollState.canScrollLeft}
              onClick={() => scrollGallery("previous")}
              title="Previous"
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.9} />
            </button>
            <button
              aria-label="Next inspiration images"
              className="icon-button landing-gallery__control"
              disabled={!scrollState.canScrollRight}
              onClick={() => scrollGallery("next")}
              title="Next"
              type="button"
            >
              <ArrowRight aria-hidden="true" size={18} strokeWidth={1.9} />
            </button>
          </div>
        ) : null}
      </div>
      <div
        className="landing-gallery__track"
        onScroll={updateScrollState}
        ref={trackRef}
      >
        {visibleImages.slice(0, 10).map((image, index) => (
          <figure className="landing-gallery__item" key={image.id}>
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
      <h2 id="landing-gallery-heading">Looks worth saving</h2>
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
