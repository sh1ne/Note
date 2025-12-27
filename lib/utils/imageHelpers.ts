/**
 * Extract image URLs from HTML content
 */
export function extractImageUrls(htmlContent: string): string[] {
  if (!htmlContent) return [];
  
  const imageUrls: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const images = doc.querySelectorAll('img[src]');
  
  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:') && !imageUrls.includes(src)) {
      // Only include non-data URLs (Firebase Storage URLs)
      imageUrls.push(src);
    }
  });
  
  return imageUrls;
}

