// AI Assistant Database Persistence, Smart Cache, Token Budget & Executive Audit Service
import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '../firebase';

/**
 * Normalizes user prompt for deduplication and caching
 */
export function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  return query
    .toLowerCase()
    .replace(/[?!.,;:'"()\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches saved conversation history for a specific user (Admin or Employee)
 */
export async function getConversationHistory(companyId, userId) {
  if (!companyId || !userId) return { messages: [], pendingContext: null };
  try {
    const convoRef = ref(database, `companies/${companyId}/ai_conversations/${userId}`);
    const snap = await get(convoRef);
    if (snap.exists()) {
      const data = snap.val();
      const rawMessages = Array.isArray(data.messages) ? data.messages : (data.messages ? Object.values(data.messages) : []);
      // Filter out any obsolete error messages
      const cleanMessages = rawMessages.filter(m =>
        !m.text?.toLowerCase().includes('could not complete the request') &&
        !m.text?.toLowerCase().includes('check your connection') &&
        !m.verbal?.toLowerCase().includes('could not complete the request')
      );
      return {
        messages: cleanMessages,
        pendingContext: data.pendingContext || null,
        lastAuditTimestamp: data.lastAuditTimestamp || 0,
      };
    }
  } catch (err) {
    console.warn('Failed to load conversation history:', err);
  }
  return { messages: [], pendingContext: null, lastAuditTimestamp: 0 };
}

/**
 * Saves conversation messages and pending context to DB with strict capping
 * Retains maximum 20 recent messages to prevent DB bloat & excessive token usage
 */
export async function saveConversationHistory(companyId, userId, messages, pendingContext = null) {
  if (!companyId || !userId) return;
  try {
    const cappedMessages = (messages || []).slice(-20).map(m => ({
      role: m.role || 'assistant',
      text: m.text || '',
      verbal: m.verbal || '',
      cached: Boolean(m.cached),
      timestamp: m.timestamp || Date.now(),
      visuals: m.visuals ? {
        type: m.visuals.type || 'general',
        actionResult: m.visuals.actionResult || null,
        cards: m.visuals.cards || null,
        auditAlerts: m.visuals.auditAlerts || null,
        tableItems: m.visuals.tableItems || null,
      } : null,
    }));

    const convoRef = ref(database, `companies/${companyId}/ai_conversations/${userId}`);
    await update(convoRef, {
      messages: cappedMessages,
      pendingContext: pendingContext || null,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save conversation history to DB:', err);
  }
}

/**
 * Clears conversation history for the current user
 */
export async function clearConversationHistory(companyId, userId) {
  if (!companyId || !userId) return;
  try {
    const convoRef = ref(database, `companies/${companyId}/ai_conversations/${userId}`);
    await remove(convoRef);
  } catch (err) {
    console.warn('Failed to clear conversation history:', err);
  }
}

/**
 * Checks if identical question was asked recently and retrieves cached answer (0 tokens)
 * Excludes transactional commands (like add order, create customer, download invoices)
 */
export async function getCachedQueryAnswer(companyId, userId, rawQuery) {
  const norm = normalizeQuery(rawQuery);
  if (!norm || norm.length < 3) return null;

  // Never cache transactional action triggers
  const actionKeywords = ['create', 'add', 'delete', 'download', 'generate', 'pay', 'receive', 'remove', 'make'];
  if (actionKeywords.some(kw => norm.includes(kw))) {
    return null;
  }

  try {
    // Hash key for Firebase compatibility
    const safeKey = encodeURIComponent(norm).replace(/\./g, '_').slice(0, 80);
    const cacheRef = ref(database, `companies/${companyId}/ai_conversations/${userId}/query_cache/${safeKey}`);
    const snap = await get(cacheRef);
    if (snap.exists()) {
      const entry = snap.val();
      // Cache valid for 15 minutes for live metrics, 24 hours for general inquiries
      const now = Date.now();
      const ageMinutes = (now - (entry.timestamp || 0)) / (1000 * 60);
      if (ageMinutes < 15) {
        return entry.response;
      }
    }
  } catch (err) {
    console.warn('Query cache lookup error:', err);
  }
  return null;
}

/**
 * Stores query response in DB cache
 */
export async function setCachedQueryAnswer(companyId, userId, rawQuery, response) {
  const norm = normalizeQuery(rawQuery);
  if (!norm || norm.length < 3 || !response) return;

  const actionKeywords = ['create', 'add', 'delete', 'download', 'generate', 'pay', 'receive', 'remove', 'make'];
  if (actionKeywords.some(kw => norm.includes(kw))) {
    return;
  }

  try {
    const safeKey = encodeURIComponent(norm).replace(/\./g, '_').slice(0, 80);
    const cacheRef = ref(database, `companies/${companyId}/ai_conversations/${userId}/query_cache/${safeKey}`);
    await set(cacheRef, {
      rawQuery,
      response: {
        text: response.text || '',
        verbal: response.verbal || '',
        cards: response.cards || null,
        visualType: response.visualType || 'general',
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save query cache:', err);
  }
}

/**
 * Full Autonomous System Audit (Stocks, Sales Trend, Team Member Order Count & High Gap Detection)
 */
export function performExecutiveSystemAudit({
  products = [],
  orders = [],
  customers = [],
  employees = [],
  isAdmin = false,
  currency = 'Rs.',
  userProfile = {},
  currentUserId = ''
}) {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;

  const thisWeekStart = now - ONE_WEEK;
  const prevWeekStart = now - (2 * ONE_WEEK);

  const curMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();

  // Filter orders by role permissions
  const relevantOrders = isAdmin
    ? orders
    : orders.filter(o => o.createdBy === currentUserId || o.employeeId === currentUserId);

  // 1. SALES TRENDS
  const thisWeekOrders = relevantOrders.filter(o => (o.createdAt || o.date || 0) >= thisWeekStart);
  const prevWeekOrders = relevantOrders.filter(o => {
    const t = o.createdAt || o.date || 0;
    return t >= prevWeekStart && t < thisWeekStart;
  });

  const thisWeekSales = thisWeekOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);
  const prevWeekSales = prevWeekOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);

  let weekSalesDiffPct = 0;
  if (prevWeekSales > 0) {
    weekSalesDiffPct = Math.round(((thisWeekSales - prevWeekSales) / prevWeekSales) * 100);
  } else if (thisWeekSales > 0) {
    weekSalesDiffPct = 100;
  }

  // Month-over-Month
  const curMonthOrders = relevantOrders.filter(o => (o.createdAt || o.date || 0) >= curMonthStart);
  const prevMonthOrders = relevantOrders.filter(o => {
    const t = o.createdAt || o.date || 0;
    return t >= prevMonthStart && t < curMonthStart;
  });

  const curMonthSales = curMonthOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);
  const prevMonthSales = prevMonthOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);

  let monthSalesDiffPct = 0;
  if (prevMonthSales > 0) {
    monthSalesDiffPct = Math.round(((curMonthSales - prevMonthSales) / prevMonthSales) * 100);
  } else if (curMonthSales > 0) {
    monthSalesDiffPct = 100;
  }

  // 2. INVENTORY & STOCK CHECK
  const lowStockThreshold = 10;
  const lowStockItems = products.filter(p => {
    const stock = Number(p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0);
    const limit = Number(p.lowStockThreshold ?? p.minimumStock ?? lowStockThreshold);
    return stock <= limit;
  });
  const zeroStockItems = products.filter(p => Number(p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0) <= 0);

  // 3. PER-TEAM MEMBER / SALESMAN ORDER COUNT & COMPARISON (Admin view)
  const teamAnalysis = [];
  if (isAdmin && employees.length > 0) {
    employees.forEach(emp => {
      const empOrdersThisWeek = thisWeekOrders.filter(o =>
        o.createdBy === emp.id ||
        (o.createdByName || o.employeeName || '').toLowerCase().includes((emp.name || '').toLowerCase())
      );
      const empOrdersPrevWeek = prevWeekOrders.filter(o =>
        o.createdBy === emp.id ||
        (o.createdByName || o.employeeName || '').toLowerCase().includes((emp.name || '').toLowerCase())
      );

      const thisCount = empOrdersThisWeek.length;
      const prevCount = empOrdersPrevWeek.length;
      const thisVal = empOrdersThisWeek.reduce((s, o) => s + Number(o.total || o.grandTotal || 0), 0);
      const prevVal = empOrdersPrevWeek.reduce((s, o) => s + Number(o.total || o.grandTotal || 0), 0);

      let orderDiffPct = 0;
      if (prevCount > 0) {
        orderDiffPct = Math.round(((thisCount - prevCount) / prevCount) * 100);
      } else if (thisCount > 0) {
        orderDiffPct = 100;
      }

      teamAnalysis.push({
        id: emp.id,
        name: emp.name || 'Staff',
        thisWeekOrders: thisCount,
        prevWeekOrders: prevCount,
        thisWeekSales: thisVal,
        prevWeekSales: prevVal,
        orderDiffPct,
        status: orderDiffPct < -25 ? 'dropped' : (orderDiffPct >= 20 ? 'growing' : 'stable')
      });
    });
  }

  // 4. GAP & ANOMALY DETECTION (Proactive Alerts)
  const auditAlerts = [];

  // Anomaly A: Overall Sales Drop Gap
  if (prevWeekSales > 0 && weekSalesDiffPct <= -20) {
    auditAlerts.push({
      type: 'critical',
      category: 'Sales Drop',
      title: `Sales Down by ${Math.abs(weekSalesDiffPct)}% This Week`,
      desc: `Weekly revenue dropped from ${currency} ${prevWeekSales.toLocaleString()} to ${currency} ${thisWeekSales.toLocaleString()}.`,
      recommendation: `Check field salesmen route schedules or follow up on pending customer quotes.`,
    });
  }

  // Anomaly B: Critical Stockout
  if (isAdmin && (zeroStockItems.length > 0 || lowStockItems.length > 0)) {
    auditAlerts.push({
      type: zeroStockItems.length > 0 ? 'critical' : 'warning',
      category: 'Inventory Gap',
      title: `${zeroStockItems.length > 0 ? `${zeroStockItems.length} Products Out of Stock!` : `${lowStockItems.length} Low Stock Products`}`,
      desc: `Critical items: ${lowStockItems.slice(0, 3).map(p => p.name).join(', ') || 'Various items'}.`,
      recommendation: `Restock now to prevent delayed deliveries and lost sales.`,
    });
  }

  // Anomaly C: Team Member Underperformance / High Gap
  if (isAdmin) {
    const underperformingRep = teamAnalysis.find(t => t.prevWeekOrders >= 3 && t.orderDiffPct <= -35);
    if (underperformingRep) {
      auditAlerts.push({
        type: 'warning',
        category: 'Team Velocity Gap',
        title: `${underperformingRep.name}'s Orders Dropped by ${Math.abs(underperformingRep.orderDiffPct)}%`,
        desc: `Booked only ${underperformingRep.thisWeekOrders} orders this week compared to ${underperformingRep.prevWeekOrders} last week.`,
        recommendation: `Reach out to ${underperformingRep.name} to see if their route had order booking issues or vehicle delays.`,
      });
    }
  }

  // 5. SYNTHESIZE EXECUTIVE BRIEFING MESSAGE
  const greetingName = userProfile?.name ? userProfile.name.split(' ')[0] : (isAdmin ? 'Admin' : 'Team Member');
  
  let briefingVerbal = "";
  let briefingMarkdown = "";

  if (isAdmin) {
    const salesTone = weekSalesDiffPct >= 0
      ? `Sales this week are up ${weekSalesDiffPct}% at ${currency} ${thisWeekSales.toLocaleString()}.`
      : `Sales this week dropped ${Math.abs(weekSalesDiffPct)}% to ${currency} ${thisWeekSales.toLocaleString()}.`;

    const alertCountText = auditAlerts.length > 0
      ? `I found ${auditAlerts.length} high priority alert${auditAlerts.length > 1 ? 's' : ''} requiring your attention.`
      : "All systems are running smoothly.";

    briefingVerbal = `Good day, ${greetingName}! I've completed a full system audit of LAMBA. ${salesTone} ${alertCountText}`;

    briefingMarkdown = `🌟 Executive System Audit\n\nAssalam-o-Alaikum **${greetingName}**! I've conducted a complete real-time audit across your warehouse stocks, team members, and sales trends:\n\n` +
      `• **Weekly Sales:** ${currency} ${thisWeekSales.toLocaleString()} (${weekSalesDiffPct >= 0 ? `📈 +${weekSalesDiffPct}%` : `📉 ${weekSalesDiffPct}%`} vs prev week)\n` +
      `• **Monthly Sales:** ${currency} ${curMonthSales.toLocaleString()} (${monthSalesDiffPct >= 0 ? `📈 +${monthSalesDiffPct}%` : `📉 ${monthSalesDiffPct}%`} vs prev month)\n` +
      `• **Inventory Status:** ${lowStockItems.length} low stock items (${zeroStockItems.length} out of stock)\n` +
      (teamAnalysis.length > 0 ? `• **Team Performance:** ${teamAnalysis.map(t => `${t.name}: ${t.thisWeekOrders} orders (${t.orderDiffPct >= 0 ? `+${t.orderDiffPct}%` : `${t.orderDiffPct}%`})`).slice(0, 3).join(', ')}\n` : '');

    if (auditAlerts.length > 0) {
      briefingMarkdown += `\n⚠️ Critical Action Needed:\n` +
        auditAlerts.map(a => `• **${a.title}**: ${a.desc}\n  Action: ${a.recommendation}`).join('\n');
    }
  } else {
    // Employee briefing
    const myWeeklyOrders = thisWeekOrders.length;
    briefingVerbal = `Assalam-o-Alaikum ${greetingName}! You have ${myWeeklyOrders} active orders logged this week totaling ${currency} ${thisWeekSales.toLocaleString()}. How can I assist your field bookings today?`;
    briefingMarkdown = `📋 Assistant Briefing for ${greetingName}\n\nAssalam-o-Alaikum! Here is your personal operational status:\n\n` +
      `• **Your Orders This Week:** ${myWeeklyOrders} orders (${currency} ${thisWeekSales.toLocaleString()})\n` +
      `• **Registered Customer Shops:** ${customers.length} shops in directory\n\n` +
      `You can tell me to book an order, search customer balances, or view assigned deliveries.`;
  }

  return {
    thisWeekSales,
    prevWeekSales,
    weekSalesDiffPct,
    curMonthSales,
    prevMonthSales,
    monthSalesDiffPct,
    lowStockItems,
    zeroStockItems,
    teamAnalysis,
    auditAlerts,
    briefingVerbal,
    briefingMarkdown,
  };
}

