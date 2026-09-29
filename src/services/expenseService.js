// Expense Service
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createExpense(companyId, expenseData, userId, userName) {
  const expenseId = generateId('exp');
  const expense = {
    ...expenseData,
    companyId,
    amount: Number(expenseData.amount),
    createdBy: userId,
    createdByName: userName,
    createdAt: expenseData.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/expenses/${expenseId}`] = expense;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} recorded expense "${expenseData.title || expenseData.description}" - Rs ${expenseData.amount}`,
    entityType: 'expense', entityId: expenseId,
    timestamp: Date.now(),
  };

  // Notification for large expenses
  if (Number(expenseData.amount) >= 10000) {
    const notifId = generateId('notif');
    updates[`companies/${companyId}/notifications/${notifId}`] = {
      type: 'large_expense',
      message: `Large expense recorded: Rs ${expenseData.amount} - ${expenseData.title || expenseData.description}`,
      read: false,
      userId,
      userName,
      entityType: 'expense', entityId: expenseId,
      timestamp: Date.now(),
    };
  }

  updates[`companies/${companyId}/onboarding/firstExpense`] = true;

  await update(ref(database), updates);
  return expenseId;
}

export async function getExpenses(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/expenses`));
  if (!snap.exists()) return [];
  const expenses = [];
  snap.forEach(child => {
    expenses.push({ id: child.key, ...child.val() });
  });
  return expenses.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateExpense(companyId, expenseId, expenseData, userId, userName) {
  const updates = {};
  updates[`companies/${companyId}/expenses/${expenseId}/amount`] = Number(expenseData.amount);
  updates[`companies/${companyId}/expenses/${expenseId}/category`] = expenseData.category;
  updates[`companies/${companyId}/expenses/${expenseId}/description`] = expenseData.description;
  updates[`companies/${companyId}/expenses/${expenseId}/paymentMethod`] = expenseData.paymentMethod;
  updates[`companies/${companyId}/expenses/${expenseId}/reference`] = expenseData.reference || '';
  updates[`companies/${companyId}/expenses/${expenseId}/notes`] = expenseData.notes || '';
  updates[`companies/${companyId}/expenses/${expenseId}/date`] = expenseData.date;
  updates[`companies/${companyId}/expenses/${expenseId}/updatedAt`] = Date.now();

  await update(ref(database), updates);
}

export async function deleteExpense(companyId, expenseId) {
  await update(ref(database), { [`companies/${companyId}/expenses/${expenseId}`]: null });
}
