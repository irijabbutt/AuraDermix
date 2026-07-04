import React, { useState, useEffect } from "react";
import { 
  Cloud, CloudLightning, ShieldCheck, Key, LogIn, UserPlus, 
  Database, AlertCircle, Check, RefreshCw, Upload, Sparkles, 
  CreditCard, ShieldAlert, BadgeCheck, Camera, CheckCircle2 
} from "lucide-react";
import { ScanReport, UserProfile } from "../types";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { collection, doc, setDoc, getDocs, query, where } from "firebase/firestore";
import defaultAvatar from "../assets/images/default_avatar_1783087077685.jpg";

interface FirebaseSyncProps {
  history: ScanReport[];
  onImportHistory: (imported: ScanReport[]) => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export default function FirebaseSync({ 
  history, 
  onImportHistory, 
  userProfile, 
  onUpdateProfile 
}: FirebaseSyncProps) {
  // Navigation tabs inside Settings
  const [activeSettingsTab, setActiveSettingsTab] = useState<"sync" | "profile">("profile");

  // Auth States
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Sync States
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Profile Edit States (initialized with userProfile props)
  const [editName, setEditName] = useState(userProfile.name || "");
  const [editAge, setEditAge] = useState(userProfile.age || 24);
  const [editGender, setEditGender] = useState(userProfile.gender || "Female");
  const [editSkinType, setEditSkinType] = useState(userProfile.skinType || "Normal");
  const [editIntolerances, setEditIntolerances] = useState((userProfile.intolerantSubstances || []).join(", "));
  const [profilePic, setProfilePic] = useState(userProfile.profilePicUrl || "");
  const [isDragOver, setIsDragOver] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Upgrade Modal State
  const [upgradeTargetTier, setUpgradeTargetTier] = useState<"Pro" | "Elite" | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Sync user changes from props if props update
  useEffect(() => {
    setEditName(userProfile.name || "");
    setEditAge(userProfile.age || 24);
    setEditGender(userProfile.gender || "Female");
    setEditSkinType(userProfile.skinType || "Normal");
    setEditIntolerances((userProfile.intolerantSubstances || []).join(", "));
    setProfilePic(userProfile.profilePicUrl || "");
  }, [userProfile]);

  // Auth Subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSessionUser(user);
      } else {
        setSessionUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setErrorDetails(null);
    setAuthSuccessMsg(null);

    try {
      if (authMode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        setAuthSuccessMsg("Account registered successfully! You are now signed in.");
        
        // Save current profile configuration to Firestore for new user!
        try {
          await setDoc(doc(db, "aura_profiles", userCredential.user.uid), {
            ...userProfile,
            userId: userCredential.user.uid
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `aura_profiles/${userCredential.user.uid}`);
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setAuthSuccessMsg(`Logged in successfully as ${userCredential.user.email}`);
        pullHistoryFromCloud(userCredential.user.uid);
      }
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        setErrorDetails("Email/Password Auth is not enabled in Firebase Console. Please enable it under Auth -> Sign-in providers.");
      } else {
        setErrorDetails(err.message || "Authentication process failed.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSessionUser(null);
    setAuthSuccessMsg("Logged out of session.");
  };

  const pullHistoryFromCloud = async (userId: string) => {
    try {
      const q = query(
        collection(db, "aura_reports"),
        where("userId", "==", userId)
      );
      
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, "aura_reports");
      }

      const parsed: ScanReport[] = [];
      if (querySnapshot) {
        querySnapshot.forEach((doc) => {
          parsed.push(doc.data() as ScanReport);
        });
      }

      parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (parsed.length > 0) {
        onImportHistory(parsed);
        setSyncStatus(`Sync success: Pulled ${parsed.length} skin reports from the Cloud.`);
      }
    } catch (err: any) {
      console.error("Error pulling history:", err);
      if (err.code === "permission-denied" || err.message?.includes("permission-denied")) {
         setErrorDetails("Permission denied. Missing Firestore security rules.");
      } else {
         setErrorDetails(err.message || "Failed to pull records from cloud database.");
      }
    }
  };

  const handlePushToCloud = async () => {
    if (!sessionUser) return;
    setIsSyncing(true);
    setSyncStatus(null);
    setErrorDetails(null);

    try {
      let count = 0;
      for (const report of history) {
        try {
          const docRef = doc(db, "aura_reports", report.id);
          await setDoc(docRef, {
            ...report,
            userId: sessionUser.uid
          }, { merge: true });
          count++;
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `aura_reports/${report.id}`);
        }
      }
      setSyncStatus(`Durable Synchronization Complete! Saved ${count} report records securely inside Firestore.`);
    } catch (err: any) {
      console.error("Sync push failed:", err);
      setErrorDetails(err.message || "Failed to upload records to cloud database.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Convert File to Base64 String
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === "string") {
        setProfilePic(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // Pre-set avatar choices
  const avatarPresets = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150"
  ];

  // Save Settings Changes
  const handleSaveProfileSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    const list = editIntolerances
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const updated: UserProfile = {
      name: editName,
      age: Number(editAge),
      gender: editGender,
      skinType: editSkinType,
      intolerantSubstances: list,
      profilePicUrl: profilePic,
      subscriptionTier: userProfile.subscriptionTier || "Free"
    };

    onUpdateProfile(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Safepay Mock Checkout Handler
  const handleSafepayUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!upgradeTargetTier) return;
    if (!cardNumber || !cardName || !cardExpiry || !cardCVC) {
      setPaymentError("Please fill out all billing credentials.");
      return;
    }

    setIsPaying(true);
    setPaymentError(null);

    // Simulate clinical payment clearance
    setTimeout(() => {
      const updated: UserProfile = {
        ...userProfile,
        subscriptionTier: upgradeTargetTier
      };
      onUpdateProfile(updated);
      setIsPaying(false);
      setUpgradeTargetTier(null);
      
      // Reset payment fields
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCVC("");

      alert(`Aura Plan successfully upgraded to ${upgradeTargetTier}! Clinical diagnostic features unlocked.`);
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 space-y-6" id="firebase-sync-root">
      
      {/* Settings Navigation Bar */}
      <div className="flex border-b border-brand-darkcream/60">
        <button
          onClick={() => setActiveSettingsTab("profile")}
          className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSettingsTab === "profile"
              ? "border-brand-purple text-brand-purple"
              : "border-transparent text-brand-charcoal/50 hover:text-brand-charcoal"
          }`}
          id="btn-tab-profile-settings"
        >
          <Camera className="w-4 h-4" />
          Profile & Plan Settings
        </button>
        <button
          onClick={() => setActiveSettingsTab("sync")}
          className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSettingsTab === "sync"
              ? "border-brand-purple text-brand-purple"
              : "border-transparent text-brand-charcoal/50 hover:text-brand-charcoal"
          }`}
          id="btn-tab-vault-sync"
        >
          <Cloud className="w-4 h-4" />
          Secure Cloud Vault
        </button>
      </div>

      {activeSettingsTab === "sync" ? (
        /* TAB 1: Secure Cloud Vault Sync */
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-brand-card rounded-3xl p-6 shadow-sm border border-brand-darkcream/40 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <div className="flex items-center gap-2">
                <Cloud className="text-brand-purple w-6 h-6" />
                <h3 className="font-serif text-2xl font-bold text-brand-charcoal">Firebase Secure Vault</h3>
              </div>
              <p className="text-sm text-brand-charcoal/70">
                Aura Dermix supports complete server-side secure synchronization. Enable cloud-hosted profiles to securely store and access report histories across any workspace device.
              </p>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <div className={`p-4 rounded-2xl flex items-center gap-3 w-full border ${
                sessionUser 
                  ? "bg-brand-green/10 border-brand-green/30 text-brand-green" 
                  : "bg-brand-cream border-brand-darkcream/60 text-brand-charcoal/60"
              }`}>
                <CloudLightning className="w-6 h-6 animate-pulse" />
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold">Cloud Connection</p>
                  <p className="text-sm font-semibold font-serif">
                    {sessionUser ? "Sync Engaged" : "Local Storage Mode"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Side: Setup Credentials & Auth */}
            <div className="md:col-span-7 space-y-6">
              
              <div className="bg-brand-card rounded-3xl p-6 border border-brand-purple/25 shadow-md space-y-4">
                <h4 className="font-serif text-lg font-bold text-brand-charcoal flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-green" />
                  User Authentication
                </h4>

                {sessionUser ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-brand-green/5 border border-brand-green/20 text-xs flex justify-between items-center">
                      <div>
                        <p className="text-brand-charcoal/50">Active Session:</p>
                        <p className="font-semibold text-brand-charcoal mt-0.5">{sessionUser.email}</p>
                      </div>
                      <button 
                        onClick={handleLogout}
                        className="text-brand-orange hover:underline font-semibold cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={handlePushToCloud}
                        disabled={isSyncing}
                        className="w-full bg-brand-lilac text-brand-purple font-bold text-sm py-3 rounded-xl hover:bg-brand-lilac-dark transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Persisting Cloud Data...
                          </>
                        ) : (
                          <>
                            <CloudLightning className="w-4 h-4" />
                            Push Local History to Cloud
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="space-y-3">
                    <div className="flex gap-2 bg-brand-cream p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setAuthMode("login")}
                        className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${
                          authMode === "login" ? "bg-brand-card shadow-sm text-brand-purple" : "text-brand-charcoal/60"
                        }`}
                      >
                        <LogIn className="w-3.5 h-3.5 inline mr-1" /> Login
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode("signup")}
                        className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${
                          authMode === "signup" ? "bg-brand-card shadow-sm text-brand-purple" : "text-brand-charcoal/60"
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5 inline mr-1" /> Sign Up
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-brand-charcoal/60 mb-1">Email address</label>
                      <input 
                        type="email" 
                        placeholder="skindev@gmail.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-brand-cream border border-brand-darkcream/60 rounded-xl px-4 py-2.5 text-xs text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-purple/50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-brand-charcoal/60 mb-1">Security Password</label>
                      <input 
                        type="password" 
                        placeholder="******" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-brand-cream border border-brand-darkcream/60 rounded-xl px-4 py-2.5 text-xs text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-purple/50"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full bg-brand-purple text-brand-cream py-3 rounded-xl hover:bg-brand-charcoal font-semibold text-xs transition-all cursor-pointer shadow-sm mt-1"
                    >
                      {isAuthLoading ? "Authenticating..." : authMode === "login" ? "Sign In to Vault" : "Create Sync Account"}
                    </button>
                  </form>
                )}
              </div>

              {(authSuccessMsg || syncStatus || errorDetails) && (
                <div className={`p-4 rounded-2xl border text-xs leading-5 flex items-start gap-2.5 ${
                  errorDetails 
                    ? "bg-brand-orange/10 border-brand-orange/30 text-brand-charcoal" 
                    : "bg-brand-green/10 border-brand-green/30 text-brand-green"
                }`}>
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">{errorDetails ? "Vault Action Failed" : "Vault Activity Log"}</p>
                    <p className="mt-1 text-brand-charcoal/80">{errorDetails || authSuccessMsg || syncStatus}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Setup Instructions Schema */}
            <div className="md:col-span-5 bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-4">
              <h4 className="font-serif text-lg font-bold text-brand-charcoal flex items-center gap-2">
                <Database className="w-5 h-5 text-brand-purple" />
                Cloud Synchronization
              </h4>
              <p className="text-xs text-brand-charcoal/70 leading-5">
                Registering an account links your scan metrics securely to Firebase Firestore, letting you backup your reports and load them instantly from any tab or device.
              </p>
              
              <div className="bg-brand-cream/60 border border-brand-darkcream/40 rounded-xl p-3 text-[10px] text-brand-charcoal/60 space-y-1">
                <p className="font-semibold text-brand-charcoal">Security Policy (Rules) Tip:</p>
                <p>We rely on Firestore security rules to ensure users can only access records matching their verified login <code className="bg-brand-darkcream text-brand-purple font-mono px-0.5 rounded">userId</code>.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: Profile Settings & Subscription Upgrades */
        <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
          <form onSubmit={handleSaveProfileSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Side: Name, Age, Gender, Skin Type and Drag-Drop Image Icon */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-6">
                <div>
                  <h3 className="font-serif text-xl font-bold text-brand-charcoal">Personal Skin Profile</h3>
                  <p className="text-xs text-brand-charcoal/50">Manage your credentials, bio-parameters, and profile image.</p>
                </div>

                {/* Profile Image Section */}
                <div className="space-y-3">
                  <label className="block text-xs font-mono uppercase text-brand-charcoal/60">Profile Image</label>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group shrink-0">
                      <img 
                        src={profilePic || defaultAvatar} 
                        alt="Profile Picture" 
                        className="w-20 h-20 rounded-full object-cover border-4 border-brand-cream shadow-md group-hover:brightness-90 transition-all"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      {/* Presets Grid */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-brand-charcoal/40 uppercase">Or select a skin avatar preset:</span>
                        <div className="flex gap-2 mt-1">
                          {avatarPresets.map((presetUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setProfilePic(presetUrl)}
                              className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${profilePic === presetUrl ? 'border-brand-purple scale-105 shadow-sm' : 'border-transparent hover:scale-105'}`}
                            >
                              <img src={presetUrl} alt="preset" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* File Uploader Zone */}
                      <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                          isDragOver 
                            ? "border-brand-purple bg-brand-purple/5" 
                            : "border-brand-darkcream hover:border-brand-purple/40"
                        }`}
                        onClick={() => document.getElementById("profile-file-input")?.click()}
                      >
                        <Upload className="w-4 h-4 mx-auto text-brand-charcoal/40 mb-1" />
                        <span className="text-[10px] text-brand-charcoal/60 block font-semibold">
                          Drag & drop or <span className="text-brand-purple underline">browse</span>
                        </span>
                        <span className="text-[9px] text-brand-charcoal/40 block mt-0.5">PNG, JPG up to 2MB</span>
                        <input 
                          type="file" 
                          id="profile-file-input" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Display Name</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-2.5 text-brand-charcoal font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      placeholder="Your Name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Your Age</label>
                    <input 
                      type="number" 
                      value={editAge}
                      onChange={(e) => setEditAge(parseInt(e.target.value) || 24)}
                      className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-2.5 text-brand-charcoal font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      min="1"
                    />
                  </div>
                </div>

                 <div>
                  <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Gender Identification</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {["Female", "Male", "Non-binary"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setEditGender(g)}
                        className={`py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          editGender === g 
                            ? "bg-brand-purple border-brand-purple text-brand-cream" 
                            : "bg-brand-cream border-brand-darkcream text-brand-charcoal hover:bg-brand-darkcream/30"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Your Primary Skin Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {["Oily", "Dry", "Combination", "Sensitive", "Normal"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditSkinType(t as any)}
                        className={`py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer truncate ${
                          editSkinType === t 
                            ? "bg-brand-purple border-brand-purple text-brand-cream" 
                            : "bg-brand-cream border-brand-darkcream text-brand-charcoal hover:bg-brand-darkcream/30"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-1">Intolerant Skincare Substances (Separated by commas)</label>
                  <input 
                    type="text" 
                    value={editIntolerances}
                    onChange={(e) => setEditIntolerances(e.target.value)}
                    className="w-full bg-brand-cream border border-brand-darkcream rounded-xl px-4 py-2.5 text-brand-charcoal font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple"
                    placeholder="e.g. Alcohol, Fragrance, Parabens"
                  />
                  <p className="text-[10px] text-brand-charcoal/40 mt-1">If set, ingredients in routine analyzer will flag automatic warnings.</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  {saveSuccess && (
                    <span className="text-brand-green text-xs font-semibold flex items-center gap-1 animate-pulse">
                      <Check className="w-4 h-4" /> Changes Saved Successfully!
                    </span>
                  )}
                  <button
                    type="submit"
                    className="bg-brand-charcoal hover:bg-brand-purple text-white font-bold text-xs px-6 py-3 rounded-xl transition-all cursor-pointer"
                  >
                    Save Profile Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side: Plan Subscription Tiers & Upgradations */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-brand-card rounded-3xl p-6 border border-brand-darkcream/40 shadow-sm space-y-6">
                <div>
                  <h3 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-purple" />
                    Subscription Plan
                  </h3>
                  <p className="text-xs text-brand-charcoal/50">Manage your subscription, billings, and feature clearances.</p>
                </div>

                {/* Plan Grid */}
                <div className="space-y-4">
                  
                  {/* Free Plan */}
                  <div className={`p-4 rounded-2xl border-2 transition-all relative ${
                    userProfile.subscriptionTier === "Free" || !userProfile.subscriptionTier
                      ? "border-brand-purple bg-brand-lilac/10" 
                      : "border-brand-darkcream bg-brand-cream/40"
                  }`}>
                    {(userProfile.subscriptionTier === "Free" || !userProfile.subscriptionTier) && (
                      <span className="absolute top-3 right-3 text-[10px] bg-brand-purple text-brand-cream font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                    <h4 className="font-bold text-sm text-brand-charcoal">Starter (Free)</h4>
                    <p className="text-xs text-brand-purple font-semibold mt-0.5">Rs 0 / mo</p>
                    <p className="text-[11px] text-brand-charcoal/60 mt-2">10 Diagnostic Scans/month. Base local analysis reports.</p>
                  </div>

                  {/* Pro Plan */}
                  <div className={`p-4 rounded-2xl border-2 transition-all relative ${
                    userProfile.subscriptionTier === "Pro" 
                      ? "border-brand-purple bg-brand-lilac/10" 
                      : "border-brand-darkcream bg-brand-cream/40"
                  }`}>
                    {userProfile.subscriptionTier === "Pro" && (
                      <span className="absolute top-3 right-3 text-[10px] bg-brand-purple text-brand-cream font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                    <h4 className="font-bold text-sm text-brand-charcoal flex items-center gap-1.5">
                      Pro Profile
                      <BadgeCheck className="w-4 h-4 text-brand-purple" />
                    </h4>
                    <p className="text-xs text-brand-purple font-semibold mt-0.5">Rs 1500 / mo</p>
                    <p className="text-[11px] text-brand-charcoal/60 mt-2">Unlimited diagnostic scans. Complete Gemini clinical insight summary, routine calibration, and cloud sync.</p>
                    
                    {userProfile.subscriptionTier !== "Pro" && (
                      <button
                        type="button"
                        onClick={() => setUpgradeTargetTier("Pro")}
                        className="mt-3 w-full bg-brand-purple text-white text-xs font-bold py-2 rounded-xl hover:bg-brand-purple/90 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Upgrade to Pro
                      </button>
                    )}
                  </div>

                  {/* Elite Plan */}
                  <div className={`p-4 rounded-2xl border-2 transition-all relative ${
                    userProfile.subscriptionTier === "Elite" 
                      ? "border-brand-purple bg-brand-lilac/10" 
                      : "border-brand-darkcream bg-brand-cream/40"
                  }`}>
                    {userProfile.subscriptionTier === "Elite" && (
                      <span className="absolute top-3 right-3 text-[10px] bg-brand-purple text-brand-cream font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                    <h4 className="font-bold text-sm text-brand-charcoal flex items-center gap-1.5">
                      Elite Clinic
                      <BadgeCheck className="w-4 h-4 text-brand-green" />
                    </h4>
                    <p className="text-xs text-brand-purple font-semibold mt-0.5">Rs 4500 / mo</p>
                    <p className="text-[11px] text-brand-charcoal/60 mt-2">All Pro Features + 1-on-1 priority clinical reviews with certified medical dermatologists.</p>
                    
                    {userProfile.subscriptionTier !== "Elite" && (
                      <button
                        type="button"
                        onClick={() => setUpgradeTargetTier("Elite")}
                        className="mt-3 w-full bg-brand-charcoal text-white text-xs font-bold py-2 rounded-xl hover:bg-brand-purple transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Upgrade to Elite
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </div>

          </form>
        </div>
      )}

      {/* SAFEPAY CHECKOUT MODAL */}
      {upgradeTargetTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            {/* Safepay Header */}
            <div className="bg-[#14b8a6] p-4 flex items-center justify-between text-white">
              <div className="font-bold tracking-tight flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Safepay Checkout
                <span className="font-normal opacity-80 text-[10px] border border-white/40 px-1.5 py-0.5 rounded bg-white/10 uppercase">Sandbox</span>
              </div>
              <button 
                onClick={() => setUpgradeTargetTier(null)}
                className="text-white hover:text-white/80 font-bold text-lg p-1"
              >
                &times;
              </button>
            </div>

            {/* Billing details form */}
            <form onSubmit={handleSafepayUpgrade} className="p-6 space-y-4 text-brand-charcoal">
              <div>
                <p className="text-xs text-brand-charcoal/60 uppercase font-mono">Upgrading to Plan:</p>
                <p className="text-lg font-bold text-[#14b8a6]">{upgradeTargetTier} Subscription</p>
                <p className="text-xs font-semibold text-brand-charcoal/80">
                  {upgradeTargetTier === "Pro" ? "Rs 1,500 / month" : "Rs 4,500 / month"}
                </p>
              </div>

              <div className="w-full h-[1px] bg-slate-100"></div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Cardholder Name</label>
                  <input 
                    type="text" 
                    placeholder="Jane Doe" 
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Card Number</label>
                  <input 
                    type="text" 
                    placeholder="4121 •••• •••• 4545" 
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-purple font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Expiration Date</label>
                    <input 
                      type="text" 
                      placeholder="MM/YY" 
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-purple font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Security CVC</label>
                    <input 
                      type="password" 
                      placeholder="•••" 
                      maxLength={3}
                      value={cardCVC}
                      onChange={(e) => setCardCVC(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-purple font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-start gap-2 animate-pulse">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUpgradeTargetTier(null)}
                  className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="flex-[2] bg-[#14b8a6] hover:bg-[#119e8e] text-white py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isPaying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authorizing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
