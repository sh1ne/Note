/**
 * Extract image URLs from HTML content
 * Works in both browser and Node.js environments
 */
export function extractImageUrls(htmlContent: string): string[] {
  if (!htmlContent || typeof htmlContent !== 'string') return [];
  
  const imageUrls: string[] = [];
  
  // Use regex to extract image URLs (works in all environments)
  // Match <img> tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    // Only include non-data URLs (Firebase Storage URLs)
    // Exclude base64 data URLs and empty strings
    if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !imageUrls.includes(url)) {
      imageUrls.push(url);
    }
  }
  
  return imageUrls;
}
