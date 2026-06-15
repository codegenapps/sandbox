import * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        'auto-rotate'?: any;
        'camera-controls'?: any;
        'shadow-intensity'?: string;
        className?: string;
        loading?: string;
      };
    }
  }
}
