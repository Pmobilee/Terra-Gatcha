/**
 * TypeScript types for RevenueCat REST API responses and S2S webhook events.
 * DD-V2-140: RevenueCat is the single source of truth for IAP receipts.
 */

/** Subscriber response from RevenueCat REST v1 API */
export interface RCSubscriberResponse {
  subscriber: {
    subscriptions: Record<string, {
      expires_date: string        // ISO 8601
      purchase_date: string
      product_identifier: string
      period_type: 'normal' | 'trial'
      is_sandbox: boolean
    }>
    entitlements: Record<string, {
      expires_date: string | null
      product_identifier: string
    }>
    non_subscriptions: Record<string, { id: string; purchase_date: string }[]>
  }
}

/** S2S webhook event posted by RevenueCat */
export interface RCWebhookEvent {
  event: {
    type:
      | 'INITIAL_PURCHASE'
      | 'RENEWAL'
      | 'CANCELLATION'
      | 'EXPIRATION'
      | 'PRODUCT_CHANGE'
      | 'NON_RENEWING_PURCHASE'
    app_user_id: string
    product_id: string
    period_type: 'normal' | 'trial'
    expiration_at_ms: number
    purchased_at_ms: number
    environment: 'SANDBOX' | 'PRODUCTION'
  }
}
