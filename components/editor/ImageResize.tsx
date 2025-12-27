'use client';

import Image from '@tiptap/extension-image';

// Extended Image extension with width attribute support
export const ImageResize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width') || element.style.width;
          return width;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {
              style: 'max-width: 100%; height: auto; display: block;',
            };
          }
          // Always use style attribute for better compatibility
          const widthValue = typeof attributes.width === 'string' 
            ? attributes.width 
            : `${attributes.width}px`;
          
          // For fixed pixel sizes, use exact width without max-width constraint
          // This allows images to be larger than container if needed (with horizontal scroll)
          // For percentage or auto, use max-width: 100% to prevent overflow
          const isPercentage = widthValue === '100%';
          const isAuto = widthValue === 'auto';
          
          if (isAuto) {
            // Original size - use max-width to prevent overflow
            return {
              style: 'max-width: 100%; height: auto; display: block;',
            };
          } else if (isPercentage) {
            // Full width - use 100% with max-width as safety
            return {
              style: `width: 100%; height: auto; max-width: 100%; display: block;`,
            };
          } else {
            // Fixed pixel size (150px, 300px, 500px) - use exact width
            // Don't use max-width: 100% here, let it be the exact size
            // The container should handle overflow if needed
            return {
              style: `width: ${widthValue}; height: auto; display: block;`,
            };
          }
        },
      },
    };
  },
});
