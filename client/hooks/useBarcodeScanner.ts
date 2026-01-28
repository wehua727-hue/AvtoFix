/**
 * Global Barcode Scanner Hook
 * 
 * Supports USB/HID/Laser barcode scanners that act as keyboard input.
 * Features:
 * - Global listener (works without input focus)
 * - Enter key detection for scan completion
 * - Configurable minimum length
 * 
 * MUHIM: Scanner Enter yuborishi kerak!
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeSccannerOptions {
  /** Callback when barcode is scanned */
  onScan: (barcode: string) => void;
  /** Minimum barcode length to trigger scan (default: 1) */
  minLength?: number;
  /** Maximum time between keystrokes in ms (default: 100) */
  debounceTime?: number;
  /** Maximum time to wait for complete barcode in ms (default: 500) */
  scanTimeout?: number;
  /** Whether scanner is enabled (default: true) */
  enabled?: boolean;
  /** Prevent default on Enter key (default: true) */
  preventDefault?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minLength = 1,
  debounceTime = 100,
  scanTimeout = 1000, // 1 sekund - scanner uchun yetarli
  enabled = true,
  preventDefault = true,
}: UseBarcodeSccannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const processBarcode = useCallback(() => {
    const barcode = bufferRef.current.trim();
    
    if (barcode.length >= minLength) {
      onScan(barcode);
    }
    clearBuffer();
  }, [onScan, minLength, clearBuffer]);

  useEffect(() => {
    
    if (!enabled) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Check if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = 
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      // Input da yozayotgan bo'lsa, scanner ishlamasin
      if (isInputFocused) {
        return;
      }

      // Modifier keys - o'tkazib yuborish (log qilmasdan)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Faqat muhim eventlarni log qilish
      // Enter yoki Tab - barcodeni qayta ishlash
      if (e.key === 'Enter' || e.key === 'Tab') {
        
        if (bufferRef.current.length >= minLength) {
          if (preventDefault) {
            e.preventDefault();
            e.stopPropagation();
          }
          processBarcode();
        } else {
          clearBuffer();
        }
        return;
      }

      // Faqat printable characters
      if (e.key.length !== 1) {
        return;
      }

      // Agar juda uzoq vaqt o'tgan bo'lsa, bufferni tozalash
      if (timeSinceLastKey > scanTimeout && bufferRef.current.length > 0) {
        clearBuffer();
      }

      // Belgini bufferga qo'shish
      bufferRef.current += e.key;

      // Timeout - agar Enter kelmasa, bufferni tozalash
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        // Agar buffer uzun bo'lsa va Enter kelmagan bo'lsa, 
        // baribir barcodeni qayta ishlash (ba'zi scannerlar Enter yubormasligi mumkin)
        if (bufferRef.current.length >= 8) {
          processBarcode();
        } else {
          clearBuffer();
        }
      }, scanTimeout);
    };

    // Capture phase - boshqa handlerlardan oldin
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, minLength, scanTimeout, preventDefault, processBarcode, clearBuffer]);

  return {
    clearBuffer,
  };
}

export default useBarcodeScanner;
