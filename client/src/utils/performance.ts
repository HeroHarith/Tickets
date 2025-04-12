/**
 * Utility functions for frontend performance optimization
 */
import React from 'react';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * This is useful for performance optimization on input fields, window resize events, etc.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the original function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait = 300
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds
 * This is useful for scroll events, mouse movements, etc. where you don't want to trigger too often
 * 
 * @param func The function to throttle
 * @param limit The number of milliseconds to throttle invocations to
 * @returns A throttled version of the original function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit = 300
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Creates a memoized version of a function
 * Caches the result of the function call based on its arguments
 * 
 * @param func The function to memoize
 * @returns A memoized version of the function
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, ReturnType<T>>();
  
  return function(...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Creates an image with preload hint
 * This helps with performance by preloading images before they're visible
 * 
 * @param src The image source URL
 * @returns A preloaded image element (not mounted to DOM)
 */
export function preloadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

/**
 * Checks if lazy loading is supported in the browser
 */
export function isLazyLoadSupported(): boolean {
  return 'loading' in HTMLImageElement.prototype;
}

/**
 * Creates a lazy-loaded image element
 * Falls back to eager loading if not supported
 * 
 * @param src The image source URL
 * @param alt The image alt text
 * @param className Optional CSS class name
 * @returns A React-compatible object with props for an image
 */
export function lazyLoadImageProps(
  src: string,
  alt: string,
  className?: string
): {
  src: string;
  alt: string;
  loading: 'lazy' | 'eager';
  className?: string;
} {
  return {
    src,
    alt,
    loading: isLazyLoadSupported() ? 'lazy' : 'eager',
    className
  };
}

/**
 * Measure component render time
 * Use as HOC: measureRenderTime(MyComponent, 'MyComponent')
 * 
 * @param Component The component to measure
 * @param componentName Name to use in logging
 * @returns The wrapped component with timing
 */
export function measureRenderTime<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  const MeasuredComponent: React.FC<P> = (props) => {
    const start = performance.now();
    // Use createElement instead of JSX syntax to avoid babel/TS issues
    const result = React.createElement(Component, props);
    const end = performance.now();
    
    console.debug(`[PERF] ${componentName} rendered in ${(end - start).toFixed(2)}ms`);
    
    return result;
  };
  
  MeasuredComponent.displayName = `Measured(${componentName})`;
  return MeasuredComponent;
}