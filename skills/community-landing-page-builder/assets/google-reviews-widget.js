(() => {
  "use strict";

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const monthYear = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(value);
  };

  const renderReview = (review, reviewsUri) => {
    const card = el("article", "google-review-card");
    card.setAttribute("data-provider-review", "google_places");

    const author = review.authorAttribution || {};
    const head = el("div", "google-review-author");
    if (author.photoURI) {
      const avatar = el("img", "google-review-avatar");
      avatar.src = author.photoURI;
      avatar.alt = author.displayName ? author.displayName + ", Google reviewer" : "Google reviewer";
      avatar.loading = "lazy";
      avatar.referrerPolicy = "no-referrer";
      head.appendChild(avatar);
    }

    const authorBlock = el("div", "google-review-author-copy");
    const name = author.uri ? el("a", "google-review-author-name", author.displayName || "Google reviewer") : el("span", "google-review-author-name", author.displayName || "Google reviewer");
    if (author.uri) {
      name.href = author.uri;
      name.target = "_blank";
      name.rel = "noopener noreferrer";
    }
    authorBlock.appendChild(name);

    const meta = el("div", "google-review-meta");
    if (review.rating !== undefined && review.rating !== null) {
      const rating = el("span", "google-review-rating", review.rating + " / 5");
      rating.setAttribute("aria-label", review.rating + " out of 5 stars");
      meta.appendChild(rating);
    }
    const date = monthYear(review.publishTime);
    if (date) meta.appendChild(el("span", "google-review-date", date));
    if (review.visitDateYear && review.visitDateMonth) {
      const visit = monthYear(new Date(review.visitDateYear, review.visitDateMonth - 1, 1));
      if (visit) meta.appendChild(el("span", "google-review-visit-date", "Visited " + visit));
    }
    authorBlock.appendChild(meta);
    head.appendChild(authorBlock);
    card.appendChild(head);

    if (review.text) card.appendChild(el("blockquote", "google-review-text", review.text));

    const source = review.googleMapsURI || reviewsUri || author.uri;
    if (source) {
      const link = el("a", "google-review-source", "View on Google Maps");
      link.href = source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.appendChild(link);
    }
    return card;
  };

  async function renderWidget(node) {
    if (node.dataset.googleReviewsReady === "true") return;
    const placeId = node.dataset.googleReviewsPlaceId;
    if (!placeId) throw new Error("Google reviews widget requires a Place ID");
    if (!window.google || !google.maps || !google.maps.importLibrary) {
      throw new Error("Google Maps JavaScript API is not loaded");
    }

    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: placeId });
    await place.fetchFields({
      fields: ["displayName", "reviews", "rating", "userRatingCount", "googleMapsLinks", "googleMapsURI"],
    });

    const limit = Math.max(1, Math.min(Number(node.dataset.googleReviewsLimit || 3), 5));
    const reviews = Array.isArray(place.reviews) ? place.reviews.slice(0, limit) : [];
    const reviewsUri = place.googleMapsLinks && place.googleMapsLinks.reviewsURI
      ? place.googleMapsLinks.reviewsURI
      : place.googleMapsURI;

    const title = node.dataset.googleReviewsTitle || "What customers say";
    const notice = node.dataset.googleReviewsNotice || "Google reviews are shown in the order returned by Google; no additional filtering is applied.";

    const fragment = document.createDocumentFragment();
    fragment.appendChild(el("h2", "google-reviews-title", title));
    const attribution = el("div", "google-maps-attribution", "Google Maps");
    attribution.setAttribute("translate", "no");
    attribution.setAttribute("aria-label", "Google Maps");
    fragment.appendChild(attribution);
    fragment.appendChild(el("p", "google-reviews-notice", notice));

    const list = el("div", "google-reviews-list");
    if (reviews.length) {
      reviews.forEach((review) => list.appendChild(renderReview(review, reviewsUri)));
    } else {
      list.appendChild(el("p", "google-reviews-empty", "No Google reviews are currently available to display."));
    }
    fragment.appendChild(list);

    node.replaceChildren(fragment);
    node.dataset.googleReviewsReady = "true";
  }

  async function initGoogleReviewWidgets() {
    const widgets = [...document.querySelectorAll("[data-google-reviews-widget]")];
    for (const node of widgets) {
      try {
        await renderWidget(node);
      } catch (error) {
        node.dataset.googleReviewsReady = "error";
        node.dispatchEvent(new CustomEvent("google-reviews-error", { detail: String(error && error.message || error) }));
      }
    }
  }

  window.initGoogleReviewWidgets = initGoogleReviewWidgets;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (window.google && google.maps && google.maps.importLibrary) initGoogleReviewWidgets();
    }, { once: true });
  } else if (window.google && google.maps && google.maps.importLibrary) {
    initGoogleReviewWidgets();
  }

  window.addEventListener("google-maps-ready", initGoogleReviewWidgets);
})();
