import React, { useState } from "react";
import { Sparkles, CheckCircle2, Clock, Calendar, AlertTriangle, Plus, X, ArrowRight, Lock, CreditCard } from "lucide-react";
import { UserProfile, SkincareReminder } from "../types";
import { motion } from "motion/react";

interface RoutinePlannerProps {
  userProfile: UserProfile;
  onAddReminders: (newReminders: SkincareReminder[]) => void;
  onNavigateToTab?: (tab: string) => void;
}

export default function RoutinePlanner({ userProfile, onAddReminders, onNavigateToTab }: RoutinePlannerProps) {
  const [products, setProducts] = useState<string[]>([]);
  const [newProduct, setNewProduct] = useState("");
  const [frequency, setFrequency] = useState<"AM" | "PM" | "Both">("Both");
  const [generatedRoutine, setGeneratedRoutine] = useState<{am: string[], pm: string[]} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProduct.trim() && !products.includes(newProduct.trim())) {
      setProducts([...products, newProduct.trim()]);
      setNewProduct("");
    }
  };

  const handleRemoveProduct = (prod: string) => {
    setProducts(products.filter(p => p !== prod));
  };

  const generateRoutineLocal = () => {
    setIsGenerating(true);
    setErrorMsg(null);
    
    // Simulate API delay
    setTimeout(() => {
      // Local fallback logic based on common skincare rules
      const am: string[] = [];
      const pm: string[] = [];
      
      const cleansers = products.filter(p => p.toLowerCase().includes("cleanser") || p.toLowerCase().includes("wash"));
      const toners = products.filter(p => p.toLowerCase().includes("toner"));
      const serums = products.filter(p => p.toLowerCase().includes("serum") || p.toLowerCase().includes("vitamin c") || p.toLowerCase().includes("niacinamide"));
      const moisturizers = products.filter(p => p.toLowerCase().includes("moisturizer") || p.toLowerCase().includes("cream") || p.toLowerCase().includes("lotion"));
      const sunscreens = products.filter(p => p.toLowerCase().includes("sunscreen") || p.toLowerCase().includes("spf"));
      const treatments = products.filter(p => p.toLowerCase().includes("retinol") || p.toLowerCase().includes("bha") || p.toLowerCase().includes("aha") || p.toLowerCase().includes("acid"));
      
      const others = products.filter(p => !cleansers.includes(p) && !toners.includes(p) && !serums.includes(p) && !moisturizers.includes(p) && !sunscreens.includes(p) && !treatments.includes(p));

      // AM Routine
      if (frequency === "AM" || frequency === "Both") {
        if (cleansers.length > 0) am.push(cleansers[0]);
        else am.push("Rinse with water");
        
        if (toners.length > 0) am.push(toners[0]);
        if (serums.length > 0) am.push(serums[0]); // typically Vitamin C in AM
        
        if (moisturizers.length > 0) am.push(moisturizers[0]);
        if (sunscreens.length > 0) am.push(sunscreens[0]);
        else am.push("RECOMMENDED: Add a Sunscreen (SPF 30+)");
      }

      // PM Routine
      if (frequency === "PM" || frequency === "Both") {
        if (cleansers.length > 0) pm.push("Double Cleanse with " + cleansers[0]);
        if (toners.length > 0) pm.push(toners[toners.length > 1 ? 1 : 0]);
        
        // Treatments usually at night
        if (treatments.length > 0) pm.push(...treatments);
        
        if (serums.length > 1) pm.push(serums[1]);
        if (moisturizers.length > 0) pm.push(moisturizers[moisturizers.length > 1 ? 1 : 0]);
      }
      
      // Warn about intolerances
      const warnings: string[] = [];
      products.forEach(p => {
        userProfile.intolerantSubstances.forEach(sub => {
          if (p.toLowerCase().includes(sub.toLowerCase())) {
            warnings.push(`Warning: '${p}' might contain '${sub}' which you marked as intolerant.`);
          }
        });
      });

      if (warnings.length > 0) {
        setErrorMsg(warnings.join(" | "));
      }

      setGeneratedRoutine({ am, pm });
      setIsGenerating(false);
    }, 1200);
  };

  const handleSaveToReminders = () => {
    if (!generatedRoutine) return;
    
    const newRems: SkincareReminder[] = [];
    if (generatedRoutine.am.length > 0) {
      newRems.push({
        id: "rem_am_" + Date.now(),
        label: "Morning Routine: " + generatedRoutine.am.length + " steps",
        time: "08:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        active: true
      });
    }
    if (generatedRoutine.pm.length > 0) {
      newRems.push({
        id: "rem_pm_" + Date.now(),
        label: "Evening Routine: " + generatedRoutine.pm.length + " steps",
        time: "21:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        active: true
      });
    }
    
    onAddReminders(newRems);
    alert("Reminders added successfully! Check the Reminders tab.");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-2 space-y-8">
      {/* Header */}
      <div className="bg-brand-card rounded-3xl p-6 shadow-sm border border-brand-darkcream/40 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-8 space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="text-brand-purple w-6 h-6" />
            <h3 className="font-serif text-2xl font-bold text-brand-charcoal">Skincare Routine Planner</h3>
          </div>
          <p className="text-sm text-brand-charcoal/70">
            Input your current products and let Aura Dermix intelligently order them based on your {userProfile.skinType} skin profile.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Side: Inputs */}
        <div className="md:col-span-6 space-y-6">
          <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-4">
            <h4 className="font-serif text-lg font-bold text-brand-charcoal">1. My Products</h4>
            
            <form onSubmit={handleAddProduct} className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. Cerave Hydrating Cleanser" 
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                className="flex-1 bg-brand-cream border border-brand-darkcream/60 rounded-xl px-4 py-2.5 text-xs text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-purple/50"
              />
              <button 
                type="submit"
                disabled={!newProduct.trim()}
                className="bg-brand-purple text-brand-cream px-4 py-2.5 rounded-xl hover:bg-brand-charcoal transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="flex flex-wrap gap-2 mt-4">
              {products.map(prod => (
                <div key={prod} className="bg-brand-cream border border-brand-darkcream/60 px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                  <span>{prod}</span>
                  <button onClick={() => handleRemoveProduct(prod)} className="text-brand-charcoal/50 hover:text-brand-orange">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-xs text-brand-charcoal/50 italic">No products added yet.</p>
              )}
            </div>
          </div>

          <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-4">
            <h4 className="font-serif text-lg font-bold text-brand-charcoal">2. Routine Frequency</h4>
            <div className="grid grid-cols-3 gap-3">
              {["AM", "PM", "Both"].map((freq) => (
                <button
                  key={freq}
                  onClick={() => setFrequency(freq as "AM" | "PM" | "Both")}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    frequency === freq ? "bg-brand-purple border-brand-purple text-brand-cream" : "bg-brand-cream border-brand-darkcream text-brand-charcoal hover:bg-brand-darkcream/30"
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>

            <button 
              onClick={generateRoutineLocal}
              disabled={isGenerating || products.length === 0}
              className="w-full mt-4 bg-brand-lilac text-brand-purple font-bold text-sm py-3 rounded-xl hover:bg-brand-lilac-dark transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Analyzing Layering..." : "Generate Optimal Routine"}
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Generated Routine */}
        <div className="md:col-span-6 space-y-6">
          {userProfile.subscriptionTier === "Free" || !userProfile.subscriptionTier ? (
            <div className="bg-brand-card rounded-3xl p-8 border border-brand-darkcream/40 shadow-sm flex flex-col items-center justify-center text-center space-y-4 min-h-[350px]">
              <div className="w-14 h-14 bg-brand-purple/10 rounded-full flex items-center justify-center">
                <Lock className="text-brand-purple w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-lg font-bold text-brand-charcoal">Calibrated Routine Planner</h4>
                <p className="text-[10px] text-brand-purple font-semibold uppercase tracking-wider mt-1">Pro & Elite Feature</p>
              </div>
              <p className="text-xs text-brand-charcoal/60 leading-relaxed max-w-[280px]">
                Automatic layering order calibration, ingredient incompatibility check, and smart scheduling are exclusive to Pro subscribers.
              </p>
              <button
                onClick={() => onNavigateToTab?.("vault")}
                className="w-full bg-brand-purple text-white hover:bg-brand-purple/90 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                id="btn-planner-upgrade"
              >
                <CreditCard className="w-3.5 h-3.5" /> Unlock Routine Calibration
              </button>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-4 rounded-2xl bg-brand-orange/10 border border-brand-orange/30 text-brand-charcoal text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-brand-orange shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {generatedRoutine ? (
                <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-lg font-bold text-brand-charcoal">Your Perfected Routine</h4>
                    <button 
                      onClick={handleSaveToReminders}
                      className="text-xs bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-full font-bold flex items-center gap-1 hover:bg-brand-green/20 transition-all"
                    >
                      <Clock className="w-3.5 h-3.5" /> Set Reminders
                    </button>
                  </div>

                  {generatedRoutine.am.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-mono uppercase font-bold text-brand-orange flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-orange"></span> AM Routine
                      </h5>
                      <div className="space-y-2">
                        {generatedRoutine.am.map((step, i) => (
                          <div key={i} className="flex gap-3 text-sm bg-brand-cream/50 p-3 rounded-xl border border-brand-darkcream/30">
                            <span className="font-mono text-brand-charcoal/40 font-bold">{i+1}.</span>
                            <span className="text-brand-charcoal">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedRoutine.pm.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-mono uppercase font-bold text-brand-purple flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-purple"></span> PM Routine
                      </h5>
                      <div className="space-y-2">
                        {generatedRoutine.pm.map((step, i) => (
                          <div key={i} className="flex gap-3 text-sm bg-brand-cream/50 p-3 rounded-xl border border-brand-darkcream/30">
                            <span className="font-mono text-brand-charcoal/40 font-bold">{i+1}.</span>
                            <span className="text-brand-charcoal">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-brand-cream/40 border border-brand-darkcream/40 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                  <Sparkles className="w-10 h-10 text-brand-charcoal/20 mb-3" />
                  <p className="text-sm font-serif font-bold text-brand-charcoal/60">Awaiting Products</p>
                  <p className="text-xs text-brand-charcoal/40 max-w-[200px] mt-1">Add your skincare arsenal and we'll sequence them for maximum efficacy.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
