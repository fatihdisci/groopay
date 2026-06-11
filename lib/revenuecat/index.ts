// ──────────────────────────────────────
// RevenueCat SDK wrapper
// Faz 7: IAP (StoreKit + Billing) via RevenueCat
//
// Expo Go: native module unavailable → graceful fallback.
//   UI renders, "purchase" shows "dev build required" message.
//   No crash.
// Dev build (EAS): full IAP works.
// ──────────────────────────────────────

import { Platform } from 'react-native';
import Constants from 'expo-constants';
// react-native-purchases native calls fail gracefully in Expo Go;
// the import itself works fine (JS bundle), only native methods throw.
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

// ── RevenueCat API key validation ──
// Apple keys start with 'appl_', Google keys start with 'goog_'.
// Anything else is a placeholder and should not be passed to Purchases.configure().
const RC_APPLE_KEY_PREFIX = 'appl_';
const RC_GOOGLE_KEY_PREFIX = 'goog_';
const USER_PRO_ENTITLEMENT_ID = 'user_pro';
const USER_PRO_PRODUCT_ID = 'com.groopay.app.userpro';

// ── Module-level state ──

let _nativeAvailable = false;
let _initError: string | null = null;
let _configuredUserId: string | null = null;

interface RevenueCatError {
  message?: string;
  userCancelled?: boolean;
  code?: string | number;
  underlyingErrorMessage?: string;
}

function toRevenueCatError(error: unknown): RevenueCatError {
  if (typeof error !== 'object' || error === null) return {};
  const value = error as Record<string, unknown>;
  return {
    message: typeof value.message === 'string' ? value.message : undefined,
    userCancelled: value.userCancelled === true,
    code: typeof value.code === 'string' || typeof value.code === 'number'
      ? value.code
      : undefined,
    underlyingErrorMessage: typeof value.underlyingErrorMessage === 'string'
      ? value.underlyingErrorMessage
      : undefined,
  };
}

/** Logs the current RevenueCat appUserID and CustomerInfo (entitlements/subscriptions only — no PII). */
async function logAppUserIdAndCustomerInfo(): Promise<void> {
  try {
    const id = await Purchases.getAppUserID();
    console.log('[rc] getAppUserID after configure/login:', id);
  } catch (error: unknown) {
    console.log('[rc] getAppUserID failed:', toRevenueCatError(error).message);
  }

  try {
    const info = await Purchases.getCustomerInfo();
    console.log('[rc] getCustomerInfo success — active entitlement keys:', Object.keys(info.entitlements.active));
    console.log('[rc] getCustomerInfo success — activeSubscriptions:', info.activeSubscriptions);
  } catch (error: unknown) {
    console.log('[rc] getCustomerInfo failed:', toRevenueCatError(error).message);
  }
}

/**
 * Ensure RevenueCat's appUserID matches the current Supabase user before a
 * purchase or restore. Calls Purchases.logIn(expectedUserId) if mismatched.
 * Returns the verified appUserID, or null if it still doesn't match.
 */
async function ensureAppUserId(expectedUserId: string): Promise<string | null> {
  let currentAppUserId = '';
  try {
    currentAppUserId = await Purchases.getAppUserID();
  } catch (error: unknown) {
    console.log('[rc] getAppUserID failed:', toRevenueCatError(error).message);
  }

  if (currentAppUserId !== expectedUserId) {
    console.log('[rc] appUserID mismatch:', currentAppUserId, '!=', expectedUserId, '— calling logIn');
    try {
      await Purchases.logIn(expectedUserId);
      currentAppUserId = await Purchases.getAppUserID();
    } catch (error: unknown) {
      console.log('[rc] logIn retry failed:', toRevenueCatError(error).message);
    }
  }

  if (currentAppUserId !== expectedUserId) {
    console.log('[rc] appUserID still mismatched after logIn:', currentAppUserId, '!=', expectedUserId);
    return null;
  }
  return currentAppUserId;
}

function hasUserPro(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[USER_PRO_ENTITLEMENT_ID] !== undefined
    || customerInfo.activeSubscriptions.includes(USER_PRO_PRODUCT_ID);
}

// ── Public status ──

export function isRevenueCatAvailable(): boolean {
  return _nativeAvailable;
}

export function getRevenueCatError(): string | null {
  return _initError;
}

// ── Init ──

/**
 * Initialize RevenueCat at app startup.
 * Safe to call in Expo Go — falls back gracefully.
 *
 * @param appUserId — Supabase auth.uid()
 */
export async function initRevenueCat(appUserId: string): Promise<void> {
  console.log('[rc] init start');
  console.log('[rc] env name used: EXPO_PUBLIC_REVENUECAT_APPLE_KEY');
  console.log('[rc] platform:', Platform.OS);

  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
    default: undefined,
  });

  console.log('[rc] api key present:', !!apiKey && apiKey.length > 0);
  if (apiKey) {
    console.log('[rc] api key prefix:', apiKey.slice(0, 8));
  }
  console.log('[rc] requested appUserID:', appUserId);

  // ── Guard 1: key must be present ──
  if (!apiKey || apiKey.length === 0) {
    _initError = 'RevenueCat API key not configured. Set EXPO_PUBLIC_REVENUECAT_APPLE_KEY / EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY in .env';
    console.log('[rc]', _initError);
    console.log('[rc] configure called:', false);
    return;
  }

  // ── Guard 2: key must look like a real RevenueCat key (appl_… or goog_…) ──
  const isValidApple = Platform.OS === 'ios' && apiKey.startsWith(RC_APPLE_KEY_PREFIX);
  const isValidGoogle = Platform.OS === 'android' && apiKey.startsWith(RC_GOOGLE_KEY_PREFIX);
  if (!isValidApple && !isValidGoogle) {
    _initError = `RevenueCat key doesn't look valid (expected '${Platform.OS === 'ios' ? RC_APPLE_KEY_PREFIX : RC_GOOGLE_KEY_PREFIX}…' prefix). Skipping Purchases.configure().`;
    console.log('[rc]', _initError);
    console.log('[rc] configure called:', false);
    return;
  }

  // ── Guard 3: skip in Expo Go (native modules unavailable) ──
  if (Constants.expoConfig?.extra?.eas?.projectId) {
    // Has EAS project ID — likely a dev build or standalone app.
    // Proceed.
  } else {
    // No EAS project ID — likely Expo Go.
    // Still try (it won't crash), but log clearly.
    console.log('[rc] Running in Expo Go — Purchases will use test store or fail gracefully.');
  }

  if (_nativeAvailable) {
    if (_configuredUserId !== appUserId) {
      try {
        await Purchases.logIn(appUserId);
        _configuredUserId = appUserId;
        _initError = null;
        console.log('[rc] User updated:', appUserId);
      } catch (error: unknown) {
        const revenueCatError = toRevenueCatError(error);
        _initError = revenueCatError.message ?? 'RevenueCat user update failed';
        console.log('[rc] User update failed:', _initError);
      }
    }
    console.log('[rc] configure called:', true);
    await logAppUserIdAndCustomerInfo();
    return;
  }

  try {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    await Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });
    _nativeAvailable = true;
    _configuredUserId = appUserId;
    _initError = null;
    console.log('[rc] Initialized — user:', appUserId);
    console.log('[rc] configure called:', true);
    await logAppUserIdAndCustomerInfo();
  } catch (error: unknown) {
    const revenueCatError = toRevenueCatError(error);
    _nativeAvailable = false;
    _configuredUserId = null;
    _initError = revenueCatError.message ?? 'RevenueCat init failed';
    console.log('[rc] Init failed (likely Expo Go — no native module):', _initError);
    console.log('[rc] configure called:', false);
  }
}

// ── Offerings ──

export interface OfferingsResult {
  groupPro: {
    id: string;
    title: string;
    description: string;
    price: number;
    priceString: string;
    currencyCode: string;
  } | null;
  userPro: {
    id: string;
    title: string;
    description: string;
    price: number;
    priceString: string;
    currencyCode: string;
  } | null;
}

function mapPackage(pkg: PurchasesPackage) {
  return {
    id: pkg.identifier,
    title: pkg.packageType ?? pkg.identifier,
    description: pkg.product?.description ?? '',
    price: pkg.product?.price ?? 0,
    priceString: pkg.product?.priceString ?? '',
    currencyCode: pkg.product?.currencyCode ?? 'USD',
  };
}

/**
 * Fetch offerings from RevenueCat.
 * Returns null if native module unavailable or no offerings.
 */
export async function getOfferings(): Promise<OfferingsResult | null> {
  console.log('[rc] getOfferings start');

  if (!_nativeAvailable) {
    console.log('[rc] getOfferings skipped: native module unavailable');
    return null;
  }

  try {
    const offerings: PurchasesOfferings = await Purchases.getOfferings();
    const current = offerings.current;

    console.log('[rc] current offering id:', current?.identifier ?? 'null');
    console.log('[rc] available packages count:', current?.availablePackages?.length ?? 0);
    current?.availablePackages?.forEach((p) => {
      console.log('[rc] package:', {
        identifier: p.identifier,
        packageType: p.packageType,
        productId: p.product?.identifier ?? 'null',
        priceString: p.product?.priceString ?? 'null',
      });
    });

    if (!current) return null;

    // User Pro is a monthly subscription — map to current.monthly.
    // Group Pro (deprecated in UI, kept for future use) also maps to monthly.
    const userProPkg = current.monthly ?? current.availablePackages[0] ?? null;
    const groupProPkg = current.monthly ?? current.availablePackages[0] ?? null;

    if (userProPkg) {
      console.log('[rc] chosen package:', {
        identifier: userProPkg.identifier,
        packageType: userProPkg.packageType,
        productId: userProPkg.product?.identifier ?? 'null',
      });
    }

    return {
      groupPro: groupProPkg ? mapPackage(groupProPkg) : null,
      userPro: userProPkg ? mapPackage(userProPkg) : null,
    };
  } catch (error: unknown) {
    const revenueCatError = toRevenueCatError(error);
    console.log('[rc] getOfferings error:', revenueCatError.message);
    return null;
  }
}

// ── Purchases ──

export interface PurchaseResult {
  success: boolean;
  error?: string;
  devBuildRequired?: boolean;
  entitlementActive?: boolean;
}

/**
 * Purchase Group Pro.
 * Passes group_id to RevenueCat as subscriber attribute so the
 * webhook knows which group to mark as Pro.
 */
export async function purchaseGroupPro(
  offeringId: string,
  groupId: string,
): Promise<PurchaseResult> {
  if (!_nativeAvailable) {
    return { success: false, devBuildRequired: true, error: _initError ?? undefined };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) => p.identifier === offeringId);
    if (!pkg) return { success: false, error: 'Offering package not found' };

    // Set group_id as subscriber attribute BEFORE purchase
    // so the webhook can read it when the purchase event fires
    await Purchases.setAttributes({ group_id: groupId });

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPro = customerInfo.entitlements.active['group_pro'] !== undefined;
    return { success: hasPro };
  } catch (error: unknown) {
    const revenueCatError = toRevenueCatError(error);
    if (revenueCatError.userCancelled) return { success: false, error: 'cancelled' };
    return { success: false, error: revenueCatError.message ?? 'Purchase failed' };
  }
}

/**
 * Purchase User Pro.
 *
 * @param expectedUserId — the current Supabase auth.uid(). The purchase is
 * aborted (without opening the store sheet) if RevenueCat's appUserID
 * cannot be made to match this id.
 */
export async function purchaseUserPro(offeringId: string, expectedUserId: string): Promise<PurchaseResult> {
  if (!_nativeAvailable) {
    return { success: false, devBuildRequired: true, error: _initError ?? undefined };
  }

  const appUserId = await ensureAppUserId(expectedUserId);
  if (!appUserId) {
    return { success: false, error: 'account_mismatch' };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) => p.identifier === offeringId);
    if (!pkg) {
      console.log('[rc] purchaseUserPro: package not found for offeringId:', offeringId);
      console.log('[rc] available package identifiers:', offerings.current?.availablePackages?.map(p => p.identifier));
      return { success: false, error: 'Offering package not found' };
    }

    console.log('[rc] purchase start');
    console.log('[rc] purchase appUserID:', appUserId);
    console.log('[rc] package identifier:', pkg.identifier);
    console.log('[rc] package type:', pkg.packageType);
    console.log('[rc] product id:', pkg.product?.identifier);
    console.log('[rc] product price:', pkg.product?.priceString);

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPro = hasUserPro(customerInfo);

    console.log('[rc] purchase returned');
    console.log('[rc] customerInfo originalAppUserId:', customerInfo.originalAppUserId);
    console.log('[rc] customerInfo active entitlement keys:', Object.keys(customerInfo.entitlements.active));
    console.log('[rc] customerInfo activeSubscriptions:', customerInfo.activeSubscriptions);
    console.log('[rc] customerInfo allPurchasedProductIdentifiers:', customerInfo.allPurchasedProductIdentifiers);

    // purchasePackage only resolves after the store transaction succeeds.
    // The webhook remains authoritative for profiles.user_pro.
    return { success: true, entitlementActive: hasPro };
  } catch (error: unknown) {
    const revenueCatError = toRevenueCatError(error);
    if (revenueCatError.userCancelled) return { success: false, error: 'cancelled' };
    console.log('[rc] purchaseUserPro error code:', revenueCatError.code);
    console.log('[rc] purchaseUserPro error message:', revenueCatError.message);
    console.log('[rc] purchaseUserPro userCancelled:', revenueCatError.userCancelled);
    console.log('[rc] purchaseUserPro underlyingErrorMessage:', revenueCatError.underlyingErrorMessage);
    return { success: false, error: revenueCatError.message ?? 'Purchase failed' };
  }
}

/**
 * Restore purchases (Apple REQUIRED).
 *
 * @param expectedUserId — the current Supabase auth.uid(). The restore is
 * aborted if RevenueCat's appUserID cannot be made to match this id.
 */
export async function restorePurchases(expectedUserId: string): Promise<PurchaseResult> {
  if (!_nativeAvailable) {
    return { success: false, devBuildRequired: true, error: _initError ?? undefined };
  }

  const appUserId = await ensureAppUserId(expectedUserId);
  if (!appUserId) {
    return { success: false, error: 'account_mismatch' };
  }

  try {
    const customerInfo: CustomerInfo = await Purchases.restorePurchases();
    const hasActive = hasUserPro(customerInfo);
    console.log('[rc] restore returned');
    console.log('[rc] customerInfo originalAppUserId:', customerInfo.originalAppUserId);
    console.log('[rc] customerInfo active entitlement keys:', Object.keys(customerInfo.entitlements.active));
    console.log('[rc] customerInfo activeSubscriptions:', customerInfo.activeSubscriptions);
    return { success: hasActive, entitlementActive: hasActive };
  } catch (error: unknown) {
    const revenueCatError = toRevenueCatError(error);
    return { success: false, error: revenueCatError.message ?? 'Restore failed' };
  }
}

// ── Entitlement checks (RevenueCat side) ──

/**
 * Check if the current user has User Pro entitlement from RevenueCat.
 * This is the CLIENT-SIDE check — the server-side check (profiles.user_pro)
 * is the authoritative source after webhook processes the purchase.
 */
export async function checkUserProEntitlement(): Promise<boolean> {
  if (!_nativeAvailable) return false;

  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return hasUserPro(info);
  } catch {
    return false;
  }
}

/**
 * Check if the current user has Group Pro entitlement from RevenueCat.
 * Client-side only — use DB for authoritative check.
 */
export async function checkGroupProEntitlement(): Promise<boolean> {
  if (!_nativeAvailable) return false;

  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active['group_pro'] !== undefined;
  } catch {
    return false;
  }
}
