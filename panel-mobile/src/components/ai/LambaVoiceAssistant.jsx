import { useState, useEffect, useRef } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { createCustomer, deleteCustomer } from '../../services/customerService';
import { createProduct, deleteProduct } from '../../services/productService';
import { createOrder, deleteOrder } from '../../services/orderService';
import { createCustomerPaymentReceived, createSupplierPayment } from '../../services/paymentService';
import { exportOrderInvoiceToPDF, exportMultipleInvoicesToPDF } from '../../utils/pdfExport';
import {
  getConversationHistory,
  saveConversationHistory,
  clearConversationHistory,
  getCachedQueryAnswer,
  setCachedQueryAnswer,
  performExecutiveSystemAudit,
} from '../../services/aiAssistantService';
import {
  Mic, MicOff, Volume2, VolumeX, Sparkles, X, Send,
  TrendingUp, AlertTriangle, Users, Package, ShoppingCart,
  ArrowUpRight, Phone, MessageCircle, Bot, RefreshCw, CheckCircle2,
  Lock, Store, PlusCircle, Settings2, Play, FileText, Download,
  Trash2, DollarSign, RotateCcw, Zap
} from 'lucide-react';

// API credentials must be supplied by deployment configuration; never ship a hardcoded key.
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('lamba_groq_api_key') : '') || '';

// Clean markdown message formatter — strips raw asterisks (**), styles bold tags, and formats clean headings
function renderFormattedMessage(rawText) {
  if (!rawText) return null;

  const lines = rawText.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: 4 }} />;

        // Header line (### or ####)
        if (trimmed.startsWith('#')) {
          const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
          return (
            <div key={idx} style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#1e1b4b',
              marginTop: idx > 0 ? 8 : 2,
              marginBottom: 4,
              paddingBottom: 3,
              borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {cleanHeader}
            </div>
          );
        }

        // Bullet point (* or • or -)
        const isBullet = /^[\*•\-]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[\*•\-]\s+/, '') : trimmed;

        // Parse **bold** parts: matches **something**
        const parts = content.split(/(\**[^*]+\**)/g);

        return (
          <div
            key={idx}
            style={{
              paddingLeft: isBullet ? 14 : 0,
              position: 'relative',
              lineHeight: 1.5,
              fontSize: 13,
            }}
          >
            {isBullet && (
              <span style={{
                position: 'absolute',
                left: 2,
                top: 0,
                color: '#6366f1',
                fontWeight: 900
              }}>•</span>
            )}
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                const boldText = part.slice(2, -2);
                return (
                  <strong key={pIdx} style={{ fontWeight: 800, color: '#1e1b4b' }}>
                    {boldText}
                  </strong>
                );
              }
              const cleanPart = part.replace(/\*\*/g, '');
              return <span key={pIdx}>{cleanPart}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function LambaVoiceAssistant() {
  const { companyId, companyInfo, currentUser, userProfile, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => localStorage.getItem('lamba_preferred_voice') || '');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pendingContext, setPendingContext] = useState(null);
  const pendingSpeechRef = useRef(null);

  const initialGreeting = isAdmin
    ? "Assalam-o-Alaikum! I am your **LAMBA AI Business Assistant**.\n\nI can help you manage your store, add orders, add customer shops, and check sales data.\n\nAsk me anything like:\n- *\"Add customer Madina Traders with phone 03001234567\"*\n- *\"Create a cash order for Ahmed Bilal with 2 Basmati Rice\"*\n- *\"What are today's sales and orders?\"*"
    : "Assalam-o-Alaikum! I am your **LAMBA AI Assistant**.\n\nYou are logged in with an **Employee** account. You can ask about your orders, customer shops, or create new orders.\n\nAsk me anything like:\n- *\"Add customer Al-Rehman Shop with phone 03121234567\"*\n- *\"Show my assigned orders today\"*\n- *\"Create order for Zainab Cash & Carry\"*";

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      verbal: isAdmin
        ? "Hello! I am your LAMBA AI Assistant. How can I assist with your store operations today?"
        : "Hello! I am your LAMBA Assistant. You can view your orders, search customer shops, or create new orders.",
      text: initialGreeting,
      visuals: null,
    }
  ]);

  // Shop context data cache
  const [shopContext, setShopContext] = useState({
    products: [],
    orders: [],
    customers: [],
    lowStock: [],
    topDebtors: [],
    todaySales: 0,
    todayOrdersCount: 0,
  });

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const messagesEndRef = useRef(null);
  const handleSendMessageRef = useRef(null);

  // Resume & unlock browser speech synthesis on first user interaction (bypass Chrome Autoplay policy)
  useEffect(() => {
    const unlockAudio = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
        if (pendingSpeechRef.current) {
          const queued = pendingSpeechRef.current;
          pendingSpeechRef.current = null;
          speakVoice(queued);
        }
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Restore saved conversation memory from database (separate per user/role)
  useEffect(() => {
    if (!companyId || !currentUser?.uid) return;
    let isCancelled = false;

    getConversationHistory(companyId, currentUser.uid).then(history => {
      if (isCancelled) return;
      if (history.messages && history.messages.length > 0) {
        setMessages(history.messages);
        setPendingContext(history.pendingContext || null);
      }
      setHistoryLoaded(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [companyId, currentUser?.uid]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Pre-load and categorize high-fidelity neural browser voices
  useEffect(() => {
    const updateVoiceList = () => {
      if (!('speechSynthesis' in window)) return;
      const allVoices = window.speechSynthesis.getVoices();
      if (!allVoices || allVoices.length === 0) return;

      // Filter and sort for natural English voices (especially female/studio)
      const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));
      setAvailableVoices(englishVoices);

      // If no voice selected, pick the highest quality default
      if (!selectedVoiceName) {
        const topDefault = englishVoices.find(v => v.name === 'Google US English') ||
          englishVoices.find(v => v.name.includes('Google') && v.name.includes('Female')) ||
          englishVoices.find(v => v.name.includes('Ava') || v.name.includes('Zoe')) ||
          englishVoices.find(v => v.name.includes('Samantha') && v.name.includes('Enhanced')) ||
          englishVoices.find(v => v.name.includes('Victoria')) ||
          englishVoices.find(v => v.name.includes('Karen')) ||
          englishVoices[0];
        if (topDefault) {
          setSelectedVoiceName(topDefault.name);
          localStorage.setItem('lamba_preferred_voice', topDefault.name);
        }
      }
    };

    updateVoiceList();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoiceList;
    }
  }, [selectedVoiceName]);

  // Load live shop data for AI context (Role-aware filtering)
  useEffect(() => {
    if (!companyId) return;

    const unsubs = [];
    const prodRef = ref(database, `companies/${companyId}/products`);
    unsubs.push(onValue(prodRef, (snap) => {
      if (snap.exists()) {
        const pObj = snap.val();
        const pList = Object.entries(pObj).map(([id, p]) => ({ id, ...p }));
        // Only compute low stock for admin accounts
        const low = isAdmin
          ? pList.filter(p => Number(p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0) <= Number(p.lowStockThreshold ?? p.minimumStock ?? 10))
          : [];
        setShopContext(prev => ({ ...prev, products: pList, lowStock: low }));
      }
    }));

    const custRef = ref(database, `companies/${companyId}/customers`);
    unsubs.push(onValue(custRef, (snap) => {
      if (snap.exists()) {
        const cObj = snap.val();
        const cList = Object.entries(cObj).map(([id, c]) => ({ id, ...c }));
        // Only compute debtor debt lists for admin accounts
        const debtors = isAdmin
          ? cList.filter(c => Number(c.balance || c.currentBalance || c.dueAmount || 0) > 0)
              .sort((a, b) => Number(b.balance || b.currentBalance || 0) - Number(a.balance || a.currentBalance || 0))
          : [];
        setShopContext(prev => ({ ...prev, customers: cList, topDebtors: debtors }));
      }
    }));

    const ordRef = ref(database, `companies/${companyId}/orders`);
    unsubs.push(onValue(ordRef, (snap) => {
      if (snap.exists()) {
        const oObj = snap.val();
        const allOrders = Object.entries(oObj).map(([id, o]) => ({ id, ...o }));

        // Role-based order filtering: employees ONLY see their own orders!
        const accessibleOrders = isAdmin
          ? allOrders
          : allOrders.filter(o => o.createdBy === currentUser?.uid || o.employeeId === currentUser?.uid);

        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayOrders = accessibleOrders.filter(o => (o.createdAt || o.date || 0) >= todayStart);
        const todaySalesTotal = todayOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);

        setShopContext(prev => ({
          ...prev,
          orders: accessibleOrders,
          todaySales: todaySalesTotal,
          todayOrdersCount: todayOrders.length,
        }));
      }
    }));

    return () => {
      unsubs.forEach(u => u());
    };
  }, [companyId, isAdmin, currentUser?.uid]);

  // Executive System Audit Runner (Autonomous Check on Stocks, Sales Trends, Team Member Velocity & High Gaps)
  const runSystemAudit = (customOrders, customProducts, customCustomers, customEmployees) => {
    const audit = performExecutiveSystemAudit({
      products: customProducts || shopContext.products,
      orders: customOrders || shopContext.orders,
      customers: customCustomers || shopContext.customers,
      employees: customEmployees || shopContext.employees,
      isAdmin,
      currency: companyInfo?.currency || 'Rs.',
      userProfile,
      currentUserId: currentUser?.uid
    });

    const auditMsg = {
      role: 'assistant',
      verbal: audit.briefingVerbal,
      text: audit.briefingMarkdown,
      visuals: {
        type: 'audit_briefing',
        auditAlerts: audit.auditAlerts,
        cards: isAdmin ? [
          { label: 'Weekly Sales', value: `${companyInfo?.currency || 'Rs.'} ${audit.thisWeekSales.toLocaleString()}`, sub: `${audit.weekSalesDiffPct >= 0 ? `+${audit.weekSalesDiffPct}%` : `${audit.weekSalesDiffPct}%`} vs prev week` },
          { label: 'Monthly Sales', value: `${companyInfo?.currency || 'Rs.'} ${audit.curMonthSales.toLocaleString()}`, sub: `${audit.monthSalesDiffPct >= 0 ? `+${audit.monthSalesDiffPct}%` : `${audit.monthSalesDiffPct}%`} vs prev month` },
          { label: 'Low Stock', value: `${audit.lowStockItems.length} items`, sub: `${audit.zeroStockItems.length} zero stock` },
        ] : null,
        teamAnalysis: isAdmin ? audit.teamAnalysis : null,
      },
      timestamp: Date.now(),
    };

    setMessages(prev => {
      const nextMessages = prev.length <= 1 ? [auditMsg] : [...prev, auditMsg];
      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, nextMessages, pendingContext);
      }
      return nextMessages;
    });

    if (audit.briefingVerbal) {
      pendingSpeechRef.current = audit.briefingVerbal;
    }

    if (!voiceMuted && audit.briefingVerbal) {
      speakVoice(audit.briefingVerbal);
    }
  };

  // Automatically open AI Assistant & run executive audit upon login & company selection
  useEffect(() => {
    if (!companyId || !currentUser?.uid) return;

    const shouldAutoOpen = sessionStorage.getItem('lamba_auto_open_ai') === 'true';
    const sessionAuditKey = `lamba_session_audit_shown_${companyId}_${currentUser.uid}`;
    const alreadyAuditedInSession = sessionStorage.getItem(sessionAuditKey);

    if (shouldAutoOpen || !alreadyAuditedInSession) {
      sessionStorage.removeItem('lamba_auto_open_ai');
      sessionStorage.setItem(sessionAuditKey, 'true');

      setIsOpen(true);

      const timer = setTimeout(() => {
        runSystemAudit();
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [companyId, currentUser?.uid, shopContext.products.length]);

  // Clear conversation memory handler
  const handleClearMemory = async () => {
    if (window.confirm("Start a fresh conversation and reset assistant memory?")) {
      await clearConversationHistory(companyId, currentUser?.uid);
      setPendingContext(null);
      const resetMsg = {
        role: 'assistant',
        verbal: "Memory cleared. How can I help with your store operations today?",
        text: "✨ Conversation memory has been cleared. How can I assist you today?",
        visuals: null,
        timestamp: Date.now(),
      };
      setMessages([resetMsg]);
      toast.success("AI Conversation Memory Cleared");
    }
  };

  // Keep handleSendMessage ref in sync
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  // Stop listening and clean up any ongoing SpeechRecognition session
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Safe start listening helper - creates a fresh, pristine instance every time to prevent InvalidStateError
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info('Speech recognition is not supported in this browser. Please use Google Chrome or type your message.');
      return;
    }

    // Always abort and clean up any existing speech session before starting
    stopListening();
    stopVoice();

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        setIsListening(false);
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          if (handleSendMessageRef.current) {
            handleSendMessageRef.current(transcript.trim());
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition notice:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error('Microphone access was denied. Please allow microphone permissions in your browser.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
        recognitionRef.current = null;
      }
    }
  };

  // Toggle listening button handler
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Clean up recognition and voice synthesis on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (synthRef.current) {
        try { synthRef.current.cancel(); } catch (_) {}
      }
    };
  }, []);

  // Clean and prepare text for crisp, natural voice delivery
  const cleanSpeechText = (raw) => {
    if (!raw) return '';
    return raw
      .replace(/[*_#`~]/g, '') // Remove markdown symbols
      .replace(/\(SKU:[^)]+\)/gi, '') // Strip cryptic SKU codes
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Clean links
      .replace(/\bRs\.?\s*(\d+[\d,]*)/gi, '$1 Rupees') // Speak "Rupees" naturally
      .replace(/\bpcs\b/gi, 'pieces')
      .replace(/\bqty\b/gi, 'quantity')
      .replace(/\bkg\b/gi, 'kilograms')
      .replace(/['"]/g, '') // Strip quotation marks that cause clicks/pauses
      .replace(/[:;]/g, ',') // Replace colons with smooth pauses
      .replace(/[\r\n]+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Female Voice Speech Synthesis with Studio Clarity
  const speakVoice = (rawText, customVoiceName = null) => {
    if (voiceMuted || !('speechSynthesis' in window) || !rawText) return;
    try {
      window.speechSynthesis.resume();
      synthRef.current.cancel();

      const spokenText = cleanSpeechText(rawText);
      if (!spokenText) return;

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.pitch = 1.0;
      utterance.rate = 0.93;
      utterance.lang = 'en-US';

      pendingSpeechRef.current = rawText;

      let voices = synthRef.current.getVoices();
      if (!voices || voices.length === 0) {
        synthRef.current.onvoiceschanged = () => {
          speakVoice(rawText, customVoiceName);
        };
        return;
      }

      const voiceTarget = customVoiceName || selectedVoiceName;
      let chosenVoice = voiceTarget ? voices.find(v => v.name === voiceTarget) : null;

      if (!chosenVoice) {
        chosenVoice = voices.find(v => v.name === 'Google US English') ||
          voices.find(v => v.name.includes('Google') && v.name.includes('Female')) ||
          voices.find(v => v.name.includes('Ava') || v.name.includes('Zoe')) ||
          voices.find(v => v.name.includes('Samantha') && v.name.includes('Enhanced')) ||
          voices.find(v => v.name.includes('Victoria')) ||
          voices.find(v => v.name.includes('Karen')) ||
          voices.find(v => v.lang.startsWith('en')) ||
          voices[0];
      }

      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        pendingSpeechRef.current = null;
      };
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        setIsSpeaking(false);
        pendingSpeechRef.current = rawText;
      };

      synthRef.current.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis notice:', err);
      setIsSpeaking(false);
      pendingSpeechRef.current = rawText;
    }
  };

  const testCurrentVoice = (voiceName) => {
    const sample = "Hello! This is LAMBA AI. My voice is now crystal clear and ready to assist your store.";
    speakVoice(sample, voiceName);
  };

  const stopVoice = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  };


  // Execute Direct Actions (Add Customer, Add Product, Create Order, Download Invoices)
  const executeAiAction = async (action, liveOrders = [], liveCustomers = [], liveProducts = []) => {
    if (!action || !action.type || action.type === 'none') return null;

    try {
      const activeCustomers = (liveCustomers && liveCustomers.length > 0) ? liveCustomers : shopContext.customers;
      const activeProducts = (liveProducts && liveProducts.length > 0) ? liveProducts : shopContext.products;
      const activeOrders = (liveOrders && liveOrders.length > 0) ? liveOrders : shopContext.orders;

      // 1. ADD CUSTOMER / SHOP
      if (action.type === 'add_customer') {
        const customerData = {
          shopName: action.shopName || action.name || 'New Customer Shop',
          contactPerson: action.contactPerson || action.name || '',
          phone: action.phone || '',
          address: action.address || '',
          city: action.city || '',
          openingBalance: Number(action.openingBalance || action.balance || 0),
          currentBalance: Number(action.openingBalance || action.balance || 0),
          balance: Number(action.openingBalance || action.balance || 0),
        };
        const newCustId = await createCustomer(
          companyId,
          customerData,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );
        toast.success(`Customer "${customerData.shopName}" added successfully!`);
        return {
          type: 'action_success',
          title: 'Customer Shop Added',
          details: `Shop "${customerData.shopName}" has been registered in your system with Phone: ${customerData.phone || 'N/A'}.`,
        };
      }

      // 2. ADD PRODUCT (Admin Only)
      if (action.type === 'add_product') {
        if (!isAdmin) {
          return {
            type: 'permission_denied',
            title: 'Permission Denied',
            details: 'Only administrators have permission to add new products to the catalog.',
          };
        }
        const prodData = {
          name: action.name || 'New Product',
          sku: action.sku || `PROD-${Date.now().toString().slice(-4)}`,
          salePrice: Number(action.salePrice || action.price || 100),
          purchasePrice: Number(action.costPrice || action.purchasePrice || (Number(action.salePrice || 100) * 0.7)),
          currentStock: Number(action.stock || action.currentStock || 10),
          minimumStock: Number(action.minimumStock || 5),
          category: action.category || 'General',
          unit: action.unit || 'pcs',
        };
        const newProdId = await createProduct(
          companyId,
          prodData,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );
        toast.success(`Product "${prodData.name}" added successfully!`);
        return {
          type: 'action_success',
          title: 'Product Added to Catalog',
          details: `Product "${prodData.name}" added with Stock: ${prodData.currentStock} units at Price: Rs. ${prodData.salePrice.toLocaleString()}.`,
        };
      }

      // 3. CREATE ORDER
      if (action.type === 'create_order') {
        // Find or match customer
        const custQuery = (action.customerName || '').toLowerCase().trim();
        const matchedCust = activeCustomers.find(c =>
          (c.name || c.shopName || '').toLowerCase().includes(custQuery)
        ) || activeCustomers[0];

        // Match items with catalog products
        const orderItems = (action.items || []).map((item, idx) => {
          const itemQuery = (item.name || '').toLowerCase().trim();
          const matchedProd = activeProducts.find(p =>
            (p.name || '').toLowerCase().includes(itemQuery)
          );
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || matchedProd?.salePrice || matchedProd?.price || 500);
          return {
            productId: matchedProd?.id || `item_${idx}`,
            productName: matchedProd?.name || item.name || 'Custom Item',
            quantity: qty,
            salePrice: price,
            lineTotal: qty * price,
          };
        });

        const grandTotal = orderItems.reduce((acc, it) => acc + it.lineTotal, 0) || Number(action.grandTotal || 1000);
        const isCash = action.paymentType === 'cash';
        const amountPaid = isCash ? grandTotal : Number(action.amountPaid || 0);

        const orderData = {
          customerId: matchedCust?.id || 'walk_in',
          customerName: matchedCust?.name || matchedCust?.shopName || action.customerName || 'Walk-in Customer',
          customerPhone: matchedCust?.phone || '',
          items: orderItems,
          grandTotal,
          amountPaid,
          paymentType: isCash ? 'cash' : 'credit',
          status: 'completed',
        };

        const newOrdId = await createOrder(
          companyId,
          orderData,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );
        toast.success(`Order created successfully for ${orderData.customerName}!`);
        return {
          type: 'action_success',
          title: 'Order Created Successfully',
          details: `Order created for ${orderData.customerName}. Total: Rs. ${grandTotal.toLocaleString()} (${orderData.paymentType.toUpperCase()}).`,
        };
      }

      // 4. GENERATE / DOWNLOAD PDF INVOICES
      if (action.type === 'download_invoices' || action.type === 'generate_invoices') {
        const filterType = action.filterType || 'all';
        const employeeQuery = (action.employeeName || action.employee || '').toLowerCase().trim();
        const dateQuery = (action.date || '').toLowerCase().trim();
        const orderNumberQuery = (action.orderNumber || action.order || '').toLowerCase().trim();

        let matched = [...activeOrders];

        if (orderNumberQuery) {
          matched = matched.filter(o =>
            (o.orderNumber || '').toLowerCase().includes(orderNumberQuery) ||
            (o.id || '').toLowerCase().includes(orderNumberQuery)
          );
        } else {
          if (employeeQuery) {
            matched = matched.filter(o =>
              (o.createdByName || o.employeeName || '').toLowerCase().includes(employeeQuery) ||
              (o.createdBy || '').toLowerCase().includes(employeeQuery)
            );
          }
          if (dateQuery) {
            matched = matched.filter(o => {
              if (!o.createdAt) return false;
              const d = new Date(o.createdAt);
              if (isNaN(d.getTime())) return false;

              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');

              const localIso = `${y}-${m}-${day}`; // "2026-10-26"
              const localSlash = `${day}/${m}/${y}`; // "26/10/2026"
              const localShort = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase(); // "26 oct 2026"
              const localLong = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toLowerCase(); // "26 october 2026"

              const q = dateQuery.toLowerCase().trim();
              if (q === 'today') {
                const now = new Date();
                return d.toDateString() === now.toDateString() || localIso === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              }

              return (
                localIso.includes(q) ||
                q.includes(localIso) ||
                localSlash.includes(q) ||
                localShort.includes(q) ||
                localLong.includes(q) ||
                q.includes(localShort) ||
                q.includes(localLong) ||
                (q.includes(String(d.getDate())) && (q.includes('oct') || q.includes('10') || !q.match(/[a-z]/)))
              );
            });
          }
        }

        if (matched.length === 0) {
          return {
            type: 'action_warning',
            title: 'No Matching Orders Found',
            details: `Could not find any orders matching ${employeeQuery ? `employee "${employeeQuery}"` : ''}${dateQuery ? `date "${dateQuery}"` : ''}${orderNumberQuery ? `order "${orderNumberQuery}"` : ''}.`,
          };
        }

        const enriched = matched.map(o => {
          const cust = activeCustomers.find(c => c.id === o.customerId || (c.shopName || c.name) === o.customerName);
          return {
            ...o,
            customerAddress: o.customerAddress || cust?.address || cust?.city || '—',
            customerPhone: o.customerPhone || cust?.phone || '—',
          };
        });

        const compName = companyInfo?.name || 'LAMBA Store';
        const currencySymbol = companyInfo?.currency || 'Rs.';

        if (enriched.length === 1) {
          await exportOrderInvoiceToPDF(enriched[0], compName, currencySymbol);
          toast.success(`Invoice PDF downloaded for ${enriched[0].orderNumber || 'order'}!`);
          return {
            type: 'download_success',
            title: `Invoice PDF Downloaded: ${enriched[0].orderNumber || enriched[0].id}`,
            details: `Successfully generated and downloaded PDF invoice for order ${enriched[0].orderNumber || enriched[0].id} (${enriched[0].customerName || 'Customer'}, ${currencySymbol} ${Number(enriched[0].grandTotal || 0).toLocaleString()}).`,
            orders: enriched,
          };
        } else {
          await exportMultipleInvoicesToPDF(enriched, compName, currencySymbol);
          toast.success(`Downloaded combined PDF with ${enriched.length} invoices!`);
          return {
            type: 'download_success',
            title: `${enriched.length} Invoices Downloaded as PDF`,
            details: `Successfully generated and downloaded combined PDF containing ${enriched.length} order invoices${employeeQuery ? ` for employee "${employeeQuery}"` : ''}${dateQuery ? ` for date "${dateQuery}"` : ''}.`,
            orders: enriched,
          };
        }
      }

      // 5. RECEIVE PAYMENT FROM CUSTOMER / SHOP (Reduces credit balance)
      if (action.type === 'receive_payment' || action.type === 'record_payment' || action.type === 'create_payment') {
        const custQuery = (action.customerName || action.shopName || action.customer || '').toLowerCase().trim();
        const matchedCust = activeCustomers.find(c => {
          const sName = (c.shopName || c.name || '').toLowerCase();
          const cleanQ = custQuery.replace(/[^a-z0-9]/g, '');
          const cleanS = sName.replace(/[^a-z0-9]/g, '');
          return sName.includes(custQuery) || custQuery.includes(sName) || (cleanQ.length > 2 && (cleanS.includes(cleanQ) || cleanQ.includes(cleanS)));
        }) || activeCustomers[0];

        if (!matchedCust) {
          return {
            type: 'action_warning',
            title: 'Customer Shop Not Found',
            details: `Could not find a registered customer shop matching "${action.customerName || 'customer'}".`,
          };
        }

        const payAmount = Number(action.amount) || 0;
        if (payAmount <= 0) {
          return {
            type: 'action_warning',
            title: 'Invalid Amount',
            details: 'Payment amount must be greater than 0.',
          };
        }

        const currentDebt = Number(matchedCust.currentBalance ?? matchedCust.balance ?? 0) || 0;
        const paymentData = {
          customerId: matchedCust.id,
          customerName: matchedCust.shopName || matchedCust.name,
          amount: payAmount,
          paymentMethod: action.paymentMethod || 'Cash',
          reference: action.reference || 'Recorded by LAMBA AI',
          notes: action.notes || 'AI Voice Agent Payment Collection',
          createdAt: Date.now(),
        };

        const paymentId = await createCustomerPaymentReceived(
          companyId,
          paymentData,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );

        const newBal = Math.max(0, currentDebt - payAmount);
        toast.success(`Payment of Rs. ${payAmount.toLocaleString()} received from ${paymentData.customerName}!`);

        return {
          type: 'action_success',
          title: `Payment Received: Rs. ${payAmount.toLocaleString()}`,
          details: `Recorded payment of Rs. ${payAmount.toLocaleString()} (${paymentData.paymentMethod}) from "${paymentData.customerName}". Previous Due: Rs. ${currentDebt.toLocaleString()} | New Balance Due: Rs. ${newBal.toLocaleString()}.`,
        };
      }

      // 6. RECORD SUPPLIER PAYMENT
      if (action.type === 'pay_supplier') {
        const supName = action.supplierName || 'General Supplier';
        const payAmount = Number(action.amount) || 0;
        if (payAmount <= 0) {
          return {
            type: 'action_warning',
            title: 'Invalid Amount',
            details: 'Supplier payment amount must be greater than 0.',
          };
        }

        const paymentData = {
          supplierName: supName,
          amount: payAmount,
          paymentMethod: action.paymentMethod || 'Cash',
          reference: action.reference || 'Recorded by LAMBA AI',
          notes: action.notes || 'Supplier payment by LAMBA AI',
          createdAt: Date.now(),
        };

        const paymentId = await createSupplierPayment(
          companyId,
          paymentData,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );

        toast.success(`Payment of Rs. ${payAmount.toLocaleString()} to supplier ${supName} recorded!`);
        return {
          type: 'action_success',
          title: `Supplier Payment Recorded: Rs. ${payAmount.toLocaleString()}`,
          details: `Successfully recorded payment of Rs. ${payAmount.toLocaleString()} to supplier "${supName}".`,
        };
      }

      // 7. DELETE ORDER
      if (action.type === 'delete_order') {
        if (!isAdmin) {
          return {
            type: 'permission_denied',
            title: 'Permission Denied',
            details: 'Only store administrators can delete orders.',
          };
        }
        const orderQuery = (action.orderNumber || action.orderId || action.order || '').toLowerCase().trim();
        const matchedOrder = activeOrders.find(o =>
          (o.orderNumber || '').toLowerCase().includes(orderQuery) ||
          (o.id || '').toLowerCase().includes(orderQuery)
        );

        if (!matchedOrder) {
          return {
            type: 'action_warning',
            title: 'Order Not Found',
            details: `Could not find order matching "${orderQuery}". Please verify the order number.`,
          };
        }

        await deleteOrder(
          companyId,
          matchedOrder.id,
          matchedOrder.orderNumber,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );

        toast.success(`Order ${matchedOrder.orderNumber} deleted successfully!`);
        return {
          type: 'action_success',
          title: `Order Deleted: ${matchedOrder.orderNumber}`,
          details: `Order #${matchedOrder.orderNumber} (${matchedOrder.customerName || 'Customer'}, Rs. ${Number(matchedOrder.grandTotal || 0).toLocaleString()}) has been deleted. Product inventory stock and customer credit balance have been restored.`,
        };
      }

      // 8. DELETE PRODUCT
      if (action.type === 'delete_product') {
        if (!isAdmin) {
          return {
            type: 'permission_denied',
            title: 'Permission Denied',
            details: 'Only store administrators can delete products.',
          };
        }
        const prodQuery = (action.productName || action.name || action.sku || '').toLowerCase().trim();
        const matchedProd = activeProducts.find(p =>
          (p.name || '').toLowerCase().includes(prodQuery) ||
          (p.sku || '').toLowerCase().includes(prodQuery) ||
          p.id === prodQuery
        );

        if (!matchedProd) {
          return {
            type: 'action_warning',
            title: 'Product Not Found',
            details: `Could not find product matching "${prodQuery}".`,
          };
        }

        await deleteProduct(
          companyId,
          matchedProd.id,
          matchedProd.name,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );

        toast.success(`Product "${matchedProd.name}" deleted successfully!`);
        return {
          type: 'action_success',
          title: `Product Deleted: ${matchedProd.name}`,
          details: `Product "${matchedProd.name}" (SKU: ${matchedProd.sku || 'N/A'}) has been permanently removed from your catalog.`,
        };
      }

      // 9. DELETE CUSTOMER / SHOP
      if (action.type === 'delete_customer' || action.type === 'delete_shop') {
        if (!isAdmin) {
          return {
            type: 'permission_denied',
            title: 'Permission Denied',
            details: 'Only store administrators can delete customer shops.',
          };
        }
        const custQuery = (action.customerName || action.shopName || action.name || '').toLowerCase().trim();
        const matchedCust = activeCustomers.find(c =>
          (c.shopName || c.name || '').toLowerCase().includes(custQuery) ||
          c.id === custQuery
        );

        if (!matchedCust) {
          return {
            type: 'action_warning',
            title: 'Customer Shop Not Found',
            details: `Could not find customer shop matching "${custQuery}".`,
          };
        }

        await deleteCustomer(
          companyId,
          matchedCust.id,
          matchedCust.shopName || matchedCust.name,
          currentUser?.uid || 'ai_agent',
          userProfile?.name || 'LAMBA AI'
        );

        toast.success(`Customer "${matchedCust.shopName || matchedCust.name}" deleted successfully!`);
        return {
          type: 'action_success',
          title: `Shop Deleted: ${matchedCust.shopName || matchedCust.name}`,
          details: `Customer shop "${matchedCust.shopName || matchedCust.name}" has been deleted from your store directory.`,
        };
      }
    } catch (err) {
      console.error('Error executing AI action:', err);
      toast.error(`Action failed: ${err.message}`);
      return {
        type: 'action_failed',
        title: 'Action Failed',
        details: err.message,
      };
    }
    return null;
  };

  // Call Groq AI API & Local Fast Handlers
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || queryInput).trim();
    if (!text || loading) return;

    setQueryInput('');
    stopVoice();

    // 1. MULTI-TURN RESOLUTION: Check if user is replying to pending context (e.g. date for invoices)
    if (pendingContext?.intent === 'download_invoices') {
      const dateOrQuery = text.trim();
      const userMsg = { role: 'user', text, timestamp: Date.now() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setLoading(true);

      let activeOrders = shopContext.orders;
      let activeCustomers = shopContext.customers;
      let activeProducts = shopContext.products;

      if (companyId) {
        try {
          const oSnap = await get(ref(database, `companies/${companyId}/orders`));
          if (oSnap.exists()) {
            const allO = Object.entries(oSnap.val()).map(([id, o]) => ({ id, ...o }));
            activeOrders = isAdmin ? allO : allO.filter(o => o.createdBy === currentUser?.uid || o.employeeId === currentUser?.uid);
          }
        } catch (_) {}
      }

      const actionResult = await executeAiAction({
        type: 'download_invoices',
        filterType: 'date',
        date: dateOrQuery,
      }, activeOrders, activeCustomers, activeProducts);

      const aiMsg = {
        role: 'assistant',
        verbal: actionResult?.details || 'Invoices processed.',
        text: actionResult?.type === 'download_success'
          ? `✅ **Invoices Generated & Downloaded**\n\n${actionResult.details}`
          : `⚠️ **Notice**\n\n${actionResult.details}`,
        visuals: {
          type: 'action_card',
          actionResult,
        },
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      setPendingContext(null);
      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
      }
      if (!voiceMuted && aiMsg.verbal) speakVoice(aiMsg.verbal);
      setLoading(false);
      return;
    }

    // 2. MULTI-TURN INVOICE INTERCEPT: Vague invoice command without date
    const cleanLower = text.toLowerCase().trim();
    const isVagueInvoiceRequest =
      (cleanLower.includes('invoice') || cleanLower.includes('invoices') || cleanLower.includes('bill')) &&
      (cleanLower.startsWith('create') || cleanLower.startsWith('download') || cleanLower.startsWith('generate') || cleanLower.startsWith('give') || cleanLower.startsWith('make') || cleanLower === 'invoices' || cleanLower === 'create invoices') &&
      !cleanLower.match(/\d+/) && !cleanLower.includes('today') && !cleanLower.includes('yesterday') && !cleanLower.includes('employee');

    if (isVagueInvoiceRequest) {
      const userMsg = { role: 'user', text, timestamp: Date.now() };
      const aiMsg = {
        role: 'assistant',
        verbal: "Certainly! Which date or employee should I generate invoices for? For example: Today, Yesterday, or 29 Oct.",
        text: "Certainly! For which date or employee should I generate invoices?\n\nYou can reply with:\n- **Today**\n- **Yesterday**\n- A specific date like **29 Oct**\n- Or employee name (e.g. *\"for ke\"*)*",
        visuals: { type: 'general' },
        timestamp: Date.now(),
      };
      const newCtx = { intent: 'download_invoices', originalQuery: text };
      const finalMessages = [...messages, userMsg, aiMsg];
      setMessages(finalMessages);
      setPendingContext(newCtx);
      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, finalMessages, newCtx);
      }
      if (!voiceMuted && aiMsg.verbal) speakVoice(aiMsg.verbal);
      return;
    }

    // 3. SYSTEM CHECK / AUDIT SHORTCUT
    if (cleanLower.includes('system check') || cleanLower.includes('system audit') || cleanLower.includes('check system') || cleanLower === 'audit') {
      const userMsg = { role: 'user', text, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      runSystemAudit();
      return;
    }

    // 4. SMART QUERY CACHE LOOKUP (0 Tokens Used from Groq!)
    const cachedAnswer = await getCachedQueryAnswer(companyId, currentUser?.uid, text);
    if (cachedAnswer) {
      const userMsg = { role: 'user', text, timestamp: Date.now() };
      const cachedMsg = {
        role: 'assistant',
        verbal: cachedAnswer.verbal,
        text: cachedAnswer.text,
        cached: true,
        visuals: {
          type: cachedAnswer.visualType || 'general',
          cards: cachedAnswer.cards || null,
        },
        timestamp: Date.now(),
      };
      const finalMessages = [...messages, userMsg, cachedMsg];
      setMessages(finalMessages);
      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, finalMessages, pendingContext);
      }
      if (!voiceMuted && cachedMsg.verbal) speakVoice(cachedMsg.verbal);
      return;
    }

    // 5. RULE: Filter out irrelevant pure greetings
    const isPureGreeting = /^(hi|hello|hey|salam|assalam|aao|kya haal|how are you|who are you|good morning|good evening|good afternoon)[\s!.]*$/i.test(cleanLower);
    if (isPureGreeting) {
      const greetingMsg = {
        role: 'assistant',
        verbal: "Hello! I am your LAMBA Business Assistant. I only handle store operations such as managing orders, customer shops, and products. How can I assist you today?",
        text: "Hello! I am the **LAMBA Business AI Assistant**.\n\nI only process business system operations, such as:\n- **Orders**: checking sales, tracking orders, or creating invoices\n- **Customers / Shops**: finding or registering shops\n- **Products**: catalog inquiries and stock levels\n\nHow can I assist your business today?",
        visuals: null,
        timestamp: Date.now(),
      };
      const finalMessages = [...messages, { role: 'user', text, timestamp: Date.now() }, greetingMsg];
      setMessages(finalMessages);
      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, finalMessages, pendingContext);
      }
      if (!voiceMuted) speakVoice(greetingMsg.verbal);
      return;
    }

    // 6. RULE: Role-Based Restriction — Employees cannot ask about low stock or financial stats
    if (!isAdmin) {
      const isRestrictedQuery = /(\bstock\b|\blow\s*stock\b|\bwarehouse\b|\binventory\b|\bprofit\b|\bexpense\b|\bpurchase\b|\bfinancial\b|\bledger\b)/i.test(cleanLower);
      if (isRestrictedQuery) {
        const restrictedMsg = {
          role: 'assistant',
          verbal: "I apologize, but you do not have permission to access inventory stock levels or financial reports. You only have access to orders, shops, and order creation.",
          text: "🔒 **Access Restricted**\n\nYour account is an **Employee Account**. You do not have permission to view inventory stock levels, warehouse status, or business financial reports.\n\nPlease contact your store Administrator for inventory inquiries.",
          visuals: {
            type: 'permission_denied',
          },
          timestamp: Date.now(),
        };
        const finalMessages = [...messages, { role: 'user', text, timestamp: Date.now() }, restrictedMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, pendingContext);
        }
        if (!voiceMuted) speakVoice(restrictedMsg.verbal);
        return;
      }
    }

    // Add user message
    const newMessages = [...messages, { role: 'user', text, timestamp: Date.now() }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const currency = companyInfo?.currency || 'Rs.';

      let currentProducts = shopContext.products;
      let currentCustomers = shopContext.customers;
      let currentOrders = shopContext.orders;
      let currentPurchases = [];
      let currentPayments = [];
      let currentExpenses = [];

      if (companyId) {
        try {
          const [pSnap, cSnap, oSnap, purSnap, paySnap, expSnap] = await Promise.all([
            get(ref(database, `companies/${companyId}/products`)),
            get(ref(database, `companies/${companyId}/customers`)),
            get(ref(database, `companies/${companyId}/orders`)),
            isAdmin ? get(ref(database, `companies/${companyId}/purchases`)) : Promise.resolve(null),
            isAdmin ? get(ref(database, `companies/${companyId}/payments`)) : Promise.resolve(null),
            isAdmin ? get(ref(database, `companies/${companyId}/expenses`)) : Promise.resolve(null),
          ]);
          if (pSnap && pSnap.exists()) {
            currentProducts = Object.entries(pSnap.val()).map(([id, p]) => ({ id, ...p }));
          }
          if (oSnap && oSnap.exists()) {
            const allO = Object.entries(oSnap.val()).map(([id, o]) => ({ id, ...o }));
            currentOrders = isAdmin
              ? allO
              : allO.filter(o => o.createdBy === currentUser?.uid || o.employeeId === currentUser?.uid || o.createdByName === userProfile?.name);
          }
          if (cSnap && cSnap.exists()) {
            const allC = Object.entries(cSnap.val()).map(([id, c]) => ({ id, ...c }));
            currentCustomers = isAdmin
              ? allC
              : allC.filter(c =>
                  c.createdBy === currentUser?.uid ||
                  c.createdByName === userProfile?.name ||
                  currentOrders.some(o => o.customerId === c.id)
                );
          }
          if (purSnap && purSnap.exists()) {
            currentPurchases = Object.entries(purSnap.val()).map(([id, p]) => ({ id, ...p }));
          }
          if (paySnap && paySnap.exists()) {
            currentPayments = Object.entries(paySnap.val()).map(([id, p]) => ({ id, ...p }));
          }
          if (expSnap && expSnap.exists()) {
            currentExpenses = Object.entries(expSnap.val()).map(([id, e]) => ({ id, ...e }));
          }
        } catch (fetchErr) {
          console.warn('Real-time database fetch error, falling back to cache:', fetchErr);
        }
      }

      // Compute exact financial metrics
      const totalPurchases = currentPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
      const supplierPaymentsMade = currentPayments
        .filter(p => p.type === 'supplier_payment')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const outstandingPayable = totalPurchases - supplierPaymentsMade;

      const totalCustomerCreditLeft = currentCustomers.reduce((sum, c) => {
        return sum + (Number(c.currentBalance ?? c.balance ?? c.dueAmount ?? 0) || 0);
      }, 0);

      const totalExpenses = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const activeOrders = currentOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
      const totalSalesAll = activeOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

      let totalCogs = 0;
      activeOrders.forEach(order => {
        if (order && order.items) {
          const rawItems = Array.isArray(order.items) ? order.items : Object.values(order.items);
          rawItems.forEach(item => {
            if (!item) return;
            const productMatch = currentProducts.find(p => 
              (item.productId && p.id === item.productId) || 
              (item.sku && p.sku && String(p.sku).trim().toLowerCase() === String(item.sku).trim().toLowerCase()) ||
              (item.productName && p.name && String(p.name).trim().toLowerCase() === String(item.productName).trim().toLowerCase())
            );
            const unitCost = Number(item.costPriceAtSale) > 0 
              ? Number(item.costPriceAtSale) 
              : (Number(item.purchasePrice) > 0 
                ? Number(item.purchasePrice) 
                : (Number(item.costPrice) > 0 
                  ? Number(item.costPrice) 
                  : (Number(productMatch?.purchasePrice) > 0 
                    ? Number(productMatch.purchasePrice) 
                    : (Number(productMatch?.costPrice) > 0 
                      ? Number(productMatch.costPrice) 
                      : 0))));
            const qty = Math.max(0, (Number(item.quantity) || 0) - (Number(item.returnedQty || item.returnedQuantity) || 0));
            totalCogs += unitCost * qty;
          });
        }
      });
      const netProfit = totalSalesAll - totalCogs - totalExpenses;

      const freshLowStock = isAdmin
        ? currentProducts.filter(p => Number(p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0) <= Number(p.lowStockThreshold ?? p.minimumStock ?? 10))
        : [];
      const freshTopDebtors = isAdmin
        ? currentCustomers.filter(c => Number(c.balance || c.currentBalance || c.dueAmount || 0) > 0)
            .sort((a, b) => Number(b.balance || b.currentBalance || 0) - Number(a.balance || a.currentBalance || 0))
        : [];

      const todayStart = new Date().setHours(0, 0, 0, 0);
      const todayOrders = currentOrders.filter(o => (o.createdAt || o.date || 0) >= todayStart);
      const todaySalesTotal = todayOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);

      const auditData = performExecutiveSystemAudit({
        products: currentProducts,
        orders: currentOrders,
        customers: currentCustomers,
        employees: shopContext.employees,
        isAdmin,
        currency,
        userProfile,
        currentUserId: currentUser?.uid,
      });

      // ==========================================
      // PRE-ADDED CHIPS & FAST DIRECT LOCAL HANDLERS
      // (100% Reliable, 0 External Groq Tokens Used)
      // ==========================================

      // Handler 1: Team Order Breakdown & Drops
      const isTeamQuery = cleanLower.includes('team') || cleanLower.includes('salesman') || cleanLower.includes('highlight drop') || (cleanLower.includes('member') && cleanLower.includes('order'));
      if (isTeamQuery) {
        const repList = auditData.teamAnalysis || [];
        const verbal = repList.length > 0
          ? `Here is your team order breakdown. ${repList.map(r => `${r.name} has ${r.thisWeekOrders} orders this week, ${r.orderDiffPct >= 0 ? `up ${r.orderDiffPct}%` : `down ${Math.abs(r.orderDiffPct)}%`}`).join('. ')}.`
          : "There are no team member orders recorded yet.";

        const text = `👥 **Team Performance & Weekly Comparison**\n\n` +
          (repList.length > 0
            ? repList.map(r => `• **${r.name}**: ${r.thisWeekOrders} orders this week (vs ${r.prevWeekOrders} last week, **${r.orderDiffPct >= 0 ? `+${r.orderDiffPct}%` : `${r.orderDiffPct}%`}**)\n  *Revenue: ${currency} ${r.thisWeekSales.toLocaleString()}*`).join('\n')
            : 'No team orders found for this period.');

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'metrics',
            teamAnalysis: repList,
            cards: repList.slice(0, 3).map(r => ({
              label: r.name,
              value: `${r.thisWeekOrders} Orders`,
              sub: `${r.orderDiffPct >= 0 ? `+${r.orderDiffPct}%` : `${r.orderDiffPct}%`} vs last week`
            }))
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 2: Sales Trends & Comparisons
      const isSalesTrendQuery = cleanLower.includes('sales trend') || cleanLower.includes('compare sales') || cleanLower.includes('sales this week') || (cleanLower.includes('sales') && cleanLower.includes('last month')) || (cleanLower.includes('sales') && cleanLower.includes('last week'));
      if (isSalesTrendQuery) {
        const verbal = `This week's sales are ${currency} ${auditData.thisWeekSales.toLocaleString()}, ${auditData.weekSalesDiffPct >= 0 ? `up ${auditData.weekSalesDiffPct}%` : `down ${Math.abs(auditData.weekSalesDiffPct)}%`} compared to last week. Monthly sales stand at ${currency} ${auditData.curMonthSales.toLocaleString()}.`;
        const text = `📈 **Sales Velocity & Comparisons**\n\n` +
          `• **This Week's Sales:** ${currency} ${auditData.thisWeekSales.toLocaleString()} (${auditData.weekSalesDiffPct >= 0 ? `+${auditData.weekSalesDiffPct}%` : `${auditData.weekSalesDiffPct}%`} vs previous week of ${currency} ${auditData.prevWeekSales.toLocaleString()})\n` +
          `• **This Month's Sales:** ${currency} ${auditData.curMonthSales.toLocaleString()} (${auditData.monthSalesDiffPct >= 0 ? `+${auditData.monthSalesDiffPct}%` : `${auditData.monthSalesDiffPct}%`} vs previous month of ${currency} ${auditData.prevMonthSales.toLocaleString()})\n` +
          `• **Total Orders Logged:** ${auditData.thisWeekOrders?.length || 0} orders`;

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'metrics',
            cards: [
              { label: 'Weekly Sales', value: `${currency} ${auditData.thisWeekSales.toLocaleString()}`, sub: `${auditData.weekSalesDiffPct >= 0 ? `+${auditData.weekSalesDiffPct}%` : `${auditData.weekSalesDiffPct}%`} vs last week` },
              { label: 'Monthly Sales', value: `${currency} ${auditData.curMonthSales.toLocaleString()}`, sub: `${auditData.monthSalesDiffPct >= 0 ? `+${auditData.monthSalesDiffPct}%` : `${auditData.monthSalesDiffPct}%`} vs last month` },
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 3: Low Stock Alerts
      const isLowStockQuery = cleanLower.includes('low stock') || cleanLower.includes('restock') || (cleanLower.includes('stock') && cleanLower.includes('low'));
      if (isLowStockQuery) {
        const count = freshLowStock.length;
        const verbal = count > 0
          ? `You have ${count} product${count > 1 ? 's' : ''} running low on stock and needing replenishment.`
          : "Great news, all your warehouse products are currently adequately stocked.";

        const text = `⚠️ **Inventory Stock Replenishment Status**\n\n` +
          (count > 0
            ? `Found **${count}** item(s) below recommended reorder levels:\n\n` +
              freshLowStock.map(p => `• **${p.name || 'Item'}**: Stock ${p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0} left (Price: ${currency} ${(p.salePrice ?? p.price ?? 0).toLocaleString()})`).join('\n')
            : 'All product stock levels are healthy.');

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'low_stock',
            tableItems: freshLowStock.map(p => ({
              name: p.name || 'Item',
              stock: p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0,
              price: p.salePrice ?? p.price ?? 0
            })),
            cards: [
              { label: 'Low Stock Items', value: `${count}`, sub: `${freshLowStock.filter(p => Number(p.currentStock || 0) <= 0).length} out of stock` }
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 4: Customer Credit Left & Debtors
      const isCreditQuery = (cleanLower.includes('credit') && cleanLower.includes('left')) || cleanLower.includes('who owes') || cleanLower.includes('debtor');
      if (isCreditQuery) {
        const verbal = `Total customer credit left is ${currency} ${totalCustomerCreditLeft.toLocaleString()} across ${freshTopDebtors.length} debtor shops.`;
        const text = `💳 **Total Customer Credit Left & Debtors**\n\n` +
          `• **Total Outstanding Customer Due:** ${currency} ${totalCustomerCreditLeft.toLocaleString()}\n\n` +
          (freshTopDebtors.length > 0
            ? `**Top Unpaid Customer Shops:**\n` +
              freshTopDebtors.map(c => `• **${c.shopName || c.name || 'Customer'}**: Due ${currency} ${(c.currentBalance ?? c.balance ?? 0).toLocaleString()} (Phone: ${c.phone || 'N/A'})`).join('\n')
            : 'No unpaid customer balances found.');

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'debtors',
            debtors: freshTopDebtors.map(c => ({
              name: c.shopName || c.name || 'Customer',
              phone: c.phone || '',
              amount: c.currentBalance ?? c.balance ?? 0,
              whatsappMsg: `Assalam-o-Alaikum ${c.shopName || c.name}, reminder regarding pending balance of ${currency} ${(c.currentBalance ?? c.balance ?? 0).toLocaleString()} with ${companyInfo?.name || 'our store'}.`
            })),
            cards: [
              { label: 'Customer Credit Left', value: `${currency} ${totalCustomerCreditLeft.toLocaleString()}`, sub: `${freshTopDebtors.length} debtors` }
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 5: Outstanding Payable
      const isPayableQuery = cleanLower.includes('outstanding payable') || cleanLower.includes('supplier payable') || (cleanLower.includes('payable') && cleanLower.includes('supplier'));
      if (isPayableQuery) {
        const verbal = `Your total outstanding payable to suppliers is ${currency} ${outstandingPayable.toLocaleString()}. Total purchases are ${currency} ${totalPurchases.toLocaleString()} with ${currency} ${supplierPaymentsMade.toLocaleString()} paid.`;
        const text = `📦 **Supplier Accounts Payable Ledger**\n\n` +
          `• **Outstanding Accounts Payable:** ${currency} ${outstandingPayable.toLocaleString()}\n` +
          `• **Total Purchases Recorded:** ${currency} ${totalPurchases.toLocaleString()}\n` +
          `• **Total Supplier Payments Made:** ${currency} ${supplierPaymentsMade.toLocaleString()}`;

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'metrics',
            cards: [
              { label: 'Outstanding Payable', value: `${currency} ${outstandingPayable.toLocaleString()}`, sub: 'Owed to Suppliers' },
              { label: 'Total Purchases', value: `${currency} ${totalPurchases.toLocaleString()}`, sub: 'Recorded' },
              { label: 'Payments Made', value: `${currency} ${supplierPaymentsMade.toLocaleString()}`, sub: 'Paid' },
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 6: Today's Sales & Orders
      const isTodaySalesQuery = (cleanLower.includes('today') && cleanLower.includes('sale')) || (cleanLower.includes('today') && cleanLower.includes('order'));
      if (isTodaySalesQuery) {
        const verbal = `Today you have logged ${todayOrders.length} orders totaling ${currency} ${todaySalesTotal.toLocaleString()}.`;
        const text = `📊 **Today's Store Performance**\n\n` +
          `• **Today's Orders:** ${todayOrders.length} orders\n` +
          `• **Today's Revenue:** ${currency} ${todaySalesTotal.toLocaleString()}`;

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'metrics',
            cards: [
              { label: "Today's Sales", value: `${currency} ${todaySalesTotal.toLocaleString()}`, sub: `${todayOrders.length} orders` },
              { label: "Today's Orders", value: `${todayOrders.length}`, sub: 'Total bookings' }
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 7: Add Customer Shop (Pre-Added Chips & Direct Add Intents - 0 Tokens, 100% Reliable)
      const isAddCustomerQuery = (cleanLower.startsWith('add ') || cleanLower.startsWith('create ') || cleanLower.startsWith('register ')) &&
        (cleanLower.includes('customer') || cleanLower.includes('shop') || cleanLower.includes('mart') || cleanLower.includes('trader'));
      if (isAddCustomerQuery) {
        let nameMatch = text.match(/(?:named|name|shop|customer)\s+([A-Za-z0-9\s&'-]+?)(?:\s+with|\s+in|\s+phone|\s+at|\.|$)/i);
        let phoneMatch = text.match(/(?:phone|cell|mobile|number|contact)?\s*([0-9\s+()-]{7,15})/i);
        let cityMatch = text.match(/(?:in|at|city)\s+([A-Za-z\s]+?)(?:\.|$)/i);

        let shopName = nameMatch ? nameMatch[1].replace(/a new customer shop/i, '').replace(/named/i, '').trim() : 'New Customer Shop';
        if (!shopName || shopName.length < 2) shopName = 'New Customer Shop';
        let phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '').trim() : '';
        let city = cityMatch ? cityMatch[1].trim() : '';

        const actionResult = await executeAiAction({
          type: 'add_customer',
          shopName,
          phone,
          city,
          address: city,
        }, currentOrders, currentCustomers, currentProducts);

        const verbal = `Customer shop ${shopName} has been registered successfully with phone ${phone || 'on file'}.`;
        const localAiMsg = {
          role: 'assistant',
          verbal,
          text: `✅ **Customer Shop Registered Successfully**\n\n• **Shop Name:** ${shopName}\n• **Phone:** ${phone || 'N/A'}\n• **City/Address:** ${city || 'Default Location'}\n\nShop has been added to your store customer directory.`,
          visuals: {
            type: 'action_card',
            actionResult,
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 8: Employee "My Assigned Orders This Week"
      const isMyOrdersQuery = cleanLower.includes('my assigned orders') || cleanLower.includes('my orders this week') || (cleanLower.includes('my orders') && cleanLower.includes('week'));
      if (isMyOrdersQuery) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const myOrders = currentOrders.filter(o => {
          const isMine = o.createdBy === currentUser?.uid || o.employeeId === currentUser?.uid || o.createdByName === userProfile?.name;
          const isRecent = (o.createdAt || o.date || 0) >= weekStart.getTime();
          return isMine && isRecent;
        });
        const myTotal = myOrders.reduce((sum, o) => sum + (Number(o.grandTotal || o.total || 0)), 0);

        const verbal = `You have ${myOrders.length} assigned order${myOrders.length === 1 ? '' : 's'} this week totaling ${currency} ${myTotal.toLocaleString()}.`;
        const text = `📋 **Your Assigned Orders This Week**\n\n` +
          `• **Orders Booked:** ${myOrders.length} orders\n` +
          `• **Total Value:** ${currency} ${myTotal.toLocaleString()}\n\n` +
          (myOrders.length > 0
            ? myOrders.slice(0, 5).map(o => `• **#${o.orderNumber || o.id}**: ${o.customerName || 'Customer'} — ${currency} ${Number(o.grandTotal || 0).toLocaleString()}`).join('\n')
            : 'You have not booked any orders yet this week.');

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'metrics',
            cards: [
              { label: 'My Orders This Week', value: `${myOrders.length}`, sub: 'Booked' },
              { label: 'My Sales Revenue', value: `${currency} ${myTotal.toLocaleString()}`, sub: 'Total' }
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Handler 9: Registered Customer Shops Count & Directory
      const isCustomerDirectoryQuery = cleanLower.includes('customer shops') || cleanLower.includes('how many customer shops') || (cleanLower.includes('shops') && cleanLower.includes('directory'));
      if (isCustomerDirectoryQuery) {
        const count = currentCustomers.length;
        const verbal = `There are ${count} customer shops currently registered in your store directory.`;
        const text = `🏪 **Customer Shops Directory**\n\n` +
          `• **Total Registered Shops:** ${count} shops\n\n` +
          (count > 0
            ? `**Recent Shops:**\n` + currentCustomers.slice(0, 5).map(c => `• **${c.shopName || c.name || 'Shop'}**: Phone: ${c.phone || 'N/A'}, City: ${c.city || c.address || 'N/A'}`).join('\n')
            : 'No shops registered yet.');

        const localAiMsg = {
          role: 'assistant',
          verbal,
          text,
          cached: true,
          visuals: {
            type: 'metrics',
            cards: [
              { label: 'Registered Shops', value: `${count}`, sub: 'In Directory' }
            ]
          },
          timestamp: Date.now()
        };
        const finalMessages = [...newMessages, localAiMsg];
        setMessages(finalMessages);
        if (companyId && currentUser?.uid) {
          saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
        }
        if (!voiceMuted && localAiMsg.verbal) speakVoice(localAiMsg.verbal);
        setLoading(false);
        return;
      }

      // Format STORE ORDERS LEDGER (with order numbers, employee creator names, date, totals, items)
      const ordersLedgerText = currentOrders.slice(-30).reverse().map(o => {
        const d = o.createdAt ? new Date(o.createdAt) : new Date();
        const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localIsoDate = `${y}-${m}-${day}`;
        const rawItems = o.items ? (Array.isArray(o.items) ? o.items : Object.values(o.items)) : [];
        const itemsStr = rawItems.map(it => `${it.productName || 'Item'} x ${it.quantity || 1}`).join(', ') || 'N/A';
        const emp = o.createdByName || o.employeeName || 'Staff';
        return `- Order #${o.orderNumber || o.id} | Date: ${dStr} (${localIsoDate}) | Customer: "${o.customerName || 'N/A'}" | Employee/CreatedBy: "${emp}" | Mode: ${o.paymentType || 'Cash'} | Grand Total: ${currency} ${(Number(o.grandTotal) || 0).toLocaleString()} | Items: ${itemsStr}`;
      }).join('\n');

      const productsCatalogText = currentProducts.map(p => {
        const stock = p.currentStock ?? p.stockQuantity ?? p.quantity ?? 0;
        const sPrice = p.salePrice ?? p.price ?? 0;
        const cPrice = p.purchasePrice ?? p.costPrice ?? 0;
        return isAdmin
          ? `- Product: "${p.name || 'Item'}" | SKU: ${p.sku || 'N/A'} | Stock: ${stock} units | Sale Price: ${currency} ${sPrice.toLocaleString()} | Purchase Cost: ${currency} ${cPrice.toLocaleString()}`
          : `- Product: "${p.name || 'Item'}" | SKU: ${p.sku || 'N/A'} | Sale Price: ${currency} ${sPrice.toLocaleString()}`;
      }).join('\n');

      const customerShopsText = currentCustomers.map(c => {
        const bal = c.currentBalance ?? c.balance ?? c.dueAmount ?? 0;
        return isAdmin
          ? `- Shop: "${c.shopName || c.name || 'Shop'}" | Phone: ${c.phone || 'N/A'} | Address: ${c.address || c.city || 'N/A'} | Balance Due: ${currency} ${bal.toLocaleString()}`
          : `- Shop: "${c.shopName || c.name || 'Shop'}" | Phone: ${c.phone || 'N/A'} | Address: ${c.address || c.city || 'N/A'}`;
      }).join('\n');

      // Construct live context summary based strictly on role
      const contextSummary = isAdmin ? `
SHOP CONTEXT (ADMIN ACCESS):
- Company Name: ${companyInfo?.name || 'LAMBA Store'}
- User Role: Administrator (${userProfile?.name || 'Admin'})
- Currency: ${currency}
- Total Products in Catalog: ${currentProducts.length}
- Today's Store Orders: ${todayOrders.length} orders totaling ${currency} ${todaySalesTotal.toLocaleString()}
- Total Registered Customers: ${currentCustomers.length}

WEEKLY & MONTHLY SALES VELOCITY:
- Weekly Sales: ${currency} ${auditData.thisWeekSales.toLocaleString()} (${auditData.weekSalesDiffPct >= 0 ? `+${auditData.weekSalesDiffPct}%` : `${auditData.weekSalesDiffPct}%`} vs prev week)
- Monthly Sales: ${currency} ${auditData.curMonthSales.toLocaleString()} (${auditData.monthSalesDiffPct >= 0 ? `+${auditData.monthSalesDiffPct}%` : `${auditData.monthSalesDiffPct}%`} vs prev month)

TEAM MEMBER ORDER COUNTS & PERFORMANCE (WEEKLY COMPARISON):
${auditData.teamAnalysis.map(t => `- ${t.name}: ${t.thisWeekOrders} orders this week (vs ${t.prevWeekOrders} last week, change: ${t.orderDiffPct >= 0 ? `+${t.orderDiffPct}%` : `${t.orderDiffPct}%`})`).join('\n') || 'None'}

HIGH GAP & SYSTEM ANOMALY ALERTS:
${auditData.auditAlerts.map(a => `- [${a.category}] ${a.title}: ${a.desc} (Action: ${a.recommendation})`).join('\n') || 'None - systems operating normally.'}

EXACT FINANCIAL LEDGER (MATCHES DASHBOARD 100%):
- Outstanding Accounts Payable (Owed to Suppliers): ${currency} ${outstandingPayable.toLocaleString()}
- Total Purchases: ${currency} ${totalPurchases.toLocaleString()}
- Supplier Payments Made: ${currency} ${supplierPaymentsMade.toLocaleString()}
- Total Customer Credit Left (Owed by Customers to Store): ${currency} ${totalCustomerCreditLeft.toLocaleString()}
- Total Store Sales: ${currency} ${totalSalesAll.toLocaleString()}
- Total Cost of Products Sold (COGS): ${currency} ${totalCogs.toLocaleString()}
- Total Overhead Expenses: ${currency} ${totalExpenses.toLocaleString()}
- Net Profit: ${currency} ${netProfit.toLocaleString()}

COMPLETE STORE ORDERS LEDGER (RECENT ORDERS & EMPLOYEES):
${ordersLedgerText || 'No orders placed yet.'}

COMPLETE PRODUCT CATALOG (EVERY REGISTERED ITEM & ITS CURRENT STOCK):
${productsCatalogText || 'No products registered yet.'}

LOW STOCK ALERTS (< 10 units):
${freshLowStock.slice(0, 8).map(p => `- ${p.name || 'Item'} (Stock: ${p.stockQuantity ?? p.currentStock ?? p.quantity ?? 0}, Price: ${currency} ${p.salePrice ?? p.price ?? 0})`).join('\n') || 'None'}

CUSTOMERS WITH UNPAID BALANCES (DEBTORS):
${freshTopDebtors.slice(0, 8).map(c => `- ${c.shopName || c.name || 'Customer'} (Due: ${currency} ${(c.currentBalance ?? c.balance ?? 0).toLocaleString()}, Phone: ${c.phone || 'N/A'})`).join('\n') || 'None'}

REGISTERED CUSTOMER SHOPS:
${customerShopsText || 'None'}
` : `
SHOP CONTEXT (EMPLOYEE ACCESS - RESTRICTED):
- Company Name: ${companyInfo?.name || 'LAMBA Store'}
- User Role: Employee (${userProfile?.name || 'Staff'})
- Currency: ${currency}
- Employee's Assigned Orders Today: ${todayOrders.length} orders totaling ${currency} ${todaySalesTotal.toLocaleString()}
- Total Registered Customer Shops: ${currentCustomers.length}

EMPLOYEE'S ACCESSIBLE ORDERS:
${ordersLedgerText || 'No orders placed yet.'}

ACCESSIBLE PRODUCT CATALOG (NAMES & SELLING PRICES):
${productsCatalogText || 'No products available.'}

REGISTERED CUSTOMER SHOPS:
${customerShopsText || 'None'}

RESTRICTION NOTICE: Employee CANNOT see low stock counts, warehouse inventory costs, total company net profit, accounts payable, or debtor ledgers.
`;

      const systemPrompt = `
You are "LAMBA AI", an ultra-efficient, professional female business assistant for shop owners and staff.

STRICT MANDATORY RULES:
1. ALWAYS reply strictly and exclusively in ENGLISH. Both the "verbal" speech text and "text" markdown MUST be 100% in professional English, even if the user prompts in Roman Urdu, Urdu, Hindi, or any other language.
2. Only answer system-related queries (orders, customer shops, products, sales, finances, invoices). Reject off-topic banter.
3. FINANCIAL & OUTSTANDING PAYABLE INQUIRIES (Admin only):
   - When user asks about "outstanding payable", "accounts payable", "supplier payable", "purchases", or "payments made":
     Quote the EXACT numbers from EXACT FINANCIAL LEDGER:
     Outstanding Payable: ${currency} ${outstandingPayable.toLocaleString()}
     Total Purchases: ${currency} ${totalPurchases.toLocaleString()}
     Payments Made: ${currency} ${supplierPaymentsMade.toLocaleString()}
     Always return visual cards in "cards" summarizing these exact figures.
4. CUSTOMER CREDIT LEFT & DEBTORS (Admin only):
   - When user asks about "credit left", "total credit", "customer credit", or "who owes money / debtors":
     Quote the EXACT Total Customer Credit Left: ${currency} ${totalCustomerCreditLeft.toLocaleString()}.
     List the customers with pending balances.
5. EMPLOYEE ORDERS & ORDER QUERIES:
   - When user asks about orders by a specific employee, search the COMPLETE STORE ORDERS LEDGER by the employee name.
6. GENERATE & DOWNLOAD INVOICES (PDF ACTION):
   - When the user asks to generate or download invoices, return action type "download_invoices".
7. PRODUCT SEARCH & STOCK INQUIRIES:
   - Search the COMPLETE PRODUCT CATALOG case-insensitively.
8. If user wants to ADD or CREATE an item, output action:
   - For customer: "action": { "type": "add_customer", "shopName": "...", "phone": "...", "address": "...", "city": "..." }
   - For product (Admin): "action": { "type": "add_product", "name": "...", "salePrice": 500, "costPrice": 350, "stock": 20 }
   - For order: "action": { "type": "create_order", "customerName": "...", "paymentType": "cash" | "credit", "items": [{ "name": "...", "quantity": 1, "price": 500 }] }
9. If an employee asks for stock alerts or secret financial data, refuse politely stating they do not have permission.
10. Return JSON ONLY with schema: { "verbal": "...", "text": "...", "visualType": "...", "action": {...}, "cards": [...] }
`;

      const callGroq = async (modelName) => {
        if (!GROQ_API_KEY) {
          throw new Error('Groq AI API key is not configured.');
        }
        return await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: 'You are LAMBA AI. Respond strictly in json format.\n' + systemPrompt + '\n' + contextSummary },
              ...newMessages.slice(-4).map((m, idx, arr) => ({
                role: m.role,
                content: (idx === arr.length - 1 && m.role === 'user') ? `${m.text} (respond in json)` : m.text
              }))
            ],
            max_tokens: 800,
          })
        });
      };

      let response = null;
      let lastErr = null;

      try {
        response = await callGroq('llama-3.3-70b-versatile');
        if (!response.ok) {
          throw new Error(`Groq Primary returned ${response.status}`);
        }
      } catch (err) {
        lastErr = err;
        try {
          response = await callGroq('llama-3.1-8b-instant');
          if (!response.ok) {
            throw new Error(`Groq Fallback returned ${response.status}`);
          }
        } catch (fbErr) {
          lastErr = fbErr;
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErr?.message || 'AI service temporarily unavailable.');
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';

      let parsed = {};
      try {
        let clean = content.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) clean = match[0];
        parsed = JSON.parse(clean);
      } catch (e) {
        console.warn('JSON parse fallback:', e, content);
        parsed = {
          verbal: "Here is the information from your store.",
          text: content,
          visualType: "general"
        };
      }

      // Execute action if requested by AI with full live context
      let actionResult = null;
      if (parsed.action && parsed.action.type && parsed.action.type !== 'none') {
        actionResult = await executeAiAction(parsed.action, currentOrders, currentCustomers, currentProducts);
      }

      const aiMsg = {
        role: 'assistant',
        verbal: actionResult?.details || parsed.verbal || parsed.text?.slice(0, 120),
        text: actionResult
          ? (actionResult.type === 'action_warning'
              ? `${parsed.text ? parsed.text + '\n\n' : ''}⚠️ **${actionResult.title}**\n\n${actionResult.details}`
              : `${parsed.text ? parsed.text + '\n\n' : ''}✅ **${actionResult.title}**\n\n${actionResult.details}`)
          : (parsed.text || parsed.verbal),
        visuals: {
          type: actionResult ? 'action_card' : (parsed.visualType || 'general'),
          actionResult: actionResult || null,
          cards: parsed.cards || null,
          tableItems: isAdmin ? (parsed.tableItems || null) : null,
          debtors: isAdmin ? (parsed.debtors || null) : null,
        },
        timestamp: Date.now()
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);

      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, finalMessages, null);
      }

      if (!actionResult && parsed.text && parsed.text.length > 8) {
        setCachedQueryAnswer(companyId, currentUser?.uid, text, {
          text: parsed.text,
          verbal: parsed.verbal,
          cards: parsed.cards || null,
          visualType: parsed.visualType || 'general',
        });
      }

      if (!voiceMuted && aiMsg.verbal) {
        speakVoice(aiMsg.verbal);
      }

    } catch (err) {
      console.warn('AI engine notice (providing live store metrics):', err);
      const curr = companyInfo?.currency || 'Rs.';

      let fallbackText = '';
      let fallbackVerbal = '';
      let fallbackVisuals = null;

      if (cleanLower.includes('product') || cleanLower.includes('item') || cleanLower.includes('price')) {
        const matchingProds = (shopContext.products || []).filter(p => cleanLower.includes((p.name || '').toLowerCase()));
        if (matchingProds.length > 0) {
          fallbackText = `📦 **Product Information**\n\n` +
            matchingProds.map(p => `• **${p.name}**: Sale Price ${curr} ${(p.salePrice ?? p.price ?? 0).toLocaleString()}, Stock: ${p.stockQuantity ?? p.currentStock ?? 0} units`).join('\n');
          fallbackVerbal = `Found ${matchingProds.length} product matching your request.`;
        } else {
          fallbackText = `📦 **Product Catalog Status**\n\nYou currently have ${shopContext.products.length} registered product(s) in catalog.`;
          fallbackVerbal = `You have ${shopContext.products.length} products registered in your catalog.`;
        }
      } else if (cleanLower.includes('customer') || cleanLower.includes('shop') || cleanLower.includes('debt')) {
        fallbackText = `🏪 **Customer Shops Overview**\n\n` +
          `• **Total Registered Shops:** ${shopContext.customers.length}\n` +
          (isAdmin ? `• **Debtors:** ${shopContext.topDebtors.length} shop(s) with pending balances` : '');
        fallbackVerbal = `Your store has ${shopContext.customers.length} registered customer shops.`;
      } else {
        fallbackText = `📊 **Live Store Overview**\n\n` +
          `• **Today's Bookings:** ${shopContext.todayOrdersCount || 0} order(s) totaling ${curr} ${(shopContext.todaySales || 0).toLocaleString()}\n` +
          `• **Products:** ${shopContext.products.length} registered item(s) (${shopContext.lowStock.length} low stock)\n` +
          `• **Customers:** ${shopContext.customers.length} shop(s) registered in directory\n` +
          (isAdmin && shopContext.topDebtors.length > 0 ? `• **Pending Debtors:** ${shopContext.topDebtors.length} shop(s) with unpaid balances` : '');
        fallbackVerbal = `Here is your current store status. Today you have ${shopContext.todayOrdersCount || 0} orders totaling ${curr} ${(shopContext.todaySales || 0).toLocaleString()}.`;
        fallbackVisuals = {
          type: 'metrics',
          cards: [
            { label: "Today's Sales", value: `${curr} ${(shopContext.todaySales || 0).toLocaleString()}`, sub: `${shopContext.todayOrdersCount || 0} orders` },
            { label: "Products", value: `${shopContext.products.length}`, sub: `${shopContext.lowStock.length} low stock` },
          ]
        };
      }

      const fallbackMsg = {
        role: 'assistant',
        verbal: fallbackVerbal,
        text: fallbackText,
        visuals: fallbackVisuals,
        timestamp: Date.now()
      };
      const finalFallback = [...newMessages, fallbackMsg];
      setMessages(finalFallback);
      if (companyId && currentUser?.uid) {
        saveConversationHistory(companyId, currentUser.uid, finalFallback, null);
      }
      if (!voiceMuted && fallbackMsg.verbal) speakVoice(fallbackMsg.verbal);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (phone, msg) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const encoded = encodeURIComponent(msg || 'Assalam-o-Alaikum, reminder regarding your pending balance.');
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  return (
    <>
      {/* Floating AI Orb Button (Bottom-Right) */}
      <div className="lamba-ai-trigger-wrap">
        {!isOpen && (
          <button
            className="lamba-ai-trigger-btn"
            onClick={() => setIsOpen(true)}
            aria-label="Open LAMBA AI Voice Assistant"
            title="Open LAMBA AI Assistant"
          >
            <span className="lamba-ai-status-dot" />
            <div className="lamba-ai-logo-badge">
              <img src="/lambalogo.png" alt="LAMBA AI" className="lamba-ai-trigger-logo" />
            </div>
            <span className="lamba-ai-trigger-text">Ask LAMBA AI</span>
            <Mic size={16} className="lamba-ai-trigger-mic" />
          </button>
        )}
      </div>

      {/* Slide-Up Voice Assistant Panel */}
      {isOpen && (
        <div
          className="lamba-ai-panel"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 450,
            maxWidth: 'calc(100vw - 32px)',
            height: 640,
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 24,
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.25s ease-out',
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                padding: 4,
                flexShrink: 0,
              }}>
                <img src="/lambalogo.png" alt="LAMBA AI" style={{ width: 26, height: 26, objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  LAMBA AI Voice Agent
                </div>
                <div style={{ fontSize: 11, color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                  {isAdmin ? 'Admin Mode (Full Access)' : 'Employee Mode (Order & Shop Access)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => runSystemAudit()}
                title="Run Real-Time Executive System Audit"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: 8,
                  padding: 7,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={16} />
              </button>

              <button
                onClick={handleClearMemory}
                title="Reset Conversation Memory & History"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: 8,
                  padding: 7,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCcw size={16} />
              </button>

              <button
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                title="Voice Clarity & Voice Selection Settings"
                style={{
                  background: showVoiceSettings ? '#4f46e5' : 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: 8,
                  padding: 7,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings2 size={16} />
              </button>

              <button
                onClick={() => {
                  if (!voiceMuted) stopVoice();
                  setVoiceMuted(!voiceMuted);
                }}
                title={voiceMuted ? "Unmute Voice" : "Mute Voice"}
                style={{
                  background: voiceMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: 8,
                  padding: 7,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {voiceMuted ? <VolumeX size={16} color="#fca5a5" /> : <Volume2 size={16} />}
              </button>

              <button
                onClick={() => {
                  stopVoice();
                  setIsOpen(false);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: 8,
                  padding: 7,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Voice Clarity & Selection Settings Bar */}
          {showVoiceSettings && (
            <div style={{
              background: '#1e1b4b',
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 12,
              color: '#ffffff',
              animation: 'fadeIn 0.15s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: '#c7d2fe', whiteSpace: 'nowrap' }}>AI Voice:</span>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => {
                    setSelectedVoiceName(e.target.value);
                    localStorage.setItem('lamba_preferred_voice', e.target.value);
                  }}
                  style={{
                    background: '#312e81',
                    color: '#ffffff',
                    border: '1px solid #4f46e5',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 12,
                    outline: 'none',
                    flex: 1,
                    maxWidth: 220,
                  }}
                >
                  {availableVoices.map((v, idx) => (
                    <option key={idx} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => testCurrentVoice(selectedVoiceName)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 10px',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <Play size={12} /> Test Voice
              </button>
            </div>
          )}

          {/* Quick Action Chips Bar (Role-Based) */}
          <div className="lamba-ai-chips-bar" style={{
            padding: '8px 14px',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}>
            {isAdmin ? [
              { label: '🔍 System Audit', action: () => runSystemAudit() },
              { label: '📄 Invoices', q: 'Create invoices' },
              { label: '👥 Team vs Last Week', q: 'Compare team member orders with last week and highlight drops.' },
              { label: '📈 Sales Trends', q: 'How do our sales this week compare to last week and last month?' },
              { label: '⚠️ Low Stock', q: 'Which products are low on stock and need restocking?' },
              { label: '💳 Credit Left', q: 'What is total customer credit left and who owes money?' },
              { label: '📦 Outstanding Payable', q: 'What is my total outstanding payable to suppliers?' },
              { label: '➕ Add Shop', q: 'Add a new customer shop named New Horizon Mart with phone 03001234567 in Lahore.' },
            ].map((chip, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => chip.action ? chip.action() : handleSendMessage(chip.q)}
                className="lamba-ai-chip-btn"
                style={{
                  borderRadius: 16,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {chip.label}
              </button>
            )) : [
              { label: '🔍 My Performance', action: () => runSystemAudit() },
              { label: '📋 My Orders This Week', q: 'Show my assigned orders this week.' },
              { label: '🏪 Customer Shops', q: 'How many customer shops are registered in our directory?' },
              { label: '➕ Add Customer', q: 'Add a new customer shop named Royal Traders with phone 03129876543.' },
            ].map((chip, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => chip.action ? chip.action() : handleSendMessage(chip.q)}
                className="lamba-ai-chip-btn"
                style={{
                  borderRadius: 16,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="lamba-ai-messages-area" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    className={isUser ? 'lamba-ai-bubble-user' : 'lamba-ai-bubble-assistant'}
                    style={{
                      maxWidth: '88%',
                      padding: '12px 16px',
                      borderRadius: 16,
                      fontSize: 13,
                      lineHeight: 1.5,
                      borderBottomRightRadius: isUser ? 4 : 16,
                      borderBottomLeftRadius: !isUser ? 4 : 16,
                    }}
                  >
                    {!isUser && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: '1px solid rgba(99, 102, 241, 0.12)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {m.cached ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 7px',
                              borderRadius: 10,
                              background: '#ecfdf5',
                              color: '#059669',
                              fontSize: 10,
                              fontWeight: 800
                            }}>
                              <Zap size={10} fill="#059669" /> Instant Answer (0 Tokens)
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>
                              LAMBA AI
                            </span>
                          )}
                        </div>

                        {/* Audio Listen Button with 1-click User Gesture Playback */}
                        <button
                          onClick={() => {
                            if (isSpeaking) {
                              stopVoice();
                            } else {
                              speakVoice(m.verbal || m.text);
                            }
                          }}
                          title={isSpeaking ? "Pause Audio" : "Play Voice"}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: isSpeaking ? '#fee2e2' : '#f5f3ff',
                            border: isSpeaking ? '1px solid #fecaca' : '1px solid #ddd6fe',
                            color: isSpeaking ? '#dc2626' : '#6366f1',
                            borderRadius: 12,
                            padding: '2px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                          <span>{isSpeaking ? 'Pause' : '🔊 Listen Voice'}</span>
                        </button>
                      </div>
                    )}

                    {/* Prominent Audio Briefing Banner on System Audit */}
                    {!isUser && m.visuals?.type === 'audit_briefing' && (
                      <div
                        onClick={() => {
                          if (isSpeaking) {
                            stopVoice();
                          } else {
                            speakVoice(m.verbal || m.text);
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          background: isSpeaking ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                          border: isSpeaking ? '1px solid #fca5a5' : '1px solid #c7d2fe',
                          borderRadius: 12,
                          padding: '9px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 10,
                          boxShadow: isSpeaking ? '0 0 12px rgba(239, 68, 68, 0.25)' : '0 2px 8px rgba(99, 102, 241, 0.15)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isSpeaking ? (
                            <Volume2 size={18} color="#dc2626" />
                          ) : (
                            <Play size={18} color="#4f46e5" fill="#4f46e5" />
                          )}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: isSpeaking ? '#991b1b' : '#3730a3' }}>
                              {isSpeaking ? 'Speaking Executive Briefing...' : '🔊 Tap to Listen to Executive Briefing'}
                            </div>
                            <div style={{ fontSize: 10, color: isSpeaking ? '#b91c1c' : '#6366f1' }}>
                              {isSpeaking ? 'Click to stop voice' : 'Audio overview of sales, team orders & stocks'}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: isSpeaking ? '#dc2626' : '#4f46e5',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {isSpeaking ? 'Stop' : 'Play Voice'}
                        </span>
                      </div>
                    )}

                    {renderFormattedMessage(m.text)}

                    {/* Action Execution Success Card */}
                    {m.visuals?.actionResult && (
                      <div style={{
                        marginTop: 10,
                        background: m.visuals.actionResult.type === 'download_success' ? '#eff6ff' : '#f0fdf4',
                        border: m.visuals.actionResult.type === 'download_success' ? '1px solid #bfdbfe' : '1px solid #86efac',
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {m.visuals.actionResult.type === 'download_success' ? (
                            <FileText size={20} color="#2563eb" />
                          ) : (
                            <CheckCircle2 size={18} color="#16a34a" />
                          )}
                          <div style={{
                            fontSize: 12,
                            color: m.visuals.actionResult.type === 'download_success' ? '#1e40af' : '#166534',
                            fontWeight: 800
                          }}>
                            {m.visuals.actionResult.title || 'Action Executed in Database Successfully'}
                          </div>
                        </div>

                        {m.visuals.actionResult.type === 'download_success' && m.visuals.actionResult.orders && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <button
                              onClick={async () => {
                                const compName = companyInfo?.name || 'LAMBA Store';
                                const curr = companyInfo?.currency || 'Rs.';
                                if (m.visuals.actionResult.orders.length === 1) {
                                  await exportOrderInvoiceToPDF(m.visuals.actionResult.orders[0], compName, curr);
                                } else {
                                  await exportMultipleInvoicesToPDF(m.visuals.actionResult.orders, compName, curr);
                                }
                                toast.success('Re-downloaded Invoice PDF!');
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                              }}
                            >
                              <Download size={13} /> Re-download PDF ({m.visuals.actionResult.orders.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Permission Denied Card */}
                    {m.visuals?.type === 'permission_denied' && (
                      <div style={{
                        marginTop: 10,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 10,
                        padding: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <Lock size={18} color="#dc2626" />
                        <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>
                          Access Restricted to Administrators
                        </div>
                      </div>
                    )}

                    {/* Visual Metric Cards */}
                    {m.visuals?.cards && m.visuals.cards.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 12 }}>
                        {m.visuals.cards.map((c, idx) => (
                          <div key={idx} style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: 10,
                            padding: 10,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{c.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#15803d', marginTop: 2 }}>{c.value}</div>
                            {c.sub && <div style={{ fontSize: 10, color: '#4ade80' }}>{c.sub}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Low Stock List (Admin only) */}
                    {isAdmin && m.visuals?.tableItems && m.visuals.tableItems.length > 0 && (
                      <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#c2410c', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={13} /> Restock Recommended:
                        </div>
                        {m.visuals.tableItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: idx < m.visuals.tableItems.length - 1 ? '1px dashed #fed7aa' : 'none' }}>
                            <span style={{ fontWeight: 700, color: '#7c2d12' }}>{item.name}</span>
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 6, fontWeight: 800, fontSize: 10 }}>
                              Stock: {item.stock} left
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Customer Debtors List (Admin only) */}
                    {isAdmin && m.visuals?.debtors && m.visuals.debtors.length > 0 && (
                      <div style={{ marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={13} /> Unpaid Customer Ledgers:
                        </div>
                        {m.visuals.debtors.map((d, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: idx < m.visuals.debtors.length - 1 ? '1px dashed #bfdbfe' : 'none' }}>
                            <div>
                              <div style={{ fontWeight: 800, color: '#1e3a8a' }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Due: Rs. {Number(d.amount).toLocaleString()}</div>
                            </div>
                            {d.phone ? (
                              <button
                                onClick={() => openWhatsApp(d.phone, d.whatsappMsg)}
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '4px 8px',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <MessageCircle size={11} /> WhatsApp
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', fontSize: 12, fontWeight: 700, padding: 8 }}>
                <Sparkles size={16} className="animate-spin" /> Processing store operation in English...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Wave Animation */}
          {(isListening || isSpeaking) && (
            <div style={{
              background: isListening ? '#fef2f2' : '#f5f3ff',
              borderTop: isListening ? '1px solid #fecaca' : '1px solid #ddd6fe',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 700,
              color: isListening ? '#dc2626' : '#7c3aed',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isListening ? '#dc2626' : '#7c3aed',
                  boxShadow: isListening ? '0 0 8px #dc2626' : '0 0 8px #7c3aed',
                }} />
                {isListening ? 'Listening to your voice... Speak now' : 'AI is speaking...'}
              </div>

              {isSpeaking && (
                <button
                  onClick={stopVoice}
                  style={{
                    background: '#e0e7ff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#4338ca',
                    cursor: 'pointer',
                  }}
                >
                  Stop Voice
                </button>
              )}
            </div>
          )}

          {/* Bottom Input Area */}
          <div className="lamba-ai-bottom-bar" style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {/* Big Mic Button - Solid Color No Gradient */}
            <button
              onClick={toggleListening}
              title={isListening ? "Stop Listening" : "Speak to AI"}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: isListening ? '#ef4444' : '#7c3aed',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isListening
                  ? '0 0 16px rgba(239, 68, 68, 0.6)'
                  : '0 4px 12px rgba(124, 58, 237, 0.35)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Query Input */}
            <input
              type="text"
              placeholder={isAdmin ? "e.g. Add customer Royal Mart or create order..." : "e.g. View my orders or add customer shop..."}
              value={queryInput}
              disabled={loading}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              className="lamba-ai-input-field"
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 24,
                fontSize: 13,
                outline: 'none',
              }}
            />

            {/* Send Button */}
            <button
              disabled={!queryInput.trim() || loading}
              onClick={() => handleSendMessage()}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                background: (!queryInput.trim() || loading) ? '#e2e8f0' : '#2563eb',
                color: (!queryInput.trim() || loading) ? '#94a3b8' : '#ffffff',
                cursor: (!queryInput.trim() || loading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
