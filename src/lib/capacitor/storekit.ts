import { registerPlugin } from '@capacitor/core';

export type StoreKitTransaction = {
  jwsRepresentation: string;
  productId: string;
  originalTransactionId: string;
  transactionId: string;
  /** ms since epoch, or null for non-subscription products */
  expiresDate: number | null;
};

export type StoreKitPurchaseResult =
  | ({ status: 'purchased' } & StoreKitTransaction)
  | { status: 'cancelled' }
  | { status: 'pending' };

export type StoreKitProduct = {
  id: string;
  displayName: string;
  description: string;
  displayPrice: string;
};

export interface StoreKitPlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreKitProduct[] }>;
  purchase(options: { productId: string; appAccountToken?: string }): Promise<StoreKitPurchaseResult>;
  restorePurchases(): Promise<{ transactions: StoreKitTransaction[] }>;
  getCurrentEntitlements(): Promise<{ transactions: StoreKitTransaction[] }>;
  addListener(
    eventName: 'transactionsUpdated',
    listenerFunc: (transaction: StoreKitTransaction) => void,
  ): Promise<{ remove: () => void }>;
}

export const StoreKit = registerPlugin<StoreKitPlugin>('StoreKit');
