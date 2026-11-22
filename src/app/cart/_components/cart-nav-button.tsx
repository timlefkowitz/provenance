'use client';

import Link from 'next/link';

import { ShoppingBag } from 'lucide-react';

import { useCart } from '~/lib/cart/cart-store';

/** Cart icon with a count; hidden while the cart is empty. */
export function CartNavButton() {
  const { count } = useCart();
  if (count === 0) return null;
  return (
    <Link
      href="/cart"
      className="relative p-2 text-ink hover:text-wine transition-colors"
      title="Cart"
      aria-label={`Cart, ${count} ${count === 1 ? 'work' : 'works'}`}
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vermillion px-1 text-[10px] font-semibold leading-none text-bone">
        {count}
      </span>
    </Link>
  );
}
