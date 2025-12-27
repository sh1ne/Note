'use client';

import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

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
            return {};
          }
          // Always use style attribute for better compatibility
          const widthValue = typeof attributes.width === 'string' 
            ? attributes.width 
            : `${attributes.width}px`;
          return {
            style: `width: ${widthValue}; height: auto; max-width: 100%; display: block;`,
          };
        },
      },
    };
  },
});

