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

  // Create user record without companyId initially
  const updates = {};
  updates[`users/${uid}`] = {
    name: name || user.displayName || '',
    email: user.email,
    role: 'admin',
    companyId: null, // Will be set when they create the company
    phone: phone || '',
    status: 'active',
    createdAt: Date.now(),
  };

  const dbRef = ref(database);
  await update(dbRef, updates);

  return { uid };
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
    status: 'pending',
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
  } catch (e) {}
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
