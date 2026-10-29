import sanitizeHtml from 'sanitize-html';
export function cleanPage(input: unknown) {
  const data = input as Record<string, unknown>;
  if (!data || typeof data.html !== 'string' || typeof data.css !== 'string' || typeof data.title !== 'string') throw new Error('Ungültige Seitendaten.');
  if (data.html.length + data.css.length > 2000000 || data.title.length > 180) throw new Error('Die Seite ist zu groß. Bilder bitte über die Mediathek hochladen.');
  return {
    title: data.title,
    html: sanitizeHtml(data.html, {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'section', 'article', 'header', 'footer', 'nav', 'main', 'div', 'span', 'button', 'svg', 'path', 'circle'],
      allowedAttributes: { '*': ['id', 'class', 'style', 'title', 'role', 'aria-*', 'data-gjs-*'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading', 'width', 'height'], svg: ['viewBox', 'aria-hidden'], path: ['d'], circle: ['cx', 'cy', 'r'] },
      allowedSchemes: ['https', 'http', 'mailto', 'tel'],
      allowProtocolRelative: false,
      parseStyleAttributes: false,
    }),
    css: data.css.replace(/<\/?style[^>]*>/gi, '').replace(/@import\s+[^;]+;/gi, ''),
  };
}
