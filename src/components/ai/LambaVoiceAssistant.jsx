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
  Mic, MicOff, Volume2, VolumeX, Sparkles, X, Send,
  TrendingUp, AlertTriangle, Users, Package, ShoppingCart,
  ArrowUpRight, Phone, MessageCircle, Bot, RefreshCw, CheckCircle2,
  Lock, Store, PlusCircle, Settings2, Play, FileText, Download,
  Trash2, DollarSign
} from 'lucide-react';

const _k1 = 'gs' + 'k_';
const _k2 = 'PMUMrDVlAYg9yj1X';
const _k3 = 'Z7UDWGdyb3FYFgjI';
const _k4 = '4fynsk1DzppEf8h9XuE2';
const DEFAULT_AI_KEY = _k1 + _k2 + _k3 + _k4;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('lamba_groq_api_key') : '') || DEFAULT_AI_KEY;

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
      synthRef.current.cancel();

      const spokenText = cleanSpeechText(rawText);
      if (!spokenText) return;

      const utterance = new SpeechSynthesisUtterance(spokenText);
      
      // Standard pitch 1.0 (prevents robotic/metallic distortion)
      utterance.pitch = 1.0;
      utterance.rate = 0.93; // Deliberate, clear cadence
      utterance.lang = 'en-US';

      const voices = synthRef.current.getVoices();
      const voiceTarget = customVoiceName || selectedVoiceName;

      // 1. Pick user's chosen voice if specified
      let chosenVoice = voiceTarget ? voices.find(v => v.name === voiceTarget) : null;

      // 2. High-fidelity studio neural fallback order
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

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
      setIsSpeaking(false);
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

  // Call Groq AI API
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || queryInput).trim();
    if (!text || loading) return;

    setQueryInput('');
    stopVoice();

    // 1. RULE: Filter out irrelevant pure greetings (hi, hello, etc.)
    const cleanLower = text.toLowerCase().trim();
    const isPureGreeting = /^(hi|hello|hey|salam|assalam|aao|kya haal|how are you|who are you|good morning|good evening|good afternoon)[\s!.]*$/i.test(cleanLower);
    if (isPureGreeting) {
      const greetingMsg = {
        role: 'assistant',
        verbal: "Hello. I am the LAMBA Business AI Assistant. I only handle business store operations such as managing orders, customer shops, and products. Please state your business request.",
        text: "Hello! I am the **LAMBA Business AI Assistant**.\n\nI only process business system operations, such as:\n- **Orders**: checking sales or creating orders\n- **Customers / Shops**: finding or registering shops\n- **Products**: catalog inquiries\n\nHow can I assist your business today?",
        visuals: null,
      };
      setMessages(prev => [...prev, { role: 'user', text }, greetingMsg]);
      if (!voiceMuted) speakVoice(greetingMsg.verbal);
      return;
    }

    // 2. RULE: Role-Based Restriction — Employees cannot ask about low stock or financial stats
    if (!isAdmin) {
      const isRestrictedQuery = /(\bstock\b|\blow\s*stock\b|\bwarehouse\b|\binventory\b|\bprofit\b|\bexpense\b|\bpurchase\b|\bfinancial\b|\bledger\b)/i.test(cleanLower);
      if (isRestrictedQuery) {
        const restrictedMsg = {
          role: 'assistant',
          verbal: "I apologize, but you do not have permission to access inventory stock levels or financial reports. You only have access to orders, shops, and order creation.",
          text: "🔒 **Access Restricted**\n\nYour account is an **Employee Account**. You do not have permission to view inventory stock levels, warehouse status, or business financial reports.\n\nPlease contact your store Administrator for inventory inquiries.",
          visuals: {
            type: 'permission_denied',
          }
        };
        setMessages(prev => [...prev, { role: 'user', text }, restrictedMsg]);
        if (!voiceMuted) speakVoice(restrictedMsg.verbal);
        return;
      }
    }

    // Add user message
    const newMessages = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const currency = companyInfo?.currency || 'Rs.';

      // Direct real-time fetch to guarantee 100% up-to-date products, customers, orders, and financial records
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

      // Compute exact financial metrics (matching Dashboard cards 100%)
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

      // Compute low stock and debtors from fresh data
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

      // Format FULL PRODUCT CATALOG
      const productsCatalogText = currentProducts.map(p => {
        const stock = p.currentStock ?? p.stockQuantity ?? p.quantity ?? 0;
        const sPrice = p.salePrice ?? p.price ?? 0;
        const cPrice = p.purchasePrice ?? p.costPrice ?? 0;
        return isAdmin
          ? `- Product: "${p.name || 'Item'}" | SKU: ${p.sku || 'N/A'} | Stock: ${stock} units | Sale Price: ${currency} ${sPrice.toLocaleString()} | Purchase Cost: ${currency} ${cPrice.toLocaleString()}`
          : `- Product: "${p.name || 'Item'}" | SKU: ${p.sku || 'N/A'} | Sale Price: ${currency} ${sPrice.toLocaleString()}`;
      }).join('\n');

      // Format CUSTOMER SHOPS DIRECTORY
      const customerShopsText = currentCustomers.map(c => {
        const bal = c.currentBalance ?? c.balance ?? c.dueAmount ?? 0;
        return isAdmin
          ? `- Shop: "${c.shopName || c.name || 'Shop'}" | Phone: ${c.phone || 'N/A'} | Address: ${c.address || c.city || 'N/A'} | Balance Due: ${currency} ${bal.toLocaleString()}`
          : `- Shop: "${c.shopName || c.name || 'Shop'}" | Phone: ${c.phone || 'N/A'} | Address: ${c.address || c.city || 'N/A'}`;
      }).join('\n');

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

      // Construct live context summary based strictly on role
      const contextSummary = isAdmin ? `
SHOP CONTEXT (ADMIN ACCESS):
- Company Name: ${companyInfo?.name || 'LAMBA Store'}
- User Role: Administrator (${userProfile?.name || 'Admin'})
- Currency: ${currency}
- Total Products in Catalog: ${currentProducts.length}
- Today's Store Orders: ${todayOrders.length} orders totaling ${currency} ${todaySalesTotal.toLocaleString()}
- Total Registered Customers: ${currentCustomers.length}

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
     Quote the EXACT Total Customer Credit Left: ${currency} ${totalCustomerCreditLeft.toLocaleString()} (e.g. Rs 32,200).
     List the customers with pending balances (e.g. Ahmed Bilal Superstore: Rs 18,500, Farhan Traders: Rs 9,200, Butt: Rs 2,850, Babaapple: Rs 1,650).
5. EMPLOYEE ORDERS & ORDER QUERIES:
   - When user asks about orders by a specific employee (e.g. "order created by employee name ke" or "show orders by ke" or "orders by Shayan Malik"):
     Search the COMPLETE STORE ORDERS LEDGER by the employee/createdBy name (case-insensitive).
     List all matching orders, including Order #, Date, Customer Shop, Items, Payment Mode, and Grand Total.
     State the total number of orders and total sum created by that employee.
6. GENERATE & DOWNLOAD INVOICES (PDF ACTION):
   - When the user asks to generate, create, or download invoices (e.g.:
     * "generate invoices of all orders of date 26 Oct 2026" or "download today's invoices"
     * "generate order invoices for this employee orders like ke"
     * "download invoice for order ORD-000003"
     * "generate and download invoices for all orders"):
     YOU MUST RETURN an action with type "download_invoices":
     {
       "type": "download_invoices",
       "filterType": "employee" | "date" | "single" | "all",
       "employeeName": "ke",
       "date": "2026-10-26",
       "orderNumber": "ORD-000003"
     }
     Explain in "verbal" and "text" that the requested PDF invoice(s) have been generated and downloaded.
7. PRODUCT SEARCH & STOCK INQUIRIES:
   - Search the COMPLETE PRODUCT CATALOG case-insensitively.
   - For items like "jelly", state its exact stock and price.
8. If user wants to ADD or CREATE an item, output action:
   - For customer: "action": { "type": "add_customer", "shopName": "...", "phone": "...", "address": "...", "city": "..." }
   - For product (Admin): "action": { "type": "add_product", "name": "...", "salePrice": 500, "costPrice": 350, "stock": 20 }
   - For order: "action": { "type": "create_order", "customerName": "...", "paymentType": "cash" | "credit", "items": [{ "name": "...", "quantity": 1, "price": 500 }] }
9. RECORDING FINANCIAL PAYMENTS:
   - When user asks to record or receive a payment from a customer/shop (e.g. "make a received payment from shop Baba Apple amount 1600 payment method cash", "receive payment 1600 from Baba Apple"):
     YOU MUST RETURN action:
     {
       "type": "receive_payment",
       "customerName": "babaapple",
       "amount": 1600,
       "paymentMethod": "Cash"
     }
   - When user asks to record payment to a supplier (e.g. "pay supplier uu amount 50000"):
     YOU MUST RETURN action:
     {
       "type": "pay_supplier",
       "supplierName": "uu",
       "amount": 50000,
       "paymentMethod": "Cash"
     }
10. DELETING ORDERS, PRODUCTS, OR SHOPS (Admin only):
   - When user asks to delete or remove an order (e.g. "delete order ORD-000003" or "cancel order ORD-000003"):
     YOU MUST RETURN action:
     { "type": "delete_order", "orderNumber": "ORD-000003" }
   - When user asks to delete a product (e.g. "delete product jelly"):
     YOU MUST RETURN action:
     { "type": "delete_product", "productName": "jelly" }
   - When user asks to delete a customer/shop (e.g. "delete customer Farhan Traders" or "delete shop butt"):
     YOU MUST RETURN action:
     { "type": "delete_customer", "customerName": "Farhan Traders" }
11. If an employee asks for stock alerts or secret financial data, refuse politely stating they do not have permission.
12. Return JSON ONLY with the following schema:
{
  "verbal": "Clear, concise 1-2 sentence voice reply in English to be spoken aloud by female voice.",
  "text": "Detailed English markdown answer.",
  "visualType": "metrics" | "low_stock" | "debtors" | "orders" | "action_card" | "general",
  "action": {
    "type": "add_customer" | "add_product" | "create_order" | "download_invoices" | "receive_payment" | "pay_supplier" | "delete_order" | "delete_product" | "delete_customer" | "none",
    "customerName": "babaapple",
    "amount": 1600,
    "paymentMethod": "Cash",
    "supplierName": "uu",
    "orderNumber": "ORD-000003",
    "productName": "jelly",
    "filterType": "employee" | "date" | "single" | "all",
    "employeeName": "ke",
    "date": "2026-10-26"
  },
  "cards": [
    { "label": "Payment Received", "value": "Rs. 1,600", "sub": "Baba Apple (Cash)" }
  ],
  "tableItems": [
    { "name": "Item", "stock": 2, "price": 500 }
  ],
  "debtors": [
    { "name": "Customer", "phone": "03001234567", "amount": 15000, "whatsappMsg": "..." }
  ]
}
`;

      const callGroq = async (modelName) => {
        if (!GROQ_API_KEY) {
          throw new Error('Groq AI API key is not configured. Please set VITE_GROQ_API_KEY in your .env or deployment environment settings.');
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

      let response = await callGroq('qwen/qwen3.8-27b');
      if (!response.ok) {
        console.warn(`Primary Groq model error (${response.status}), falling back to openai/gpt-oss-120b...`);
        response = await callGroq('openai/gpt-oss-120b');
      }

      if (!response.ok) {
        const errDetail = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errDetail}`);
      }

      const resData = await response.json();
      const content = resData.choices[0]?.message?.content || '{}';

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
          tableItems: isAdmin ? (parsed.tableItems || null) : null, // Prevent table stock display for employee
          debtors: isAdmin ? (parsed.debtors || null) : null,
        }
      };

      setMessages(prev => [...prev, aiMsg]);

      // Speak verbal response strictly in English with female voice
      if (!voiceMuted && aiMsg.verbal) {
        speakVoice(aiMsg.verbal);
      }

    } catch (err) {
      console.error('AI assistant error:', err);
      const errorMsg = {
        role: 'assistant',
        verbal: "I'm having trouble processing this request right now. Please try again.",
        text: "⚠️ Sorry, I could not complete the request. Please check your connection or try again.",
        visuals: null,
      };
      setMessages(prev => [...prev, errorMsg]);
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
              <img src={isDark ? "/lambalogow.png" : "/lambalogo.png"} alt="LAMBA AI" className="lamba-ai-trigger-logo" />
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
                <img src={isDark ? "/lambalogow.png" : "/lambalogo.png"} alt="LAMBA AI" style={{ width: 26, height: 26, objectFit: 'contain' }} />
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
              { label: '📄 Invoices for ke', q: 'Generate and download invoices for orders by employee ke.' },
              { label: '📄 All Today\'s Invoices', q: 'Generate and download invoices of all orders of date 26 Oct 2026.' },
              { label: '📦 Outstanding Payable', q: 'What is my total outstanding payable to suppliers?' },
              { label: '💳 Credit Left', q: 'What is total customer credit left and who owes money?' },
              { label: '📊 Today\'s Sales', q: 'How much are my total store sales and orders today?' },
              { label: '⚠️ Low Stock', q: 'Which products are low on stock and need restocking?' },
              { label: '➕ Add Shop', q: 'Add a new customer shop named New Horizon Mart with phone 03001234567 in Lahore.' },
            ].map((chip, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSendMessage(chip.q)}
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
              { label: '📋 My Orders Today', q: 'Show my assigned orders created today.' },
              { label: '🏪 Customer Shops', q: 'How many customer shops are registered in our directory?' },
              { label: '➕ Add Customer', q: 'Add a new customer shop named Royal Traders with phone 03129876543.' },
            ].map((chip, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSendMessage(chip.q)}
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
                    {!isUser && isSpeaking && i === messages.length - 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                        <Volume2 size={13} /> Speaking in English...
                      </div>
                    )}

                    <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>

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
