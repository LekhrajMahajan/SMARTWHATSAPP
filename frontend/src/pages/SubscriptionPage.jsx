// SubscriptionPage.jsx - Dedicated premium subscription monitoring and billing management page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatus, createRazorpayOrder, verifyPayment } from '../api';

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
    </section>
  );
};

export default SubscriptionPage;
