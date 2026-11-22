import { CartView } from './_components/cart-view';

export const metadata = { title: 'Cart | Provenance' };

export default function CartPage() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl text-wine">Your cart</h1>
        <div className="mt-8">
          <CartView />
        </div>
      </div>
    </div>
  );
}
