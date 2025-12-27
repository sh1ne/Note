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
        parseHTML: (element) => element.getAttribute('width') || element.style.width,
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
            style: `width: ${attributes.width}; height: auto; max-width: 100%;`,
          };
        },
      },
    };
  },
});

