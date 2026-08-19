/**
 * Helpers for resolving Apple store transaction IDs from RevenueCat CustomerInfo.
 * Used client-side after purchase/restore; the server re-validates via RC REST API.
 */

type SubscriptionInfoLike = {
  storeTransactionId?: string | null;
};

type CustomerInfoLike = {
  subscriptionsByProductIdentifier?: Record<string, SubscriptionInfoLike>;
};

type StoreTransactionLike = {
  transactionIdentifier?: string;
};

/**
 * Best-effort original transaction ID from RevenueCat SDK data.
 * Returns null when the SDK does not expose a store transaction for the product.
 */
export function resolveOriginalTransactionId(
  customerInfo: CustomerInfoLike,
  productId: string,
  purchaseTransaction?: StoreTransactionLike | null,
): string | null {
  // Fresh purchase: transaction object from MakePurchaseResult
  if (purchaseTransaction?.transactionIdentifier) {
    return purchaseTransaction.transactionIdentifier;
  }

  // Restore / existing subscription: subscriptionsByProductIdentifier (RC SDK v13+)
  const storeTransactionId =
    customerInfo.subscriptionsByProductIdentifier?.[productId]?.storeTransactionId;
  if (storeTransactionId) {
    return storeTransactionId;
  }

  return null;
}

/** True when the value is an App Store product identifier, not a transaction ID. */
export function isAppleProductId(id: string): boolean {
  return id.startsWith('com.provenance.app.');
}
