import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatus, createRazorpayOrder, verifyPayment } from '../api';
import html2pdf from 'html2pdf.js';

const INVOICE_DETAILS = {
  '1_month': {
    name: '1 Month Plan',
    base: 1271.18,
    cgst: 114.41,
    sgst: 114.41,
    total: 1500.00
  },
  '3_months': {
    name: '3 Months Plan',
    base: 3813.56,
    cgst: 343.22,
    sgst: 343.22,
    total: 4500.00
  },
  '6_months': {
    name: '6 Months Plan',
    base: 6355.94,
    cgst: 572.03,
    sgst: 572.03,
    total: 7500.00
  }
};

const numberToWords = (num) => {
  if (num === 1500) return 'Rupees One Thousand Five Hundred Only';
  if (num === 4500) return 'Rupees Four Thousand Five Hundred Only';
  if (num === 7500) return 'Rupees Seven Thousand Five Hundred Only';
  return '';
};

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null); // plan ID being activated (loading state)
  const [statusInfo, setStatusInfo] = useState({
    isSubscribed: false,
    subscriptionPlan: '',
    subscriptionExpiry: '',
  });
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    name: localStorage.getItem('username') || '',
    company: '',
    gstin: '',
    address: '',
  });

  const getInvoiceDate = () => {
    if (!statusInfo.subscriptionExpiry || statusInfo.subscriptionExpiry === 'None') {
      return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    try {
      const normalized = statusInfo.subscriptionExpiry.replace(' ', 'T');
      const expiryDate = new Date(normalized);
      const daysToSubtract = statusInfo.subscriptionPlan === '3_months' ? 90 : statusInfo.subscriptionPlan === '6_months' ? 180 : 30;
      
      const purchaseDate = new Date(expiryDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
      return purchaseDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    }
  };

  const getInvoiceNumber = () => {
    if (!statusInfo.subscriptionExpiry || statusInfo.subscriptionExpiry === 'None') {
      return 'SWS-2026-1001';
    }
    let hash = 0;
    const key = (statusInfo.subscriptionExpiry || '') + (billingDetails.name || '');
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const num = Math.abs(hash % 9000) + 1000;
    return `SWS-2026-${num}`;
  };

  const handlePrintInvoice = () => {
    const activePlan = statusInfo.subscriptionPlan || '1_month';
    const invoiceMeta = INVOICE_DETAILS[activePlan] || INVOICE_DETAILS['1_month'];
    const invoiceNum = getInvoiceNumber();
    const invoiceDate = getInvoiceDate();
    const numberWords = numberToWords(invoiceMeta.total);

    const htmlContent = `
      <div style="font-family: 'Outfit', sans-serif; color: #1c2e24; background: #fff; padding: 20px; font-size: 14px; line-height: 1.5; width: 800px; box-sizing: border-box;">
        <div style="border: 1px solid #e2ebd5; border-radius: 16px; padding: 40px; position: relative; background: #fafdf8; box-sizing: border-box;">
          <div style="height: 8px; background: linear-gradient(90deg, #25d366 0%, #128c7e 100%); position: absolute; top: 0; left: 0; right: 0; border-top-left-radius: 16px; border-top-right-radius: 16px;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #e2ebd5; padding-bottom: 20px;">
            <div>
              <h1 style="font-size: 26px; font-weight: 900; color: #075e54; display: flex; align-items: center; gap: 8px; margin: 0;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 6px;">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12C2 13.91 2.538 15.695 3.47 17.218L2.056 21.932C2.013 22.073 2.054 22.227 2.16 22.327C2.242 22.404 2.35 22.443 2.459 22.443C2.498 22.443 2.538 22.438 2.577 22.426L7.42 20.912C8.825 21.615 10.378 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM17.151 15.006C16.945 15.485 16.143 15.897 15.702 15.961C15.344 16.012 14.869 16.046 13.332 15.42C11.366 14.619 10.096 12.639 9.998 12.51C9.901 12.381 9.202 11.464 9.202 10.513C9.202 9.562 9.697 9.097 9.893 8.899C10.04 8.752 10.285 8.683 10.52 8.683C10.598 8.683 10.67 8.687 10.735 8.69C10.929 8.699 11.026 8.711 11.153 9.014C11.312 9.394 11.698 10.334 11.745 10.429C11.792 10.524 11.815 10.643 11.752 10.769C11.689 10.895 11.637 10.966 11.542 11.077C11.448 11.188 11.345 11.322 11.259 11.417C11.164 11.522 11.059 11.634 11.171 11.827C11.283 12.019 11.67 12.651 12.241 13.16C12.977 13.816 13.58 14.024 13.776 14.105C13.923 14.166 14.098 14.152 14.204 14.039C14.337 13.897 14.999 13.125 15.093 12.991C15.187 12.857 15.281 12.88 15.408 12.928C15.535 12.975 16.216 13.31 16.352 13.378C16.488 13.446 16.578 13.479 16.611 13.535C16.644 13.591 16.644 13.884 16.562 14.121C16.48 14.358 16.143 14.767 15.702 14.961C15.261 15.155 14.776 15.084 14.776 15.084C14.776 15.084 17.357 14.527 17.151 15.006Z" fill="#25D366"/>
                </svg>
                Smart WhatsApp
              </h1>
              <p style="font-size: 12px; color: #556c5f; margin-top: 4px;">Automated WhatsApp Campaign Solutions</p>
              <p style="color: #7b9283; font-size: 11px; margin-top: 8px;">
                Seller:<br>
                <strong>Smart WhatsApp Sender Inc.</strong><br>
                Tech Support Hub, Sector-62<br>
                Noida, Uttar Pradesh, 201301<br>
                GSTIN: 09AAPCS8821M1ZC
              </p>
            </div>
            
            <div style="text-align: right;">
              <h2 style="font-size: 28px; font-weight: 800; color: #075e54; margin: 0;">TAX INVOICE</h2>
              <span style="display: inline-block; background: #e1ffd8; color: #0d7300; border: 1px solid #a8e596; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; margin-top: 6px; text-transform: uppercase;">PAID</span>
              <p style="font-size: 12px; color: #556c5f; margin-top: 10px; font-family: monospace;">
                Invoice No: <strong>${invoiceNum}</strong><br>
                Date: <strong>${invoiceDate}</strong>
              </p>
            </div>
          </div>
          
          <div style="display: flex; gap: 30px; margin-bottom: 35px;">
            <div style="flex: 1;">
              <h3 style="font-size: 13px; color: #075e54; text-transform: uppercase; margin-bottom: 8px; border-left: 3px solid #25d366; padding-left: 8px;">Billed To:</h3>
              <p style="font-size: 15px; font-weight: 600; color: #1c2e24; margin: 0 0 2px 0;">${billingDetails.name || 'Customer'}</p>
              ${billingDetails.company ? `<p style="margin: 0; font-size: 13px;">${billingDetails.company}</p>` : ''}
              ${billingDetails.gstin ? `<p style="margin: 0; font-size: 13px;">GSTIN: <strong style="color: #075e54;">${billingDetails.gstin.toUpperCase()}</strong></p>` : ''}
              ${billingDetails.address ? `<p style="margin: 4px 0 0 0; font-size: 13px; white-space: pre-line;">${billingDetails.address}</p>` : ''}
            </div>
            
            <div style="flex: 1;">
              <h3 style="font-size: 13px; color: #075e54; text-transform: uppercase; margin-bottom: 8px; border-left: 3px solid #25d366; padding-left: 8px;">Payment details:</h3>
              <p style="margin: 0; font-size: 13px;"><span style="font-weight: 600;">Payment Method:</span> UPI / Card</p>
              <p style="margin: 0; font-size: 13px;"><span style="font-weight: 600;">Transaction Status:</span> Successful</p>
              <p style="margin: 0; font-size: 13px;"><span style="font-weight: 600;">Supply HSN/SAC:</span> 998311 (SaaS)</p>
              <p style="margin: 0; font-size: 13px;"><span style="font-weight: 600;">Place of Supply:</span> ${billingDetails.gstin ? billingDetails.gstin.substring(0, 2) : 'State'}</p>
            </div>
          </div>
          
          <div style="margin-bottom: 30px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr>
                  <th style="background: #ecf5e7; color: #075e54; padding: 12px 16px; font-size: 12px; text-transform: uppercase; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">Description of Service</th>
                  <th style="background: #ecf5e7; color: #075e54; padding: 12px 16px; font-size: 12px; text-transform: uppercase; text-align: center;">SAC</th>
                  <th style="background: #ecf5e7; color: #075e54; padding: 12px 16px; font-size: 12px; text-transform: uppercase; text-align: right;">Qty</th>
                  <th style="background: #ecf5e7; color: #075e54; padding: 12px 16px; font-size: 12px; text-transform: uppercase; text-align: right;">Rate</th>
                  <th style="background: #ecf5e7; color: #075e54; padding: 12px 16px; font-size: 12px; text-transform: uppercase; text-align: right; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">Taxable Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #ecf5e7;">
                    <strong>Bulk Message Campaign Subscription</strong><br>
                    <span style="font-size: 11px; color: #7b9283;">Smart WhatsApp Sender - ${invoiceMeta.name}</span>
                  </td>
                  <td style="padding: 16px; border-bottom: 1px solid #ecf5e7; text-align: center; font-family: monospace;">998311</td>
                  <td style="padding: 16px; border-bottom: 1px solid #ecf5e7; text-align: right;">1</td>
                  <td style="padding: 16px; border-bottom: 1px solid #ecf5e7; text-align: right;">₹${invoiceMeta.base.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 16px; border-bottom: 1px solid #ecf5e7; text-align: right; font-weight: 600;">₹${invoiceMeta.base.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
            <table style="width: 320px; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 12px;">Subtotal (Taxable Value):</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 600;">₹${invoiceMeta.base.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px;">CGST @ 9%:</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 600;">₹${invoiceMeta.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px;">SGST @ 9%:</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 600;">₹${invoiceMeta.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding: 12px 12px 8px 12px; border-top: 2px solid #e2ebd5; font-size: 18px; font-weight: 900; color: #075e54;">Grand Total:</td>
                <td style="padding: 12px 12px 8px 12px; border-top: 2px solid #e2ebd5; font-size: 18px; font-weight: 900; color: #075e54; text-align: right;">₹${invoiceMeta.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #f4f9f0; border: 1px solid #e2ebd5; border-radius: 8px; padding: 15px; margin-bottom: 40px; font-size: 12px;">
            <span style="font-weight: 700; color: #075e54; text-transform: uppercase; margin-right: 5px;">Amount in Words:</span> ${numberWords}
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cddcc3; padding-top: 20px; font-size: 11px; color: #7b9283;">
            <div>
              <p style="margin: 0;">Thank you for your business!</p>
              <p style="margin: 4px 0 0 0;">For any billing queries, contact support@smartwhatsapp.com</p>
            </div>
            
            <div style="text-align: right; position: relative;">
              <div style="border: 2px dashed #25d366; color: #128c7e; display: inline-block; font-weight: 800; font-size: 12px; padding: 6px 12px; text-transform: uppercase; transform: rotate(-3deg); border-radius: 4px; background: rgba(37, 211, 102, 0.05);">Digitally Verified</div>
              <p style="font-size: 8px; margin-top: 5px;">Computer generated receipt.<br>No signature required.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = htmlContent;

    const opt = {
      margin: 0.1,
      filename: `Tax_Invoice_${invoiceNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container).save();
  };

  // Load status on mount
  const fetchSubscriptionStatus = async () => {
    try {
      const statusData = await getStatus();
      if (statusData) {
        setStatusInfo({
          isSubscribed: statusData.is_subscribed,
          subscriptionPlan: statusData.subscription_plan || '',
          subscriptionExpiry: statusData.subscription_expiry || '',
        });
        // Sync local storage
        localStorage.setItem('isSubscribed', String(statusData.is_subscribed));
        window.dispatchEvent(new Event('subscriptionUpdate'));
      }
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();

    // Dynamically load Razorpay SDK
    const scriptId = 'razorpay-checkout-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Calculate days remaining
  const calculateDaysRemaining = (expiryStr) => {
    if (!expiryStr || expiryStr === 'None') return 0;
    try {
      const normalized = expiryStr.replace(' ', 'T');
      const expiryDate = new Date(normalized);
      const now = new Date();
      const diffTime = expiryDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  const daysRemaining = calculateDaysRemaining(statusInfo.subscriptionExpiry);
  const isExpired = !statusInfo.isSubscribed || daysRemaining <= 0;

  // Handle plan activation (same secure Razorpay flow)
  const handleActivatePlan = async (planName) => {
    setSubscribing(planName);
    try {
      // 1. Create order on backend
      const orderData = await createRazorpayOrder(planName);
      if (!orderData || !orderData.order_id) {
        throw new Error("Failed to create Razorpay order.");
      }

      // 2. Developer/Mock bypass
      if (orderData.order_id.startsWith("order_mock_") || orderData.is_mock) {
        console.log(`ℹ️ Developer/Demo Mode: Simulating transaction for plan: ${planName}`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const verifyRes = await verifyPayment({
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
          razorpay_order_id: orderData.order_id,
          razorpay_signature: "mock_signature_bypass",
          plan: planName
        });

        if (verifyRes && verifyRes.success) {
          alert("🎉 Plan activated successfully! (Developer/Mock Payment Approved)");
          await fetchSubscriptionStatus();
          setShowAllPlans(false);
        } else {
          throw new Error("Mock verification failed.");
        }
        return;
      }

      // 3. Real Razorpay Checkout
      if (!window.Razorpay) {
        throw new Error("Razorpay SDK is not loaded. Please refresh the page.");
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Smart WhatsApp Sender",
        description: `Renew/Activate Plan: ${planName.replace('_', ' ')}`,
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            setSubscribing(planName);
            const verifyRes = await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan: planName
            });

            if (verifyRes && verifyRes.success) {
              alert("🎉 Plan activated successfully! Welcome to your new plan.");
              await fetchSubscriptionStatus();
              setShowAllPlans(false);
            } else {
              alert("❌ Payment verification failed.");
            }
          } catch (err) {
            alert(`❌ Verification failed: ${err.message}`);
          } finally {
            setSubscribing(null);
          }
        },
        prefill: {
          name: localStorage.getItem('username') || '',
          email: '',
          contact: ''
        },
        theme: {
          color: "#25d366"
        },
        modal: {
          ondismiss: function() {
            setSubscribing(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert(`❌ Payment failed: ${response.error.description}`);
        setSubscribing(null);
      });
      rzp.open();

    } catch (error) {
      alert(`❌ Activation failed: ${error.message}`);
      setSubscribing(null);
    }
  };

  const getPlanDisplayName = (planCode) => {
    switch (planCode) {
      case '1_month': return '1 Month Plan';
      case '3_months': return '3 Months Plan';
      case '6_months': return '6 Months Plan';
      default: return planCode || 'Unknown Plan';
    }
  };

  const formatExpiryDate = (dateStr) => {
    if (!dateStr || dateStr === 'None') return '—';
    try {
      const normalized = dateStr.replace(' ', 'T');
      return new Date(normalized).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex-grow pt-32 flex flex-col items-center justify-center min-h-[60vh] text-[#bbcbb9] gap-4">
        <div className="w-12 h-12 border-4 border-[#25d366]/20 border-t-[#25d366] rounded-full animate-spin" />
        <p className="text-lg font-medium animate-pulse text-[#25d366]">Loading subscription details...</p>
      </div>
    );
  }

  return (
    <section className="flex-grow pt-24 md:pt-32 px-4 md:px-margin lg:px-lg max-w-5xl mx-auto w-full relative z-10 pb-20 md:pb-32 flex flex-col items-center">
      {/* Background neon glows */}
      <div className="absolute neon-underglow-abs w-[300px] md:w-[600px] h-[300px] md:h-[600px] top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50" />

      <header className="text-center mb-8 md:mb-12">
        <div className="inline-flex items-center gap-2 bg-[#25d366]/10 border border-[#25d366]/20 px-4 py-1.5 rounded-full mb-4">
          <span className="material-symbols-outlined text-[#25d366] text-sm font-bold">workspace_premium</span>
          <span className="text-[#25d366] text-xs font-bold uppercase tracking-widest">My Subscription</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-[900] leading-[1.1] tracking-[-0.02em] text-[#dce5d8] mb-4">
          Manage Your Plan
        </h1>
        <p className="text-sm md:text-base text-[#bbcbb9] max-w-xl mx-auto">
          Monitor your active bulk message quotas, dynamic remaining validity days, and billing cycles instantly.
        </p>
      </header>

      {/* Main Status Card */}
      <div className="w-full bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/20 p-6 md:p-10 rounded-2xl shadow-[0_0_40px_rgba(37,211,102,0.05)] relative overflow-hidden mb-10 max-w-3xl">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#25d366]/5 rounded-bl-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center md:justify-between gap-8 md:gap-4">
          {/* Left Details */}
          <div className="space-y-4 text-center md:text-left w-full md:w-auto">
            <div>
              <p className="text-xs text-[#bbcbb9]/60 font-semibold uppercase tracking-wider mb-1">Active Plan</p>
              <h2 className="text-2xl md:text-3xl font-black text-[#dce5d8] tracking-tight">
                {isExpired ? 'No Active Plan' : getPlanDisplayName(statusInfo.subscriptionPlan)}
              </h2>
            </div>

            <div>
              <p className="text-xs text-[#bbcbb9]/60 font-semibold uppercase tracking-wider mb-1">Expiration Date</p>
              <p className="text-sm md:text-base text-[#bbcbb9] font-medium font-mono">
                {isExpired ? 'Expired' : formatExpiryDate(statusInfo.subscriptionExpiry)}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${isExpired 
                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                : 'bg-[#25d366]/10 text-[#3de273] border-[#25d366]/20'}`}
              >
                <span className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500 animate-pulse' : 'bg-[#25d366] shadow-[0_0_8px_#25d366]'}`} />
                {isExpired ? 'Expired' : 'Active'}
              </span>
              {!isExpired && (
                <span className="bg-[#19221a] border border-[#3c4a3d]/40 text-[#bbcbb9] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-tight">
                  800 daily Limit
                </span>
              )}
            </div>
          </div>

          {/* Right Days Remaining Ring */}
          <div className="flex flex-col items-center justify-center relative select-none">
            <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-[#121b22]/90 border-4 border-[#3c4a3d]/20 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]">
              {/* Subtle pulsing green glow behind the ring if active */}
              {!isExpired && (
                <div className="absolute inset-0 rounded-full bg-[#25d366]/5 animate-pulse filter blur-md" />
              )}
              
              <div className="text-center z-10">
                <span className={`text-4xl md:text-5xl font-black font-mono block ${isExpired ? 'text-red-400' : 'text-[#25d366] drop-shadow-[0_0_12px_rgba(37,211,102,0.3)]'}`}>
                  {daysRemaining}
                </span>
                <span className="text-[10px] md:text-xs text-[#bbcbb9]/60 font-bold uppercase tracking-wider">
                  {daysRemaining === 1 ? 'Day Left' : 'Days Left'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel inside Card */}
        <div className="mt-8 pt-8 border-t border-[#3c4a3d]/20 flex flex-col sm:flex-row items-center gap-4 justify-between w-full">
          <div>
            <p className="text-xs text-[#bbcbb9]/70 leading-relaxed text-center sm:text-left">
              {isExpired 
                ? 'Your campaign sender features are currently locked. Renew your subscription to instantly unlock all capabilities.' 
                : 'Need to extend your active plan or scale up? You can renew early or switch plan details below.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            {/* Repeat Subscription / Quick Renew */}
            {!isExpired && statusInfo.subscriptionPlan && (
              <button
                onClick={() => handleActivatePlan(statusInfo.subscriptionPlan)}
                disabled={subscribing !== null}
                className="w-full sm:w-auto px-6 py-3 bg-[#19221a] hover:bg-[#25d366] hover:text-[#003915] text-[#25d366] border border-[#25d366]/30 hover:border-transparent rounded-full font-bold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 text-sm"
              >
                {subscribing === statusInfo.subscriptionPlan ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Renewing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">replay</span>
                    Repeat Plan
                  </>
                )}
              </button>
            )}

            {isExpired && statusInfo.subscriptionPlan && (
              <button
                onClick={() => handleActivatePlan(statusInfo.subscriptionPlan)}
                disabled={subscribing !== null}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#25d366] hover:bg-[#4ff07f] text-[#003915] rounded-full font-extrabold transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,211,102,0.2)] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:-translate-y-0.5 active:scale-95 text-sm"
              >
                {subscribing === statusInfo.subscriptionPlan ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">replay</span>
                    Repeat {getPlanDisplayName(statusInfo.subscriptionPlan)}
                  </>
                )}
              </button>
            )}

            {/* Download Invoice Button */}
            {statusInfo.subscriptionPlan && (
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="w-full sm:w-auto px-6 py-3 bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border border-[#25d366]/30 rounded-full font-bold transition-all duration-300 text-sm flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">receipt</span>
                Download Invoice
              </button>
            )}

            {/* Change / Show all plans toggle */}
            <button
              onClick={() => setShowAllPlans(!showAllPlans)}
              className="w-full sm:w-auto px-6 py-3 bg-[#121b22] hover:bg-[#19221a] text-[#dce5d8] border border-[#3c4a3d] rounded-full font-semibold transition-all duration-300 text-sm flex items-center justify-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showAllPlans ? 'visibility_off' : 'tune'}
              </span>
              {showAllPlans ? 'Hide Other Plans' : 'Choose Other Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of other plans (only shown when showAllPlans is true or they don't have any subscription plan saved at all) */}
      {(showAllPlans || !statusInfo.subscriptionPlan) && (
        <div className="w-full animate-in fade-in slide-in-from-top-6 duration-500">
          <div className="text-center mb-10">
            <h3 className="text-xl md:text-2xl font-bold text-[#dce5d8] mb-2">Available Subscription Tiers</h3>
            <p className="text-xs md:text-sm text-[#bbcbb9]/60">Select any plan below to buy or change your current campaign package.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {/* Plan 1 */}
            <div className={`bg-[#121b22]/70 backdrop-blur-xl border p-8 rounded-2xl flex flex-col justify-between hover:border-[#25d366]/50 transition-all duration-300 relative group shadow-[0_0_30px_rgba(37,211,102,0.02)] ${statusInfo.subscriptionPlan === '1_month' && !isExpired ? 'border-[#25d366]/40 bg-[#152719]/20' : 'border-[#869584]/20'}`}>
              {statusInfo.subscriptionPlan === '1_month' && !isExpired && (
                <span className="absolute -top-3 left-6 bg-[#25d366]/20 border border-[#25d366]/30 text-[#25d366] text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">Current Active</span>
              )}
              <div>
                <h3 className="text-lg font-bold text-[#dce5d8] mb-1">1 Month Plan</h3>
                <p className="text-xs text-[#bbcbb9]/70 mb-6">Perfect for small, quick campaigns.</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#25d366]">₹1,500</span>
                  <span className="text-xs text-[#bbcbb9]/60">/ month</span>
                </div>
                <ul className="space-y-3 mb-8 text-xs text-[#bbcbb9]">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    800 daily message limit
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    10:00 AM - 06:00 PM IST window
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    100 messages per batch limit
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    Smart 1-hour batch cooldown
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleActivatePlan('1_month')}
                disabled={subscribing !== null}
                className="w-full bg-[#19221a] hover:bg-[#25d366] hover:text-[#003915] text-[#25d366] border border-[#25d366]/30 py-3 rounded-full font-bold transition-all duration-300 flex items-center justify-center gap-2 text-xs"
              >
                {subscribing === '1_month' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  statusInfo.subscriptionPlan === '1_month' && !isExpired ? 'Extend Plan' : 'Select Plan'
                )}
              </button>
            </div>

            {/* Plan 2 */}
            <div className={`bg-[#121b22]/70 backdrop-blur-xl border p-8 rounded-2xl flex flex-col justify-between hover:border-[#25d366]/50 transition-all duration-300 relative group shadow-[0_0_30px_rgba(37,211,102,0.02)] ${statusInfo.subscriptionPlan === '3_months' && !isExpired ? 'border-[#25d366] bg-[#152719]/40 md:-translate-y-2' : 'border-[#869584]/20'}`}>
              {statusInfo.subscriptionPlan === '3_months' && !isExpired ? (
                <span className="absolute -top-3 left-6 bg-[#25d366] text-[#003915] text-[10px] font-extrabold uppercase px-3 py-1 rounded-full shadow-[0_0_10px_rgba(37,211,102,0.3)]">Current Active</span>
              ) : (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-[#25d366]/10 border border-[#25d366]/30 text-[#25d366] text-[9px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-[#dce5d8] mb-1">3 Months Plan</h3>
                <p className="text-xs text-[#bbcbb9]/70 mb-6">Best for growing businesses & marketing.</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#25d366]">₹4,500</span>
                  <span className="text-xs text-[#bbcbb9]/60">/ 3 months</span>
                </div>
                <ul className="space-y-3 mb-8 text-xs text-[#bbcbb9]">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    800 daily message limit
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    10:00 AM - 06:00 PM IST window
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    100 messages per batch limit
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    Smart 1-hour batch cooldown
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleActivatePlan('3_months')}
                disabled={subscribing !== null}
                className="w-full bg-[#25d366] hover:bg-[#4ff07f] text-[#003915] py-3 rounded-full font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,211,102,0.15)] text-xs"
              >
                {subscribing === '3_months' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  statusInfo.subscriptionPlan === '3_months' && !isExpired ? 'Extend Plan' : 'Select Plan'
                )}
              </button>
            </div>

            {/* Plan 3 */}
            <div className={`bg-[#121b22]/70 backdrop-blur-xl border p-8 rounded-2xl flex flex-col justify-between hover:border-[#25d366]/50 transition-all duration-300 relative group shadow-[0_0_30px_rgba(37,211,102,0.02)] ${statusInfo.subscriptionPlan === '6_months' && !isExpired ? 'border-[#25d366]/40 bg-[#152719]/20' : 'border-[#869584]/20'}`}>
              {statusInfo.subscriptionPlan === '6_months' && !isExpired && (
                <span className="absolute -top-3 left-6 bg-[#25d366]/20 border border-[#25d366]/30 text-[#25d366] text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">Current Active</span>
              )}
              <div>
                <h3 className="text-lg font-bold text-[#dce5d8] mb-1">6 Months Plan</h3>
                <p className="text-xs text-[#bbcbb9]/70 mb-6">Best value for long-term campaigns.</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#25d366]">₹7,500</span>
                  <span className="text-xs text-[#bbcbb9]/60">/ 6 months</span>
                </div>
                <ul className="space-y-3 mb-8 text-xs text-[#bbcbb9]">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    800 daily message limit
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    10:00 AM - 06:00 PM IST window
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    100 messages per batch limit
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#25d366] text-base">check_circle</span>
                    Smart 1-hour batch cooldown
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleActivatePlan('6_months')}
                disabled={subscribing !== null}
                className="w-full bg-[#19221a] hover:bg-[#25d366] hover:text-[#003915] text-[#25d366] border border-[#25d366]/30 py-3 rounded-full font-bold transition-all duration-300 flex items-center justify-center gap-2 text-xs"
              >
                {subscribing === '6_months' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  statusInfo.subscriptionPlan === '6_months' && !isExpired ? 'Extend Plan' : 'Select Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#121b22] border border-[#25d366]/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_60px_rgba(37,211,102,0.15)] flex flex-col md:flex-row relative animate-in zoom-in-95 duration-300">
            {/* Close Button */}
            <button 
              onClick={() => setShowInvoiceModal(false)}
              className="absolute top-4 right-4 text-[#bbcbb9] hover:text-[#25d366] transition-colors z-10"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            {/* Left Side - Settings & Input Form */}
            <div className="w-full md:w-1/2 p-6 md:p-8 border-b md:border-b-0 md:border-r border-[#869584]/10">
              <div className="flex items-center gap-2 mb-4 text-[#25d366]">
                <span className="material-symbols-outlined font-bold text-xl">receipt_long</span>
                <h3 className="text-xl font-black text-[#dce5d8] tracking-tight">Billing Information</h3>
              </div>
              <p className="text-xs text-[#bbcbb9]/60 mb-6">
                Add custom billing details or a GSTIN to claim Input Tax Credit (ITC). Details will update instantly in the preview.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#bbcbb9] uppercase tracking-wider mb-2">Billing Name</label>
                  <input
                    type="text"
                    value={billingDetails.name}
                    onChange={(e) => setBillingDetails({ ...billingDetails, name: e.target.value })}
                    className="w-full bg-[#19221a]/50 border border-[#3c4a3d] rounded-lg px-4 py-2.5 text-sm text-[#dce5d8] focus:border-[#25d366] focus:outline-none"
                    placeholder="Enter Billing Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#bbcbb9] uppercase tracking-wider mb-2">Company Name (Optional)</label>
                  <input
                    type="text"
                    value={billingDetails.company}
                    onChange={(e) => setBillingDetails({ ...billingDetails, company: e.target.value })}
                    className="w-full bg-[#19221a]/50 border border-[#3c4a3d] rounded-lg px-4 py-2.5 text-sm text-[#dce5d8] focus:border-[#25d366] focus:outline-none"
                    placeholder="Enter Company Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#bbcbb9] uppercase tracking-wider mb-2">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={billingDetails.gstin}
                    maxLength={15}
                    onChange={(e) => setBillingDetails({ ...billingDetails, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-[#19221a]/50 border border-[#3c4a3d] rounded-lg px-4 py-2.5 text-sm text-[#dce5d8] focus:border-[#25d366] focus:outline-none"
                    placeholder="e.g. 07AAAAA1111A1Z1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#bbcbb9] uppercase tracking-wider mb-2">Billing Address (Optional)</label>
                  <textarea
                    value={billingDetails.address}
                    rows={3}
                    onChange={(e) => setBillingDetails({ ...billingDetails, address: e.target.value })}
                    className="w-full bg-[#19221a]/50 border border-[#3c4a3d] rounded-lg p-3 text-sm text-[#dce5d8] focus:border-[#25d366] focus:outline-none resize-none"
                    placeholder="Enter billing address for GST"
                  />
                </div>
              </div>
            </div>

            {/* Right Side - Real-time Preview */}
            <div className="w-full md:w-1/2 p-6 md:p-8 bg-[#0d150e]/40 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#bbcbb9] uppercase tracking-wider mb-4">Live Invoice Preview</h4>
                
                {/* Embedded Mini Invoice Card */}
                <div className="bg-[#121b22] border border-[#25d366]/20 rounded-xl p-5 text-[#dce5d8] text-xs space-y-4 shadow-lg select-none">
                  <div className="flex justify-between items-start border-b border-[#3c4a3d]/30 pb-3">
                    <div>
                      <h5 className="font-extrabold text-[#25d366] text-sm">Smart WhatsApp</h5>
                      <p className="text-[10px] text-[#bbcbb9]/60">Invoice No: {getInvoiceNumber()}</p>
                    </div>
                    <span className="bg-[#25d366]/10 border border-[#25d366]/30 text-[#25d366] px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">PAID</span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-[#bbcbb9]">
                    <p><strong className="text-[#dce5d8]">Billed To:</strong> {billingDetails.name || 'Customer'}</p>
                    {billingDetails.company && <p><strong className="text-[#dce5d8]">Company:</strong> {billingDetails.company}</p>}
                    {billingDetails.gstin && <p><strong className="text-[#dce5d8]">GSTIN:</strong> {billingDetails.gstin}</p>}
                    {billingDetails.address && <p className="truncate"><strong className="text-[#dce5d8]">Addr:</strong> {billingDetails.address}</p>}
                    <p><strong className="text-[#dce5d8]">Date:</strong> {getInvoiceDate()}</p>
                  </div>

                  <div className="border-t border-[#3c4a3d]/30 pt-3">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-[#bbcbb9]/60">
                          <th className="font-semibold pb-1">Item</th>
                          <th className="font-semibold pb-1 text-right">Taxable</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-1">
                            SWS Subscription<br/>
                            <span className="text-[9px] text-[#bbcbb9]/50">{getPlanDisplayName(statusInfo.subscriptionPlan)}</span>
                          </td>
                          <td className="text-right py-1">₹{(INVOICE_DETAILS[statusInfo.subscriptionPlan || '1_month']?.base || 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-dashed border-[#3c4a3d]/50 pt-2 space-y-1 text-[11px] text-[#bbcbb9]">
                    <div className="flex justify-between">
                      <span>CGST (9%)</span>
                      <span>₹{(INVOICE_DETAILS[statusInfo.subscriptionPlan || '1_month']?.cgst || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST (9%)</span>
                      <span>₹{(INVOICE_DETAILS[statusInfo.subscriptionPlan || '1_month']?.sgst || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-[#25d366] text-sm pt-1 border-t border-[#3c4a3d]/20">
                      <span>Grand Total</span>
                      <span>₹{(INVOICE_DETAILS[statusInfo.subscriptionPlan || '1_month']?.total || 0).toFixed(0)}.00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePrintInvoice}
                  className="flex-grow px-6 py-3 bg-[#25d366] hover:bg-[#4ff07f] text-[#003915] rounded-full font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 shadow-[0_0_20px_rgba(37,211,102,0.2)]"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-6 py-3 bg-[#121b22] hover:bg-[#19221a] text-[#bbcbb9] border border-[#3c4a3d] rounded-full font-bold text-sm transition-all duration-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SubscriptionPage;
