// Auth Service: Firebase Authentication operations
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  ref,
  set,
  get,
  update,
  query,
  orderByChild,
  equalTo,
  serverTimestamp,
} from 'firebase/database';
import { auth, database, googleProvider } from '../firebase';
import { generateJoinCode, generateId } from '../utils/codeGenerator';
import { DEFAULT_PERMISSIONS } from '../utils/constants';

/**
 * Register a new Admin / Business Owner
 */
export async function registerAdmin({ name, email, password, phone, useGoogle = false }) {
  let userCredential;

  if (useGoogle) {
    userCredential = await signInWithPopup(auth, googleProvider);
  } else {
    userCredential = await createUserWithEmailAndPassword(auth, email, password);
  }

  const user = userCredential.user;
  const uid = user.uid;

  // Update display name
  await updateProfile(user, { displayName: name || user.displayName });

  // Create user record with initial accountStatus 'select_package'
  const updates = {};
  updates[`users/${uid}`] = {
    name: name || user.displayName || '',
    email: user.email,
    role: 'admin',
    companyId: null, // Will be set when they create a company
    phone: phone || '',
    status: 'active',
    accountStatus: 'select_package', // New admins must select a package first
    package: null,
    maxCompanies: 0,
    createdAt: Date.now(),
  };

  const dbRef = ref(database);
  await update(dbRef, updates);

  return { uid };
}

/**
 * Calculate Prorated Upgrade Math (Basic -> Pro)
 */
export function calculateProratedUpgrade(userProfile) {
  const currentPlanId = userProfile?.package?.planId || 'basic';
  const isBasic = currentPlanId === 'basic';

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sub = userProfile?.subscription || {};

  // Standard billing cycle is 30 days
  const totalDays = 30;

  // Remaining days in subscription taking todayTimestamp vs expTime into account
  const todayTimestamp = now + ((sub.extraDaysPassed || 0) * oneDayMs);
  const expTime = sub.expiryDate || (todayTimestamp + (30 * oneDayMs));
  const remainingDays = Math.max(0, Math.ceil((expTime - todayTimestamp) / oneDayMs));

  // Basic daily rate = 5000 / 30 = Rs 166.666... per day
  const basicPrice = 5000;
  const basicDailyRate = basicPrice / totalDays;

  // Unused Basic Credit = daily rate * remaining days
  const unusedBasicCredit = Math.round(basicDailyRate * remainingDays);

  // Pro Price = 10,000
  const proPrice = 10000;

  // Prorated Charge = 10,000 - unusedBasicCredit
  const proratedCharge = Math.max(0, proPrice - unusedBasicCredit);

  return {
    isProrated: isBasic && remainingDays > 0,
    totalDays,
    remainingDays,
    basicDailyRate: Number(basicDailyRate.toFixed(2)),
    unusedBasicCredit,
    proPrice,
    proratedCharge,
    nextMonthPrice: 10000,
  };
}

/**
 * Select Package for Admin
 */
export async function selectUserPackage(uid, planId) {
  const isBasic = planId === 'basic';
  const packageData = {
    planId: isBasic ? 'basic' : 'pro',
    name: isBasic ? 'Basic Package' : 'Pro Multi-Company Package',
    price: isBasic ? 5000 : 10000,
    maxCompanies: isBasic ? 1 : 3,
    status: 'pending_payment',
    selectedAt: Date.now(),
  };

  const updates = {};
  updates[`users/${uid}/package`] = packageData;
  updates[`users/${uid}/accountStatus`] = 'pending_approval';
  updates[`users/${uid}/maxCompanies`] = packageData.maxCompanies;

  const dbRef = ref(database);
  await update(dbRef, updates);
  return packageData;
}

/**
 * Request Plan Upgrade with Proration calculation
 */
export async function requestPlanUpgrade(uid, targetPlanId, userProfile = null) {
  const isPro = targetPlanId === 'pro';
  const targetMaxCompanies = isPro ? 3 : 1;

  let prorated = null;
  if (userProfile && targetPlanId === 'pro' && userProfile?.package?.planId === 'basic') {
    prorated = calculateProratedUpgrade(userProfile);
  }

  const updates = {};
  updates[`users/${uid}/upgradeRequest`] = {
    requestedPlanId: targetPlanId,
    requestedPackageName: isPro ? 'Pro Multi-Company Package' : 'Basic Package Renewal',
    requestedPrice: prorated ? prorated.proratedCharge : (isPro ? 10000 : 5000),
    requestedMaxCompanies: targetMaxCompanies,
    prorated: isPro ? (prorated || null) : null,
    requestedAt: Date.now(),
    status: 'pending',
  };

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Schedule Plan Downgrade to Basic at end of Pro period
 */
export async function schedulePlanDowngrade(uid, targetPlanId = 'basic') {
  const updates = {};
  updates[`users/${uid}/scheduledDowngrade`] = {
    targetPlanId,
    targetMaxCompanies: 1,
    scheduledAt: Date.now(),
    status: 'scheduled',
  };

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Cancel Scheduled Downgrade
 */
export async function cancelScheduledDowngrade(uid) {
  const updates = {};
  updates[`users/${uid}/scheduledDowngrade`] = null;

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Super Admin Control Panel: Approve User Account
 */
export async function approveUserAccount(uid, maxCompaniesOverride = null, planIdOverride = null) {
  const userRef = ref(database, `users/${uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) throw new Error('User record not found');

  const userData = snap.val();
  const currentPlan = userData.package?.planId || 'basic';
  const finalPlan = planIdOverride || currentPlan;
  const isBasic = finalPlan === 'basic';
  const defaultLimit = isBasic ? 1 : 3;
  const finalLimit = Number(maxCompaniesOverride) > 0 ? Number(maxCompaniesOverride) : defaultLimit;

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const existingSub = userData.subscription || {};
  const extraDays = existingSub.extraDaysPassed || 0;
  
  // Calculate today's date taking extraDaysPassed into account
  const currentTodayTime = now + (extraDays * oneDayMs);
  const newExpiry = currentTodayTime + thirtyDaysMs;

  const updates = {};
  updates[`users/${uid}/accountStatus`] = 'active';
  updates[`users/${uid}/approvalStatus`] = 'approved';
  updates[`users/${uid}/maxCompanies`] = finalLimit;
  updates[`users/${uid}/approvedAt`] = now;
  updates[`users/${uid}/package/status`] = 'active';
  updates[`users/${uid}/package/planId`] = finalPlan;
  updates[`users/${uid}/package/name`] = isBasic ? 'Basic Package' : 'Pro Multi-Company Package';
  updates[`users/${uid}/package/price`] = isBasic ? 5000 : 10000;
  updates[`users/${uid}/package/maxCompanies`] = finalLimit;
  updates[`users/${uid}/upgradeRequest`] = null;

  // Save subscription dates: starting from current Today's Date, expiring 30 days from Today's Date, preserving extraDaysPassed
  updates[`users/${uid}/subscription`] = {
    startDate: currentTodayTime,
    expiryDate: newExpiry,
    planId: finalPlan,
    price: isBasic ? 5000 : 10000,
    status: 'active',
    lastApprovedAt: now,
    extraDaysPassed: extraDays,
  };

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Super Admin Control Panel: Add 1 Month to Subscription
 */
export async function addSubscriptionMonth(uid) {
  const userRef = ref(database, `users/${uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) throw new Error('User not found');

  const userData = snap.val();
  const sub = userData.subscription || {};
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const extraDays = sub.extraDaysPassed || 0;
  const currentTodayTime = now + (extraDays * oneDayMs);

  const currentExpiry = (sub.expiryDate && sub.expiryDate > currentTodayTime) ? sub.expiryDate : currentTodayTime;
  const newExpiry = currentExpiry + thirtyDaysMs;

  const updates = {};
  updates[`users/${uid}/subscription/startDate`] = sub.startDate || currentTodayTime;
  updates[`users/${uid}/subscription/expiryDate`] = newExpiry;
  updates[`users/${uid}/subscription/status`] = 'active';
  updates[`users/${uid}/accountStatus`] = 'active';
  updates[`users/${uid}/package/status`] = 'active';

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Super Admin Control Panel: Update User Company Limit
 */
export async function updateUserCompanyLimit(uid, maxCompanies) {
  const limit = Math.max(1, parseInt(maxCompanies, 10) || 1);
  const updates = {};
  updates[`users/${uid}/maxCompanies`] = limit;
  updates[`users/${uid}/package/maxCompanies`] = limit;

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Super Admin Control Panel: Reject / Suspend User Account
 */
export async function rejectUserAccount(uid, reason = '') {
  const updates = {};
  updates[`users/${uid}/accountStatus`] = 'disabled';
  updates[`users/${uid}/approvalStatus`] = 'rejected';
  updates[`users/${uid}/rejectionReason`] = reason;

  const dbRef = ref(database);
  await update(dbRef, updates);
}

/**
 * Setup a new company for an existing admin user
 */
export async function setupCompany(companyName, uid, userEmail, userName, phone) {
  const companyId = generateId('company');

  // Generate unique admin join code
  let joinCode = generateJoinCode();
  let codeExists = true;
  let attempts = 0;

  while (codeExists && attempts < 10) {
    const codeRef = ref(database, `adminCodes/${joinCode}`);
    const snapshot = await get(codeRef);
    if (!snapshot.exists()) {
      codeExists = false;
    } else {
      joinCode = generateJoinCode();
      attempts++;
    }
  }

  const updates = {};

  // Update User record with companyId
  updates[`users/${uid}/companyId`] = companyId;

  // Company record
  updates[`companies/${companyId}/info`] = {
    name: companyName,
    owner: userName || '',
    ownerUid: uid,
    email: userEmail,
    phone: phone || '',
    address: '',
    city: '',
    currency: 'Rs',
    currencyCode: 'PKR',
    timezone: 'Asia/Karachi',
    joinCode: joinCode,
    status: 'active',
    createdAt: Date.now(),
  };

  // Company settings
  updates[`companies/${companyId}/settings`] = {
    orderPrefix: 'ORD',
    purchasePrefix: 'PUR',
    allowNegativeStock: false,
    taxRate: 0,
    defaultPaymentMethod: 'Cash',
  };

  // Company counters
  updates[`companies/${companyId}/counters`] = {
    orderCounter: 0,
    purchaseCounter: 0,
    expenseCounter: 0,
  };

  // Onboarding
  updates[`companies/${companyId}/onboarding`] = {
    companyProfile: false,
    firstProduct: false,
    firstCustomer: false,
    inviteEmployee: false,
    firstOrder: false,
    firstExpense: false,
    dismissed: false,
  };

  // Admin code
  updates[`adminCodes/${joinCode}`] = {
    companyId: companyId,
    adminUid: uid,
    createdAt: Date.now(),
  };

  // Admin as employee of own company
  updates[`companies/${companyId}/employees/${uid}`] = {
    name: userName || '',
    email: userEmail,
    role: 'admin',
    status: 'active',
    joinedAt: Date.now(),
  };

  const dbRef = ref(database);
  await update(dbRef, updates);

  return { companyId, joinCode };
}

/**
 * Register a new Employee
 */
export async function registerEmployee({ name, email, password, adminCode }) {
  const cleanCode = adminCode.trim().toUpperCase();

  // Step 1: Validate admin code
  const codeRef = ref(database, `adminCodes/${cleanCode}`);
  const codeSnapshot = await get(codeRef);

  if (!codeSnapshot.exists()) {
    throw new Error('Invalid Admin Code. Please ask your administrator for the correct code.');
  }

  const codeData = codeSnapshot.val();
  const { companyId, adminUid } = codeData;

  // Step 2: Verify company exists
  const companyRef = ref(database, `companies/${companyId}/info`);
  const companySnapshot = await get(companyRef);

  if (!companySnapshot.exists()) {
    throw new Error('Company associated with this code no longer exists.');
  }

  const companyInfo = companySnapshot.val();

  if (companyInfo?.status === 'closed' || companyInfo?.status === 'disabled') {
    throw new Error('This company workspace is currently closed by System Control. Registration is not allowed.');
  }

  // Step 3: Create auth account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const uid = user.uid;

  await updateProfile(user, { displayName: name });

  // Step 4: Create records atomically
  const updates = {};

  updates[`users/${uid}`] = {
    name: name,
    email: email,
    role: 'employee',
    companyId: companyId,
    adminUid: adminUid,
    status: 'active',
    permissions: { ...DEFAULT_PERMISSIONS },
    createdAt: Date.now(),
  };

  updates[`companies/${companyId}/employees/${uid}`] = {
    name: name,
    email: email,
    role: 'employee',
    status: 'active',
    joinedAt: Date.now(),
  };

  // Activity log
  const activityId = generateId('act');
  updates[`companies/${companyId}/activities/${activityId}`] = {
    userId: uid,
    userName: name,
    action: `${name} joined as employee`,
    entityType: 'employee',
    entityId: uid,
    timestamp: Date.now(),
  };

  // Notification for admin
  const notifId = generateId('notif');
  updates[`companies/${companyId}/notifications/${notifId}`] = {
    type: 'employee_joined',
    message: `${name} joined your company as an employee`,
    read: false,
    entityType: 'employee',
    entityId: uid,
    timestamp: Date.now(),
  };

  const dbRef = ref(database);
  await update(dbRef, updates);

  return { uid, companyId, companyName: companyInfo.name };
}

/**
 * Login with email and password
 */
export async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Login with Google
 */
export async function loginWithGoogle() {
  const userCredential = await signInWithPopup(auth, googleProvider);
  return userCredential.user;
}

/**
 * Logout
 */
export async function logout() {
  try {
    sessionStorage.clear();
  } catch (e) { }
  await signOut(auth);
}

/**
 * Get user profile from database
 */
export async function getUserProfile(uid) {
  const userRef = ref(database, `users/${uid}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    return { uid, ...snapshot.val() };
  }
  return null;
}

/**
 * Get company info
 */
export async function getCompanyInfo(companyId) {
  const companyRef = ref(database, `companies/${companyId}/info`);
  const snapshot = await get(companyRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
}

/**
 * Regenerate admin join code
 */
export async function regenerateJoinCode(companyId, oldCode) {
  let newCode = generateJoinCode();
  let codeExists = true;
  let attempts = 0;

  while (codeExists && attempts < 10) {
    const codeRef = ref(database, `adminCodes/${newCode}`);
    const snapshot = await get(codeRef);
    if (!snapshot.exists()) {
      codeExists = false;
    } else {
      newCode = generateJoinCode();
      attempts++;
    }
  }

  const updates = {};
  // Remove old code
  updates[`adminCodes/${oldCode}`] = null;
  // Add new code
  const adminUidRef = ref(database, `adminCodes/${oldCode}`);
  const oldSnapshot = await get(adminUidRef);
  const adminUid = oldSnapshot.exists() ? oldSnapshot.val().adminUid : null;

  updates[`adminCodes/${newCode}`] = {
    companyId: companyId,
    adminUid: adminUid,
    createdAt: Date.now(),
  };
  updates[`companies/${companyId}/info/joinCode`] = newCode;

  const dbRef = ref(database);
  await update(dbRef, updates);

  return newCode;
}
