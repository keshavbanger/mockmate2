import { useEffect } from 'react';

/**
 * Sets per-route title, meta description, and canonical URL, then restores
 * the static index.html defaults on unmount.
 *
 * Why this exists: index.html has ONE static canonical tag pointing at the
 * homepage, served for every route in this client-rendered SPA (no
 * react-helmet in this project, no per-route server rendering). Left as-is,
 * that tells Google every non-homepage URL — including every blog post — is
 * a duplicate of "/" and shouldn't be indexed on its own. title/description
 * have the same "every route looks identical" problem, just less severe.
 *
 * jsonLd (optional) is stringified and injected as a tagged <script>,
 * removed on unmount so navigating away doesn't leave stale structured data
 * behind for the next page that doesn't call this hook.
 */
export function useSeo({ title, description, path, jsonLd }) {
  useEffect(() => {
    const defaultTitle = document.title;
    const descMeta = document.querySelector('meta[name="description"]');
    const defaultDescription = descMeta?.getAttribute('content');
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const defaultCanonical = canonicalLink?.getAttribute('href');

    if (title) document.title = title;
    if (description) descMeta?.setAttribute('content', description);
    if (path && canonicalLink) canonicalLink.setAttribute('href', `https://www.mockmate.live${path}`);

    let script;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.title = defaultTitle;
      if (defaultDescription !== undefined) descMeta?.setAttribute('content', defaultDescription);
      if (defaultCanonical && canonicalLink) canonicalLink.setAttribute('href', defaultCanonical);
      script?.remove();
    };
  }, [title, description, path, jsonLd]);
}
