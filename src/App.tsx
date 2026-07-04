import React, { useState, useEffect } from "react";
import { 
  Sparkles, ShieldCheck, User, Calendar, Activity, 
  Settings, ArrowRight, ArrowLeft, Heart, Brain, FileText, 
  TrendingUp, Clock, Cloud, Info, LogOut, Lock, CreditCard 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, ScanReport, SkincareReminder, SkinType } from "./types";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import FaceScanner from "./components/FaceScanner";
import ProgressDashboard from "./components/ProgressDashboard";
import Reminders from "./components/Reminders";
import FirebaseSync from "./components/FirebaseSync";
import RoutinePlanner from "./components/RoutinePlanner";
import auraLogo from "./assets/images/aura_logo_1783087058488.jpg";
import defaultAvatar from "./assets/images/default_avatar_1783087077685.jpg";

// Default Scheduled reminders
const DEFAULT_REMINDERS: SkincareReminder[] = [
  { id: "rem_morn", label: "Morning Hydration & SPF Lock", time: "08:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], active: true },
  { id: "rem_eve", label: "Evening Barrier Treatment", time: "21:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], active: true }
];

export default function App() {
  // Application State
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(false);
  const [onboardStep, setOnboardStep] = useState<number>(1);
  const [showAuthForm, setShowAuthForm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"scan" | "reports" | "dashboard" | "reminders" | "vault" | "planner">("scan");

  // Profile capture states
  const [name, setName] = useState<string>("");
  const [age, setAge] = useState<number>(24);
  const [gender, setGender] = useState<string>("Female");
  const [skinType, setSkinType] = useState<SkinType>("Normal");
  const [intolerantSubstancesStr, setIntolerantSubstancesStr] = useState<string>("");
  const [intolerantSubstances, setIntolerantSubstances] = useState<string[]>([]);
  const [profilePicUrl, setProfilePicUrl] = useState<string>("");
  
  // Auth state for onboarding step 5
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authMode, setAuthMode] = useState<"login"|"signup">("signup");
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"Free" | "Pro" | "Elite">("Free");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showSafepayModal, setShowSafepayModal] = useState(false);

  // Core Data States
  const [scanHistory, setScanHistory] = useState<ScanReport[]>([]);
  const [reminders, setReminders] = useState<SkincareReminder[]>(DEFAULT_REMINDERS);
  const [activeReport, setActiveReport] = useState<ScanReport | null>(null);

  // Initialize and load from LocalStorage
  useEffect(() => {
    const cachedProfile = localStorage.getItem("aura_profile");
    const cachedHistory = localStorage.getItem("aura_history");
    const cachedReminders = localStorage.getItem("aura_reminders");

    if (cachedProfile) {
      try {
        const prof = JSON.parse(cachedProfile);
        setName(prof.name || "");
        setAge(prof.age);
        setGender(prof.gender);
        setSkinType(prof.skinType);
        setIntolerantSubstances(prof.intolerantSubstances || []);
        setIntolerantSubstancesStr((prof.intolerantSubstances || []).join(", "));
        setProfilePicUrl(prof.profilePicUrl || "");
        setSubscriptionTier(prof.subscriptionTier || "Free");
        setHasOnboarded(true);
      } catch (e) {
        console.error("Error parsing cached profile", e);
      }
    }

    if (cachedHistory) {
      try {
        const hist = JSON.parse(cachedHistory);
        setScanHistory(hist);
        if (hist.length > 0) {
          // Default active report to latest scan
          setActiveReport(hist[hist.length - 1]);
        }
      } catch (e) {
        console.error("Error parsing cached history", e);
      }
    }

    if (cachedReminders) {
      try {
        setReminders(JSON.parse(cachedReminders));
      } catch (e) {
        console.error("Error parsing cached reminders", e);
      }
    }
  }, []);

  // Listen for Firebase Auth changes to automatically load their profile and skip onboarding!
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "aura_profiles", user.uid);
          let userDocSnap;
          try {
            userDocSnap = await getDoc(userDocRef);
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `aura_profiles/${user.uid}`);
          }
          
          if (userDocSnap && userDocSnap.exists()) {
            const prof = userDocSnap.data() as UserProfile;
            setName(prof.name || "");
            setAge(prof.age || 24);
            setGender(prof.gender || "Female");
            setSkinType(prof.skinType || "Normal");
            setIntolerantSubstances(prof.intolerantSubstances || []);
            setIntolerantSubstancesStr((prof.intolerantSubstances || []).join(", "));
            setProfilePicUrl(prof.profilePicUrl || "");
            if (prof.subscriptionTier) {
              setSubscriptionTier(prof.subscriptionTier);
            }
            setHasOnboarded(true);
            
            // Sync back to local storage
            localStorage.setItem("aura_profile", JSON.stringify({
              name: prof.name || "",
              age: prof.age || 24,
              gender: prof.gender || "Female",
              skinType: prof.skinType || "Normal",
              intolerantSubstances: prof.intolerantSubstances || [],
              profilePicUrl: prof.profilePicUrl || "",
              subscriptionTier: prof.subscriptionTier || "Free"
            }));
          } else {
            // No profile document in firestore yet. Let's write current local profile to it if exists
            const cachedProfile = localStorage.getItem("aura_profile");
            if (cachedProfile) {
              const prof = JSON.parse(cachedProfile);
              try {
                await setDoc(userDocRef, {
                  ...prof,
                  userId: user.uid
                }, { merge: true });
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, `aura_profiles/${user.uid}`);
              }
            }
          }

          // Load scan history for this user automatically to sync progress dashboard
          try {
            const q = query(
              collection(db, "aura_reports"),
              where("userId", "==", user.uid)
            );
            const querySnapshot = await getDocs(q);
            const parsed: ScanReport[] = [];
            querySnapshot.forEach((docSnap) => {
              parsed.push(docSnap.data() as ScanReport);
            });
            parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            if (parsed.length > 0) {
              setScanHistory(parsed);
              localStorage.setItem("aura_history", JSON.stringify(parsed));
              // Default active report to latest scan
              setActiveReport(parsed[0]);
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.LIST, "aura_reports");
          }
        } catch (err) {
          console.error("Error syncing profile on auth state change:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Save states to LocalStorage helper
  const saveProfileToLocal = (prof: UserProfile) => {
    localStorage.setItem("aura_profile", JSON.stringify(prof));
  };

  const saveHistoryToLocal = (hist: ScanReport[]) => {
    localStorage.setItem("aura_history", JSON.stringify(hist));
    setScanHistory(hist);
  };

  // Complete Onboarding Questionnaire
  const handleCompleteOnboarding = async () => {
    const list = intolerantSubstancesStr
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    
    setIntolerantSubstances(list);

    const profile: UserProfile = {
      name,
      age,
      gender,
      skinType,
      intolerantSubstances: list,
      profilePicUrl,
      subscriptionTier
    };

    saveProfileToLocal(profile);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "aura_profiles", auth.currentUser.uid), {
          ...profile,
          userId: auth.currentUser.uid
        }, { merge: true });
      } catch (e) {
        console.error("Error saving profile to Firestore during onboarding completion:", e);
      }
    }

    setHasOnboarded(true);
  };

  // Callback when on-device + Gemini analysis completes
  const handleAnalysisComplete = async (newReport: ScanReport) => {
    const updatedHistory = [...scanHistory, newReport];
    saveHistoryToLocal(updatedHistory);
    setActiveReport(newReport);
    setActiveTab("reports"); // Go straight to the beautiful newly generated clinical report!

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "aura_reports", newReport.id), {
          ...newReport,
          userId: auth.currentUser.uid
        }, { merge: true });
        console.log("Successfully auto-pushed scan analysis to Firebase Firestore!");
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `aura_reports/${newReport.id}`);
      }
    }
  };

  const handleDeleteReport = async (id: string) => {
    const updated = scanHistory.filter((r) => r.id !== id);
    saveHistoryToLocal(updated);
    if (activeReport?.id === id) {
      setActiveReport(updated.length > 0 ? updated[updated.length - 1] : null);
    }

    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, "aura_reports", id));
        console.log("Successfully deleted report from Firebase Firestore!");
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `aura_reports/${id}`);
      }
    }
  };

  const handleUpdateReminders = (updatedReminders: SkincareReminder[]) => {
    setReminders(updatedReminders);
    localStorage.setItem("aura_reminders", JSON.stringify(updatedReminders));
  };

  const handleResetProfile = () => {
    if (confirm("Reset profile? This will return you to onboarding, but preserve your scan history.")) {
      localStorage.removeItem("aura_profile");
      setHasOnboarded(false);
      setOnboardStep(1);
    }
  };

  const handleOnboardAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        setOnboardStep(2);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, authEmail, authPassword);
        const user = userCredential.user;
        const userDocRef = doc(db, "aura_profiles", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setHasOnboarded(true);
        } else {
          setOnboardStep(2);
        }
      }
    } catch (error: any) {
      const code = error.code;
      if (code === "auth/operation-not-allowed") {
        setAuthError("Email/Password Auth is not enabled in Firebase Console. Please enable it in Firebase -> Authentication -> Sign-in method.");
      } else if (code === "auth/unauthorized-domain" || error.message?.includes("unauthorized-domain")) {
        const hostname = window.location.hostname;
        setAuthError(
          `Unauthorized Domain: "${hostname}" is not authorized in your Firebase Project.\n\n` +
          `To fix this:\n` +
          `1. Open Firebase Console (console.firebase.google.com)\n` +
          `2. Go to Authentication > Settings > Authorized domains\n` +
          `3. Click "Add domain" and enter exactly: ${hostname}\n` +
          `4. Refresh this page and try again!`
        );
      } else if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
        setAuthError("Incorrect email or password, or this user does not exist. If you don't have an account, please choose the 'Sign Up' tab above.");
      } else if (code === "auth/user-not-found") {
        setAuthError("No account exists with this email. Please check the email spelling or click the 'Sign Up' tab to create an account.");
      } else if (code === "auth/wrong-password") {
        setAuthError("Incorrect password. Please verify your credentials and try again.");
      } else if (code === "auth/email-already-in-use") {
        setAuthError("This email address is already in use. Please switch to the 'Login' tab above and enter your password.");
      } else if (code === "auth/weak-password") {
        setAuthError("Password is too weak. Please use a password with at least 6 characters.");
      } else if (code === "auth/invalid-email") {
        setAuthError("Please enter a valid email address (e.g., yourname@domain.com).");
      } else {
        setAuthError(error.message || "An unexpected authentication error occurred. Please try again.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const userDocRef = doc(db, "aura_profiles", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setHasOnboarded(true);
      } else {
        setOnboardStep(2);
      }
    } catch (error: any) {
      const code = error.code;
      if (code === "auth/unauthorized-domain" || error.message?.includes("unauthorized-domain")) {
        const hostname = window.location.hostname;
        setAuthError(
          `Unauthorized Domain: "${hostname}" is not authorized in your Firebase Project.\n\n` +
          `To fix this:\n` +
          `1. Open Firebase Console (console.firebase.google.com)\n` +
          `2. Go to Authentication > Settings > Authorized domains\n` +
          `3. Click "Add domain" and enter exactly: ${hostname}\n` +
          `4. Refresh this page and try again!`
        );
      } else if (code === "auth/popup-closed-by-user") {
        setAuthError("The sign-in popup was closed before completion. Please try again.");
      } else if (code === "auth/popup-blocked") {
        setAuthError("The browser blocked the sign-in popup. Please enable popups for this site or use the email form.");
      } else {
        setAuthError(error.message || "Could not sign in with Google. Please try again or use the email form.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className={`bg-brand-cream text-brand-charcoal font-sans transition-all flex flex-col selection:bg-brand-lilac selection:text-brand-purple ${hasOnboarded ? "h-screen overflow-hidden" : "min-h-screen justify-between"}`} id="aura-app-root">
      
      {/* 1. Landing Welcome Screen - Matches exact provided visual */}
      {!hasOnboarded && onboardStep === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto w-full animate-[fadeIn_0.5s_ease-out]" id="welcome-screen">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-brand-charcoal/60 mb-2">Skin Health Analyzer</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight text-brand-charcoal mb-12">Aura Dermix</h1>
          
          {/* Circular Face Illustration - matches image precisely */}
          <div className="relative w-72 h-72 rounded-full bg-brand-darkcream/40 flex items-center justify-center mb-16">
            
            {/* Orange floating cross circle */}
            <div className="absolute top-16 left-6 w-9 h-9 bg-brand-orange rounded-full flex items-center justify-center text-white shadow-md">
              <span className="font-bold text-lg leading-none">+</span>
            </div>

            {/* Teal floating dot */}
            <div className="absolute top-20 right-10 w-7 h-7 bg-brand-green rounded-full shadow-sm" />

            {/* Purple floating dot */}
            <div className="absolute bottom-12 right-12 w-8 h-8 bg-[#8D82C4] rounded-full shadow-sm animate-[pulse_3s_infinite]" />

            {/* Centered Smiling Face block */}
            <div className="relative w-36 h-40 bg-[#E0D0BD] rounded-[2rem] flex flex-col justify-between py-6 px-7 shadow-lg">
              
              {/* Hair block / brow line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110%] h-6 bg-[#4F3F34] rounded-t-full rounded-b-lg" />

              {/* Eyes */}
              <div className="flex justify-between w-full mt-4">
                <div className="w-3.5 h-3.5 bg-[#2C251E] rounded-full" />
                <div className="w-3.5 h-3.5 bg-[#2C251E] rounded-full" />
              </div>

              {/* Smiling lips crescent */}
              <div className="w-16 h-8 border-b-4 border-[#4F3F34] rounded-b-full mx-auto" />

            </div>
          </div>

          {/* Onboarding Trigger panel */}
          {!showAuthForm ? (
            <div className="bg-[#FAF6EE]/90 border border-brand-darkcream/50 rounded-[2.5rem] p-8 w-full shadow-sm text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-4 text-brand-charcoal text-center leading-tight">
                Discover What Your Skin Truly Needs
              </h2>
              <p className="text-xs sm:text-sm text-brand-charcoal/70 mb-8 leading-relaxed max-w-sm mx-auto">
                Track your skin type, run automated scans, monitor routines, and unlock secure personalized skin health insights today.
              </p>
              
              <div className="pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAuthForm(true)}
                  className="w-full bg-brand-charcoal hover:bg-brand-purple text-white font-bold text-xs py-4 rounded-2xl transition-all cursor-pointer uppercase tracking-widest flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                  id="btn-get-started-landing"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#FAF6EE]/90 border border-brand-darkcream/50 rounded-[2.5rem] p-8 w-full shadow-sm text-left animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-center gap-2 mb-6">
                <button 
                  type="button" 
                  onClick={() => setShowAuthForm(false)}
                  className="text-brand-charcoal/50 hover:text-brand-charcoal p-1.5 rounded-full hover:bg-brand-darkcream/20 transition-all animate-none"
                  title="Go Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-serif text-3xl font-bold tracking-tight text-center flex-1 pr-8 text-brand-charcoal">Secure Your Vault</h2>
              </div>
              
              <form onSubmit={handleOnboardAuth} className="space-y-4">
                <div className="pt-1">
                  <button 
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isAuthLoading}
                    className="w-full bg-white border border-brand-darkcream hover:bg-[#FAF6EE] text-brand-charcoal font-bold text-xs py-4 rounded-2xl transition-all cursor-pointer uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    id="btn-google-signin"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {isAuthLoading ? "Signing in..." : "Continue with Google"}
                  </button>
                </div>

                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-brand-darkcream/40"></div>
                  <span className="px-3 text-[10px] font-mono text-brand-charcoal/40 uppercase">or use email</span>
                  <div className="flex-1 border-t border-brand-darkcream/40"></div>
                </div>

                <div className="flex gap-2 bg-brand-cream p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      authMode === "login" ? "bg-white shadow-sm text-brand-purple" : "text-brand-charcoal/60"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      authMode === "signup" ? "bg-white shadow-sm text-brand-purple" : "text-brand-charcoal/60"
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="skindev@gmail.com"
                    className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-3 text-brand-charcoal text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Security Password</label>
                  <input 
                    type="password" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="******"
                    className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-3 text-brand-charcoal text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                    required
                  />
                </div>

                {authError && (
                  <div className="p-4 bg-brand-orange/10 border border-brand-orange/30 rounded-xl text-xs text-brand-orange whitespace-pre-line leading-relaxed">
                    {authError}
                  </div>
                )}

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-brand-charcoal text-white hover:bg-brand-purple font-bold text-xs py-4 rounded-2xl transition-all cursor-pointer uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isAuthLoading ? "Authenticating..." : authMode === "signup" ? "Create Account" : "Sign In"}
                  </button>
                </div>
                
                <div className="text-center mt-2">
                  <button 
                    type="button" 
                    onClick={() => setOnboardStep(2)}
                    className="text-[11px] text-brand-charcoal/40 font-semibold hover:text-brand-purple underline underline-offset-2 cursor-pointer"
                  >
                    Skip & use local storage only
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 2. Onboarding Steps Flow */}
      {!hasOnboarded && onboardStep > 1 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full" id="onboarding-flow">
          <div className="w-full bg-brand-card rounded-3xl p-8 border border-brand-darkcream/40 shadow-md">
            
            {/* Header progress line */}
            <div className="flex items-center justify-between mb-8 text-xs font-mono text-brand-charcoal/50">
              <span>AURA ONBOARDING</span>
              <span>STEP {onboardStep - 1} OF 4</span>
            </div>

            {/* Step 2: Demographics */}
            {onboardStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-brand-charcoal mb-1">Tell us about yourself</h3>
                  <p className="text-sm text-brand-charcoal/60">Age and gender help us calibrate standard dermal cellular metrics.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Your Name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-3 text-brand-charcoal font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Your Age</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="120"
                      value={age} 
                      onChange={(e) => setAge(parseInt(e.target.value) || 24)}
                      className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-3 text-brand-charcoal font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      id="input-age"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Gender Identification</label>
                    <div className="grid grid-cols-3 gap-3">
                      {["Female", "Male", "Non-binary"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            gender === g ? "bg-brand-purple border-brand-purple text-brand-cream" : "bg-brand-cream border-brand-darkcream text-brand-charcoal hover:bg-brand-darkcream/30"
                          }`}
                          id={`gender-btn-${g}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={async () => {
                      if (auth.currentUser) {
                        await signOut(auth);
                      }
                      setOnboardStep(1);
                    }}
                    className="flex-1 bg-brand-cream border border-brand-darkcream text-brand-charcoal font-semibold text-xs py-3.5 rounded-xl cursor-pointer"
                    id="btn-prev-step-1"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setOnboardStep(3)}
                    className="flex-[2] bg-brand-charcoal text-white hover:bg-brand-purple font-bold text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-widest"
                    id="btn-next-step-1"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Skin Type selection */}
            {onboardStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-brand-charcoal mb-1">Select Inherent Skin Type</h3>
                  <p className="text-sm text-brand-charcoal/60">Choose the description that matches your current overall skin condition.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { type: "Dry", label: "Dry / Dehydrated", desc: "Often feels tight, flaky, lacks visible oil, prone to dry scaling." },
                    { type: "Oily", label: "Oily / Lipidic", desc: "Shiny look, enlarged visible pores, active sebum, prone to spots." },
                    { type: "Combination", label: "Combination", desc: "Oily T-zone (forehead, nose) with dry or neutral cheek areas." },
                    { type: "Sensitive", label: "Sensitive / Reactive", desc: "Prone to redness, burning, itching, highly reactive to new actives." },
                    { type: "Normal", label: "Balanced / Normal", desc: "No chronic issues, balanced moisture/oil barrier, smooth texture." }
                  ].map((s) => (
                    <button
                      key={s.type}
                      type="button"
                      onClick={() => setSkinType(s.type as SkinType)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        skinType === s.type ? "bg-brand-lilac/30 border-brand-purple/50 ring-1 ring-brand-purple/40" : "bg-brand-cream border-brand-darkcream hover:bg-brand-darkcream/30"
                      }`}
                      id={`skin-btn-${s.type}`}
                    >
                      <span className="font-serif text-sm font-bold text-brand-charcoal">{s.label}</span>
                      <span className="text-[11px] text-brand-charcoal/60 mt-1 leading-4">{s.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setOnboardStep(2)}
                    className="flex-1 bg-brand-cream border border-brand-darkcream text-brand-charcoal font-semibold text-xs py-3.5 rounded-xl cursor-pointer"
                    id="btn-prev-step-2"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setOnboardStep(4)}
                    className="flex-1 bg-brand-charcoal text-white hover:bg-brand-purple font-bold text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-widest"
                    id="btn-next-step-2"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Intolerant Substances Exclusions */}
            {onboardStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-brand-charcoal mb-1">Exclusion Substances</h3>
                  <p className="text-sm text-brand-charcoal/60">Identify skincare chemicals or ingredients that irritate you. Gemini will avoid recommending these.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Irritating Active Substances (comma-separated)</label>
                    <textarea 
                      placeholder="e.g., Salicylic Acid, Fragrance, Alcohol Denat, Essential Oils, Benzoyl Peroxide" 
                      value={intolerantSubstancesStr}
                      onChange={(e) => setIntolerantSubstancesStr(e.target.value)}
                      rows={3}
                      className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-3 text-brand-charcoal text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      id="input-intolerant-substances"
                    />
                  </div>

                  <div className="bg-brand-cream/60 rounded-xl p-4 text-[11px] text-brand-charcoal/70 flex gap-2">
                    <Brain className="w-5 h-5 text-brand-purple shrink-0 mt-0.5" />
                    <span>
                      <strong>Gemini Active Filtering:</strong> Aura Dermix maps this list against its active ingredients table. If a skincare brand contains these compounds, they are flagged in the report.
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setOnboardStep(3)}
                    className="flex-1 bg-brand-cream border border-brand-darkcream text-brand-charcoal font-semibold text-xs py-3.5 rounded-xl cursor-pointer"
                    id="btn-prev-step-3"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setOnboardStep(5)}
                    className="flex-1 bg-brand-charcoal text-white hover:bg-brand-purple font-bold text-xs py-3.5 rounded-2xl transition-all cursor-pointer uppercase tracking-widest flex items-center justify-center gap-1.5"
                    id="btn-next-step-4"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Subscription (Safepay Mock) */}
            {onboardStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-brand-charcoal mb-1">Choose Your Plan</h3>
                  <p className="text-sm text-brand-charcoal/60">Select a subscription tier to activate Aura Dermix features.</p>
                </div>

                <div className="space-y-3">
                  {/* Free Tier */}
                  <div 
                    onClick={() => setSubscriptionTier("Free")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${subscriptionTier === "Free" ? "border-brand-purple bg-brand-lilac/20" : "border-brand-darkcream bg-brand-cream hover:border-brand-purple/50"}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-brand-charcoal">Starter (Free)</h4>
                      <span className="font-bold text-brand-purple">Rs 0</span>
                    </div>
                    <p className="text-xs text-brand-charcoal/60">10 Scans / month. Basic local analysis.</p>
                  </div>

                  {/* Pro Tier */}
                  <div 
                    onClick={() => setSubscriptionTier("Pro")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${subscriptionTier === "Pro" ? "border-brand-purple bg-brand-lilac/20" : "border-brand-darkcream bg-brand-cream hover:border-brand-purple/50"}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-brand-charcoal">Pro</h4>
                      <span className="font-bold text-brand-purple">Rs 1500 / mo</span>
                    </div>
                    <p className="text-xs text-brand-charcoal/60">Unlimited scans. Advanced AI routines & insights.</p>
                  </div>

                  {/* Elite Tier */}
                  <div 
                    onClick={() => setSubscriptionTier("Elite")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${subscriptionTier === "Elite" ? "border-brand-purple bg-brand-lilac/20" : "border-brand-darkcream bg-brand-cream hover:border-brand-purple/50"}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-brand-charcoal">Elite</h4>
                      <span className="font-bold text-brand-purple">Rs 4500 / mo</span>
                    </div>
                    <p className="text-xs text-brand-charcoal/60">Pro + Priority Dermatologist Reviews.</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setOnboardStep(4)}
                    className="flex-1 bg-brand-cream border border-brand-darkcream text-brand-charcoal font-semibold text-xs py-3.5 rounded-xl cursor-pointer"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => {
                      if (subscriptionTier === "Free") {
                        handleCompleteOnboarding();
                      } else {
                        setShowSafepayModal(true);
                      }
                    }}
                    disabled={isProcessingPayment}
                    className="flex-[2] bg-brand-green text-white hover:bg-brand-green/90 font-bold text-xs py-3.5 rounded-2xl transition-all cursor-pointer uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessingPayment ? "Processing Safepay..." : subscriptionTier === "Free" ? "Start Free Plan" : `Pay via Safepay`}
                  </button>
                </div>
              </div>
            )}

            {/* Safepay Sandbox Testing Modal */}
            {showSafepayModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                  {/* Safepay Header */}
                  <div className="bg-[#0070F3] p-4 flex items-center justify-between text-white">
                    <div className="font-bold tracking-tight">Safepay <span className="font-normal opacity-80 text-xs ml-2">SANDBOX</span></div>
                    <button onClick={() => setShowSafepayModal(false)} className="text-white/80 hover:text-white">✕</button>
                  </div>
                  
                  <div className="p-6">
                    <div className="text-center mb-6">
                      <p className="text-sm text-slate-500 mb-1">Total Amount</p>
                      <h2 className="text-3xl font-bold text-slate-800">
                        Rs {subscriptionTier === "Pro" ? "1500" : "4500"} <span className="text-sm font-normal text-slate-500">PKR</span>
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Card Number (Testing)</label>
                        <input type="text" placeholder="4242 4242 4242 4242" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#0070F3]" defaultValue="4242 4242 4242 4242" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                          <input type="text" placeholder="MM/YY" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#0070F3]" defaultValue="12/26" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">CVC</label>
                          <input type="text" placeholder="123" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#0070F3]" defaultValue="123" />
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setIsProcessingPayment(true);
                          setTimeout(() => {
                            setIsProcessingPayment(false);
                            setShowSafepayModal(false);
                            handleCompleteOnboarding();
                          }, 1500);
                        }}
                        disabled={isProcessingPayment}
                        className="w-full bg-[#0070F3] hover:bg-[#0060d3] text-white font-bold py-3 rounded-lg mt-2 transition-colors disabled:opacity-50"
                      >
                        {isProcessingPayment ? "Processing..." : "Pay Now"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Application Dashboard */}
      {hasOnboarded && (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-brand-cream font-sans">
          
          {/* Navigation Sidebar (Desktop/Tablet) */}
          <nav className="hidden md:flex w-64 bg-slate-900 flex-col border-r border-slate-800 shrink-0">
            <div className="p-8">
              <div className="flex items-center gap-3">
                <img 
                  src={auraLogo} 
                  alt="Aura Dermix Logo" 
                  className="w-10 h-10 rounded-2xl object-cover border border-slate-700 shadow-sm" 
                  referrerPolicy="no-referrer"
                />
                <h1 className="text-white font-bold text-xl tracking-tight uppercase">Aura <span className="text-brand-purple">Dermix</span></h1>
              </div>
            </div>
            
            <div className="flex-1 px-4 space-y-1">
              <button
                onClick={() => setActiveTab("scan")}
                className={`w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left ${
                  activeTab === "scan" ? "bg-brand-purple/10 text-brand-purple" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Activity className="w-5 h-5" /> Live Scan
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left ${
                  activeTab === "reports" ? "bg-brand-purple/10 text-brand-purple" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FileText className="w-5 h-5" /> Analysis Hub
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left ${
                  activeTab === "dashboard" ? "bg-brand-purple/10 text-brand-purple" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <TrendingUp className="w-5 h-5" /> Health Progress
              </button>
              <button
                onClick={() => setActiveTab("reminders")}
                className={`w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left ${
                  activeTab === "reminders" ? "bg-brand-purple/10 text-brand-purple" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Clock className="w-5 h-5" /> Daily Routine
              </button>
              <button
                onClick={() => setActiveTab("planner")}
                className={`w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left ${
                  activeTab === "planner" ? "bg-brand-purple/10 text-brand-purple" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles className="w-5 h-5" /> Routine Planner
              </button>
              <button
                onClick={() => setActiveTab("vault")}
                className={`w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left ${
                  activeTab === "vault" ? "bg-brand-purple/10 text-brand-purple" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Settings className="w-5 h-5" /> Settings & Cloud
              </button>
              
              <button
                onClick={() => {
                  signOut(auth).then(() => {
                    localStorage.removeItem("aura_profile");
                    localStorage.removeItem("aura_history");
                    localStorage.removeItem("aura_reminders");
                    setHasOnboarded(false);
                    setOnboardStep(1);
                  });
                }}
                className="w-full p-3 rounded-xl flex items-center gap-3 font-medium transition-colors cursor-pointer text-left text-brand-orange/80 hover:text-brand-orange hover:bg-white/5 mt-4"
              >
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
            
            <div className="p-6 bg-slate-800/50 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <img 
                  src={profilePicUrl || defaultAvatar} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover bg-brand-purple" 
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <div className="text-white font-medium text-sm flex justify-between items-center">
                    <span className="truncate pr-2">{name ? `${name} • ` : ''}{age} • {gender}</span>
                  </div>
                  <div className="text-brand-purple text-xs font-semibold">{skinType} Skin</div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col h-full overflow-y-auto">
            {/* Top Header */}
            <header className="h-20 bg-brand-card border-b border-brand-darkcream flex items-center justify-between px-4 sm:px-10 shrink-0">
              <div className="flex-1 min-w-0 mr-4">
                <h2 className="text-xl sm:text-2xl font-bold text-brand-charcoal truncate">
                  {activeTab === "scan" && "Diagnostic Scanner"}
                  {activeTab === "reports" && "Analysis Hub"}
                  {activeTab === "dashboard" && "Health Progress"}
                  {activeTab === "reminders" && "Daily Routine"}
                  {activeTab === "planner" && "Routine Planner"}
                  {activeTab === "vault" && "Settings & Cloud"}
                </h2>
                <p className="text-xs sm:text-sm text-brand-charcoal/50 truncate">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="flex gap-4 shrink-0">
                <div className="flex flex-col items-end hidden lg:flex">
                  <span className="text-[10px] sm:text-xs text-brand-charcoal/40 font-bold uppercase tracking-widest">Skin Type</span>
                  <span className="text-xs sm:text-sm font-semibold text-brand-charcoal">{skinType}</span>
                </div>
                <div className="w-[1px] h-10 bg-brand-darkcream hidden lg:block"></div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] sm:text-xs text-brand-charcoal/40 font-bold uppercase tracking-widest">Profile</span>
                  <span className="text-xs sm:text-sm font-semibold text-brand-charcoal text-right max-w-[120px] sm:max-w-none truncate">{name ? `${name} • ` : ''}{age} • {gender}</span>
                </div>
              </div>
            </header>

            {/* Active Tab Panel renderer */}
            <div className="flex-1 p-6 lg:p-10 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                
                {/* A. Scanner Tab */}
                {activeTab === "scan" && (
                  <FaceScanner 
                    userProfile={{ name, age, gender, skinType, intolerantSubstances, subscriptionTier }}
                    history={scanHistory}
                    onNavigateToTab={(tab: string) => setActiveTab(tab as any)}
                    onAnalysisComplete={handleAnalysisComplete}
                  />
                )}

                {/* B. Reports & Recommendations Tab */}
                {activeTab === "reports" && (
                  <div className="max-w-5xl mx-auto px-4" id="reports-tab-panel">
                    {activeReport ? (
                      <div className="space-y-6">
                        {/* Summary Snapshot row */}
                        <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                          <div className="md:col-span-8 space-y-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="text-brand-green w-5 h-5" />
                              <span className="text-[10px] font-mono text-brand-green font-bold uppercase tracking-wider">Validated Skin Analysis</span>
                            </div>
                            <h2 className="font-serif text-3xl font-bold text-brand-charcoal">
                              Diagnosed: {activeReport.detectedCondition}
                            </h2>
                            <p className="text-xs text-brand-charcoal/50 font-mono">
                              Scan UUID: {activeReport.id} | Timestamp: {new Date(activeReport.timestamp).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="md:col-span-4 flex justify-end gap-3">
                            <div className="bg-brand-cream border border-brand-darkcream px-4 py-3 rounded-2xl text-center">
                              <p className="text-[9px] uppercase font-mono text-brand-charcoal/50">Overall Score</p>
                              <p className="text-2xl font-bold text-brand-purple mt-0.5">{activeReport.metrics.overallScore}%</p>
                            </div>
                            <div className="bg-brand-cream border border-brand-darkcream px-4 py-3 rounded-2xl text-center">
                              <p className="text-[9px] uppercase font-mono text-brand-charcoal/50">On-Device Conf</p>
                              <p className="text-2xl font-bold text-brand-charcoal mt-0.5">{Math.round(activeReport.confidence * 100)}%</p>
                            </div>
                          </div>
                        </div>

                        {/* Analysis report main grids */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                            {/* Left Column: Gemini clinical conclusions */}
                          <div className="lg:col-span-8 bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-6 relative overflow-hidden">
                            
                            {(subscriptionTier === "Free" || !subscriptionTier) && (
                              <div className="absolute inset-0 bg-white/80 backdrop-blur-[4px] z-10 flex flex-col items-center justify-center p-8 text-center animate-[fadeIn_0.2s_ease-out]">
                                <div className="w-14 h-14 bg-brand-purple/10 rounded-full flex items-center justify-center mb-4">
                                  <Lock className="text-brand-purple w-6 h-6" />
                                </div>
                                <h4 className="font-serif text-lg font-bold text-brand-charcoal">Unlock Detailed Clinical Analysis</h4>
                                <p className="text-xs text-brand-charcoal/60 max-w-md leading-relaxed mt-1 mb-5">
                                  Your Starter Plan includes basic classification. Upgrade to **Pro** to unlock complete Gemini clinical assessment summaries, customized AM/PM schedules, and ingredient-safe calibrations.
                                </p>
                                <button
                                  onClick={() => setActiveTab("vault")}
                                  className="bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                                >
                                  <Sparkles className="w-4 h-4" /> Unlock with Pro (Rs 1500 / mo)
                                </button>
                              </div>
                            )}

                            <div className={subscriptionTier === "Free" || !subscriptionTier ? "blur-md select-none pointer-events-none" : ""}>
                              {/* Detailed analysis breakdown */}
                              <div className="space-y-2.5">
                                <h3 className="font-serif text-xl font-bold text-brand-charcoal">Dermal Assessment Summary</h3>
                                <p className="text-sm text-brand-charcoal/80 leading-relaxed">
                                  {activeReport.recommendations?.analysisSummary}
                                </p>
                              </div>

                              {/* Targeted Regimen schedules */}
                              {activeReport.recommendations?.recommendedSkincareRoutine && (
                                <div className="space-y-4">
                                  <h3 className="font-serif text-lg font-bold text-brand-charcoal border-b border-brand-darkcream pb-2">Personalized Skincare Regimen</h3>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Morning Regimen */}
                                    <div className="bg-brand-cream/40 border border-brand-darkcream/50 rounded-2xl p-5 space-y-3">
                                      <h4 className="font-serif font-bold text-brand-purple text-sm flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 bg-brand-purple rounded-full"></span>
                                        AM Morning Routine
                                      </h4>
                                      <ul className="space-y-2 text-xs text-brand-charcoal/80 pl-1">
                                        {activeReport.recommendations.recommendedSkincareRoutine.morning.map((step, i) => (
                                          <li key={i} className="flex gap-2">
                                            <span className="text-brand-purple font-mono font-bold shrink-0">{i+1}.</span>
                                            <span>{step}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    {/* Evening Regimen */}
                                    <div className="bg-brand-cream/40 border border-brand-darkcream/50 rounded-2xl p-5 space-y-3">
                                      <h4 className="font-serif font-bold text-brand-green text-sm flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 bg-brand-green rounded-full"></span>
                                        PM Evening Routine
                                      </h4>
                                      <ul className="space-y-2 text-xs text-brand-charcoal/80 pl-1">
                                        {activeReport.recommendations.recommendedSkincareRoutine.evening.map((step, i) => (
                                          <li key={i} className="flex gap-2">
                                            <span className="text-brand-green font-mono font-bold shrink-0">{i+1}.</span>
                                            <span>{step}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Lifestyle adjustments */}
                              {activeReport.recommendations?.lifestyleAdvice && (
                                <div className="space-y-3 border-t border-brand-darkcream/50 pt-5">
                                  <h3 className="font-serif text-base font-bold text-brand-charcoal">Actionable Lifestyle Adaptation</h3>
                                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-brand-charcoal/70">
                                    {activeReport.recommendations.lifestyleAdvice.map((adv, i) => (
                                      <li key={i} className="flex items-start gap-2 bg-brand-cream/30 p-2.5 rounded-xl border border-brand-darkcream/30">
                                        <span className="text-brand-green font-semibold">✓</span>
                                        <span>{adv}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Self-care tips */}
                              {activeReport.recommendations?.nonMedicalRecommendations && (
                                <div className="space-y-3 border-t border-brand-darkcream/50 pt-5">
                                  <h3 className="font-serif text-base font-bold text-brand-charcoal">Physical Care Guidelines</h3>
                                  <ul className="space-y-2 text-xs text-brand-charcoal/70 pl-2 list-disc list-inside">
                                    {activeReport.recommendations.nonMedicalRecommendations.map((rec, i) => (
                                      <li key={i}>{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Official Disclaimer block */}
                              <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4 flex gap-3 text-[11px] text-brand-charcoal/80">
                                <Info className="w-5 h-5 text-brand-orange shrink-0" />
                                <span>{activeReport.recommendations?.disclaimer}</span>
                              </div>
                            </div>

                          </div>

                          {/* Right Column: Actives matching (Ingredients seek/avoid) */}
                          <div className="lg:col-span-4 space-y-6">
                            
                            {/* Image snap preview */}
                            {activeReport.imageUrl && (
                              <div className="bg-brand-card rounded-3xl p-4 border border-brand-darkcream/40 shadow-sm">
                                <p className="text-xs font-mono uppercase text-brand-charcoal/50 mb-2">Captured scan snap</p>
                                <img 
                                  src={activeReport.imageUrl} 
                                  alt="Clinical thumbnail" 
                                  className="w-full aspect-square rounded-2xl object-cover border border-brand-darkcream/50"
                                />
                              </div>
                            )}

                            {/* Actives to seek */}
                            <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-4">
                              <h4 className="font-serif text-base font-bold text-brand-charcoal flex items-center gap-1.5 border-b border-brand-darkcream pb-2">
                                <span className="w-2 h-2 rounded-full bg-brand-green"></span>
                                Actives to Introduce
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {activeReport.recommendations?.ingredientsToSeek.map((ing, i) => (
                                  <span key={i} className="text-xs bg-brand-green/10 text-brand-green border border-brand-green/20 px-3 py-1 rounded-full font-medium">
                                    {ing}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">
                                These organic & synthetic actives assist skin repair without inflaming your {skinType} skin structure.
                              </p>
                            </div>

                            {/* Actives to Avoid */}
                            <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-4">
                              <h4 className="font-serif text-base font-bold text-brand-charcoal flex items-center gap-1.5 border-b border-brand-darkcream pb-2 text-brand-orange">
                                <span className="w-2 h-2 rounded-full bg-brand-orange"></span>
                                Compounds to Avoid
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {activeReport.recommendations?.ingredientsToAvoid.map((ing, i) => (
                                  <span key={i} className="text-xs bg-brand-orange/10 text-brand-orange border border-brand-orange/20 px-3 py-1 rounded-full font-medium">
                                    {ing}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">
                                Avoid topicals with these elements to eliminate reactions with mapped intolerant substances.
                              </p>
                            </div>

                            {/* Elite Clinic Dermatologist Review Card */}
                            <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-4">
                              <h4 className="font-serif text-base font-bold text-brand-charcoal flex items-center gap-1.5 border-b border-brand-darkcream pb-2">
                                <ShieldCheck className="w-4 h-4 text-brand-purple" />
                                Dermatologist Review
                              </h4>
                              {subscriptionTier === "Elite" ? (
                                <div className="space-y-3">
                                  <div className="bg-brand-green/10 text-brand-green text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse"></span>
                                    Priority Review Submitted
                                  </div>
                                  <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">
                                    As an **Elite Clinic** subscriber, your scan is automatically prioritized for a 1-on-1 certified medical review. You will receive a verified clinician signature and topical prescriptions in your inbox within 12 hours.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-[10px] text-brand-charcoal/60 leading-relaxed">
                                    Need a certified medical second opinion? Upgrade to **Elite Clinic** to receive 1-on-1 priority dermatologist reviews and prescription routing directly inside your hub!
                                  </p>
                                  <button
                                    onClick={() => setActiveTab("vault")}
                                    className="w-full bg-brand-charcoal text-white hover:bg-brand-purple text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> Request Review (Elite)
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>

                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 bg-brand-card rounded-3xl border border-brand-darkcream/40 max-w-lg mx-auto">
                        <FileText className="w-12 h-12 text-brand-charcoal/40 mx-auto mb-3" />
                        <h4 className="font-serif text-xl font-bold mb-1">No Active Report</h4>
                        <p className="text-xs text-brand-charcoal/60 max-w-sm mx-auto mb-4">
                          Scan your face first or check the History Track panel to view previous analysis documents.
                        </p>
                        <button 
                          onClick={() => setActiveTab("scan")}
                          className="bg-brand-lilac text-brand-purple font-bold text-xs px-4 py-2 rounded-xl"
                          id="btn-goto-scan"
                        >
                          Trigger Scanner Now
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* C. Progress Dashboard Tab */}
                {activeTab === "dashboard" && (
                  <ProgressDashboard 
                    history={scanHistory}
                    onDeleteReport={handleDeleteReport}
                  />
                )}

                {/* D. Reminders and alarms Tab */}
                {activeTab === "reminders" && (
                  <Reminders 
                    reminders={reminders}
                    onUpdateReminders={handleUpdateReminders}
                  />
                )}

                {/* F. Skincare Routine Planner Tab */}
                {activeTab === "planner" && (
                  <RoutinePlanner 
                    userProfile={{ name, age, gender, skinType, intolerantSubstances, subscriptionTier }}
                    onNavigateToTab={(tab: string) => setActiveTab(tab as any)}
                    onAddReminders={(newRems) => {
                      const merged = [...reminders, ...newRems];
                      handleUpdateReminders(merged);
                    }}
                  />
                )}

                {/* E. Firebase Cloud Connection Tab */}
                {activeTab === "vault" && (
                  <FirebaseSync 
                    history={scanHistory}
                    onImportHistory={(imported) => {
                      saveHistoryToLocal(imported);
                      if (imported.length > 0) setActiveReport(imported[0]);
                    }}
                    userProfile={{
                      name,
                      age,
                      gender,
                      skinType,
                      intolerantSubstances,
                      profilePicUrl,
                      subscriptionTier
                    }}
                    onUpdateProfile={(updatedProf) => {
                      setName(updatedProf.name);
                      setAge(updatedProf.age);
                      setGender(updatedProf.gender);
                      setSkinType(updatedProf.skinType);
                      setIntolerantSubstances(updatedProf.intolerantSubstances);
                      setIntolerantSubstancesStr(updatedProf.intolerantSubstances.join(", "));
                      setProfilePicUrl(updatedProf.profilePicUrl || "");
                      setSubscriptionTier(updatedProf.subscriptionTier || "Free");
                      saveProfileToLocal(updatedProf);

                      if (auth.currentUser) {
                        setDoc(doc(db, "aura_profiles", auth.currentUser.uid), {
                          ...updatedProf,
                          userId: auth.currentUser.uid
                        }, { merge: true }).catch(err => {
                          console.error("Error pushing live profile update to firestore:", err);
                        });
                      }
                    }}
                  />
                )}

              </motion.div>
            </AnimatePresence>
            </div>

            {/* Standard brand footer inside scrollable dashboard */}
            <footer className="text-center py-6 text-[11px] text-brand-charcoal/40 border-t border-brand-darkcream/20 mt-auto shrink-0 bg-brand-cream/30">
              <p>© 2026 Aura Dermix Skincare. All rights reserved. Designed for precision physical self-care monitoring.</p>
              <p className="mt-1">Handcrafted by Rijab Butt — Clinical Deep Neural Vision Integrations.</p>
            </footer>
          </main>

          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden bg-slate-900 flex items-center justify-around p-2 border-t border-slate-800 shrink-0 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
            <button onClick={() => setActiveTab("scan")} className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${activeTab === "scan" ? "text-brand-purple" : "text-slate-400"}`}>
              <Activity className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium block leading-none">Scan</span>
            </button>
            <button onClick={() => setActiveTab("reports")} className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${activeTab === "reports" ? "text-brand-purple" : "text-slate-400"}`}>
              <FileText className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium block leading-none">Reports</span>
            </button>
            <button onClick={() => setActiveTab("dashboard")} className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${activeTab === "dashboard" ? "text-brand-purple" : "text-slate-400"}`}>
              <TrendingUp className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium block leading-none">Progress</span>
            </button>
            <button onClick={() => setActiveTab("reminders")} className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${activeTab === "reminders" ? "text-brand-purple" : "text-slate-400"}`}>
              <Clock className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium block leading-none">Routine</span>
            </button>
            <button onClick={() => setActiveTab("planner")} className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${activeTab === "planner" ? "text-brand-purple" : "text-slate-400"}`}>
              <Sparkles className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium block leading-none">Planner</span>
            </button>
            <button onClick={() => setActiveTab("vault")} className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${activeTab === "vault" ? "text-brand-purple" : "text-slate-400"}`}>
              <Settings className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium block leading-none">Settings</span>
            </button>
          </nav>
        </div>
      )}

      {/* Standard brand footer */}
      {!hasOnboarded && (
        <footer className="text-center py-6 text-[11px] text-brand-charcoal/40 border-t border-brand-darkcream/20 mt-12">
          <p>© 2026 Aura Dermix Skincare. All rights reserved. Designed for precision physical self-care monitoring.</p>
          <p className="mt-1">Handcrafted by Rijab Butt — Clinical Deep Neural Vision Integrations.</p>
        </footer>
      )}

    </div>
  );
}
