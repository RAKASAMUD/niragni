'use client';
import { useEffect, useRef } from 'react';

/** Fade + 12px rise once when scrolled into view. CSS does the motion; JS only flips data-in. */
export default function Reveal({
  children, index = 0, className = '', as: Tag = 'div',
}: { children: React.ReactNode; index?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.dataset.in = '1'; return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.dataset.in = '1'; io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // @ts-expect-error polymorphic ref
    <Tag ref={ref} className={`reveal ${className}`} style={{ '--i': index } as React.CSSProperties}>
      {children}
    </Tag>
  );
}
