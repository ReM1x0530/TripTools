import React, { useState, useEffect } from 'react';
import { Plus, Calendar, MapPin,  ArrowLeft, Trash2, Upload, Download, Coffee, Camera, Train, Bed,  Edit2, X, Sparkles, Loader2, Cloud,  AlertTriangle,  LogOut, User, Check } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// --- Configuration ---
const apiKey = ""; // Gemini API Key

// --- Firebase Setup ---
let db, auth;
let appId = 'my-travel-app';

// 🔴 您提供的設定碼
const firebaseConfig = {
  apiKey: "AIzaSyCyT9ifYfqCPg2HG-_rdqERi68yMbrgJyI",
  authDomain: "traveltool-a18b7.firebaseapp.com",
  projectId: "traveltool-a18b7",
  storageBucket: "traveltool-a18b7.firebasestorage.app",
  messagingSenderId: "539791686245",
  appId: "1:539791686245:web:b66a3b3daba4aeb341248c",
  measurementId: "G-DTYXZ2ZC6X"
};

// 初始化 Firebase
try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      const app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
  } else {
      console.warn("Firebase config is incomplete.");
  }
} catch (e) {
  console.error("Firebase init error:", e);
}

// 預設的範例資料
const DEFAULT_DATA = [
  {
    id: 'bangkok-2024',
    title: '曼谷放鬆之旅',
    startDate: '2024-02-10',
    coverImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1000&auto=format&fit=crop',
    days: {
      1: [
        { id: 'a1', time: '10:00', title: '抵達素萬那普機場', location: 'BKK Airport', type: 'transport', notes: '記得去B1搭機場快線，換錢可以在SuperRich。' },
        { id: 'a2', time: '12:00', title: '飯店 Check-in', location: 'Grande Centre Point', type: 'hotel', notes: '確認是否有迎賓飲料' },
        { id: 'a3', time: '13:30', title: '恰圖恰週末市集', location: 'Chatuchak Weekend Market', type: 'sight', notes: '必吃椰子冰淇淋，記得殺價！' },
        { id: 'a4', time: '18:00', title: '喬德夜市 Jodd Fairs', location: 'Jodd Fairs', type: 'food', notes: '火山排骨、水果西施' },
      ],
      2: [
        { id: 'b1', time: '09:00', title: '鄭王廟 (Wat Arun)', location: 'Wat Arun', type: 'sight', notes: '穿泰服拍照，搭船去N8碼頭' },
        { id: 'b2', time: '12:00', title: 'IconSiam 午餐', location: 'IconSiam', type: 'food', notes: '室內水上市場吃船麵' },
      ]
    },
    cloudId: null
  }
];

// Activity Icon Helper
const getActivityIcon = (type) => {
  switch (type) {
    case 'food': return <Coffee size={18} className="text-orange-500" />;
    case 'sight': return <Camera size={18} className="text-blue-500" />;
    case 'transport': return <Train size={18} className="text-purple-500" />;
    case 'hotel': return <Bed size={18} className="text-indigo-500" />;
    default: return <MapPin size={18} className="text-gray-500" />;
  }
};

const getActivityColor = (type) => {
  switch (type) {
    case 'food': return 'bg-orange-50 border-orange-200';
    case 'sight': return 'bg-blue-50 border-blue-200';
    case 'transport': return 'bg-purple-50 border-purple-200';
    case 'hotel': return 'bg-indigo-50 border-indigo-200';
    default: return 'bg-gray-50 border-gray-200';
  }
};

export default function App() {
  const [trips, setTrips] = useState(() => {
    const saved = localStorage.getItem('travel_trips');
    return saved ? JSON.parse(saved) : DEFAULT_DATA;
  });
  
  const [currentView, setCurrentView] = useState('list');
  const [activeTripId, setActiveTripId] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  
  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  
  // AI & Cloud State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [authError, setAuthError] = useState(null);

  // --- Auth & Persistence ---
  useEffect(() => {
    localStorage.setItem('travel_trips', JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    if (currentView === 'list') {
        setIsEditingTitle(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (!auth) return;
    
    let isMounted = true;

    const initAuth = async () => {
      try {
        if(isMounted) setAuthError(null);

        // 如果已經有登入狀態（可能是 Google 登入），就不用再匿名登入
        if (!auth.currentUser) {
             // 移除了原本的 token 檢查，直接使用匿名登入作為備案
             await signInAnonymously(auth).catch(e => console.log("Auto-anon login skipped/failed", e));
        }
      } catch (error) {
        console.warn("Auth init failed:", error.code); 
        if (isMounted) {
           if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
             // 這裡先不顯示錯誤，因為使用者可能正準備要用 Google 登入
             // setAuthError('請至 Firebase Console 開啟驗證功能');
           }
        }
      }
    };
    
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (isMounted) {
          setUser(u);
          // 如果登入成功，清除錯誤
          if (u) setAuthError(null);
      }
    });
    
    return () => {
        isMounted = false;
        unsubscribe();
    }
  }, []);

  // --- Login Handlers ---
  const handleGoogleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // 登入成功後 user state 會自動更新
    } catch (error) {
        console.error("Google login error:", error);
        if (error.code === 'auth/operation-not-allowed') {
            setAuthError('請至 Firebase Console 開啟「Google」登入功能');
        } else if (error.code === 'auth/popup-closed-by-user') {
            // 用戶關閉視窗，不做處理
        } else {
            setAuthError(`登入失敗: ${error.message}`);
        }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
        // 登出後自動切回匿名登入，保持基本功能可用
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Logout error", error);
    }
  };


  // --- Gemini API Helper ---
  const callGemini = async (prompt) => {
    setIsAiLoading(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      
      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      alert("AI 連線失敗，請稍後再試。");
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- AI Handlers ---
  const handleAiGenerateNotes = async () => {
    if (!editingItem.title && !editingItem.location) {
      alert("請先輸入名稱或地點");
      return;
    }
    const prompt = `我正在規劃去${editingItem.location || editingItem.title}的旅遊行程。請用繁體中文，給我關於這個地點的簡短旅遊攻略（50字以內），包含必吃美食、交通建議或注意事項。語氣要輕鬆像朋友一樣。直接給出內容，不要有前言。`;
    const result = await callGemini(prompt);
    if (result) {
      setEditingItem(prev => ({
        ...prev,
        notes: prev.notes ? prev.notes + '\n\n🤖 AI 補充: ' + result : result
      }));
    }
  };

  const handleAiSuggestActivity = async (currentActivities) => {
    const trip = trips.find(t => t.id === activeTripId);
    const lastActivity = currentActivities[currentActivities.length - 1];
    const context = lastActivity ? `上一個行程是 ${lastActivity.time} 在 ${lastActivity.title}` : `這一天還沒有行程，預計早上出發`;

    const prompt = `我正在${trip.title}旅行。${context}。請推薦這一天接下來的一個行程點（包含名稱、建議時間、類型）。請以 JSON 格式回傳，格式如下：{ "time": "HH:MM", "title": "地點名稱", "location": "地點 (Google Maps 關鍵字)", "type": "sight" (或 food/transport/hotel), "notes": "簡短推薦理由" } 只回傳 JSON。`;

    const result = await callGemini(prompt);
    if (result) {
      try {
        const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
        const suggestion = JSON.parse(cleanJson);
        const newActivity = { ...suggestion, id: Date.now().toString() };
        setEditingItem(newActivity);
        setCurrentView('edit_activity');
      } catch (e) {
        console.error("Parse Error", e);
        alert("AI 格式解析錯誤，請重試");
      }
    }
  };

  // --- Cloud Sync Handlers ---
  const generateSyncCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const checkAuth = () => {
      if (authError) {
          alert(`⚠️ 無法連線雲端\n原因：${authError}\n請檢查 Firebase Console 設定。`);
          return false;
      }
      if (!user) {
          alert("正在連線中，請稍候...");
          return false;
      }
      return true;
  };

  const handleUploadToCloud = async (trip) => {
    if (!checkAuth()) return;
    if (!db) return;
    
    setIsSyncing(true);
    try {
        const syncCode = trip.cloudId || generateSyncCode();
        
        // 使用 user.uid 記錄是誰更新的
        const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', syncCode);
        
        await setDoc(tripRef, {
            ...trip,
            cloudId: syncCode,
            lastUpdated: new Date().toISOString(),
            updatedBy: user.uid,
            updaterName: user.displayName || 'Anonymous' // 記錄更新者名稱
        });

        const updatedTrip = { ...trip, cloudId: syncCode };
        updateTrip(updatedTrip);

        alert(`☁️ 上傳成功！\n您的同步代碼是：${syncCode}\n(已綁定您的帳號: ${user.displayName || '訪客'})`);
    } catch (error) {
        console.error("Upload error:", error);
        alert("上傳失敗：" + error.message);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDownloadFromCloud = async () => {
    if (!checkAuth()) return;
    if (!db) return;
    if (!syncCodeInput) {
        alert("請輸入同步代碼");
        return;
    }

    setIsSyncing(true);
    try {
        const syncCode = syncCodeInput.toUpperCase().trim();
        const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', syncCode);
        const docSnap = await getDoc(tripRef);

        if (docSnap.exists()) {
            const cloudTrip = docSnap.data();
            const existingIndex = trips.findIndex(t => t.cloudId === syncCode || t.id === cloudTrip.id);
            
            let newTrips = [...trips];
            if (existingIndex >= 0) {
                if(window.confirm(`發現相同代碼的行程「${cloudTrip.title}」，確定要覆蓋本地版本嗎？`)) {
                    newTrips[existingIndex] = cloudTrip;
                } else {
                    return; 
                }
            } else {
                newTrips.push(cloudTrip);
            }
            
            setTrips(newTrips);
            alert("📥 下載成功！行程已更新。");
            setSyncCodeInput('');
            setShowCloudModal(false);
        } else {
            alert("❌ 找不到此代碼的行程，請確認代碼是否正確。");
        }
    } catch (error) {
        console.error("Download error:", error);
        alert("下載失敗：" + error.message);
    } finally {
        setIsSyncing(false);
    }
  };

  // --- Basic Trip Handlers ---
  const handleCreateTrip = () => {
    const newId = Date.now().toString();
    const newTrip = {
      id: newId,
      title: '新旅程',
      startDate: new Date().toISOString().split('T')[0],
      days: { 1: [] },
      cloudId: null
    };
    setTrips([...trips, newTrip]);
    setActiveTripId(newId);
    setCurrentView('detail');
  };

  const handleDeleteTrip = (e, id) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除這個行程嗎？')) {
      setTrips(trips.filter(t => t.id !== id));
      if (activeTripId === id) setCurrentView('list');
    }
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
       const trip = trips.find(t => t.id === activeTripId);
       updateTrip({...trip, title: tempTitle});
    }
    setIsEditingTitle(false);
  };

  const handleAddDay = () => {
    const trip = trips.find(t => t.id === activeTripId);
    const dayCount = Object.keys(trip.days).length;
    const updatedTrip = { ...trip, days: { ...trip.days, [dayCount + 1]: [] } };
    updateTrip(updatedTrip);
    setActiveDay(dayCount + 1);
  };

  const updateTrip = (updatedTrip) => {
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleSaveActivity = (activity) => {
    const trip = trips.find(t => t.id === activeTripId);
    const dayActivities = trip.days[activeDay] || [];
    let newActivities;
    if (editingItem && editingItem.id) {
      newActivities = dayActivities.map(a => a.id === activity.id ? activity : a);
    } else {
      newActivities = [...dayActivities, { ...activity, id: Date.now().toString() }];
    }
    newActivities.sort((a, b) => a.time.localeCompare(b.time));
    const updatedTrip = { ...trip, days: { ...trip.days, [activeDay]: newActivities } };
    updateTrip(updatedTrip);
    setCurrentView('detail');
    setEditingItem(null);
  };

  const handleDeleteActivity = (activityId) => {
    if(!window.confirm("確定刪除此活動?")) return;
    const trip = trips.find(t => t.id === activeTripId);
    const updatedTrip = {
      ...trip,
      days: { ...trip.days, [activeDay]: trip.days[activeDay].filter(a => a.id !== activityId) }
    };
    updateTrip(updatedTrip);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(trips);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'travel_data.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          setTrips(imported);
          alert('匯入成功！');
        } else {
          alert('格式錯誤');
        }
      } catch (err) {
        alert('檔案讀取失敗');
      }
    };
    reader.readAsText(file);
  };

  // --- Render Functions ---

  const renderCloudModal = () => (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center text-teal-700">
                      <Cloud className="mr-2" /> 雲端同步中心
                  </h3>
                  <button onClick={() => setShowCloudModal(false)}><X className="text-gray-400" /></button>
              </div>

              {/* Login Status Section */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-gray-700 mb-2 text-sm">您的身份</h4>
                  {user && !user.isAnonymous ? (
                      <div className="flex items-center justify-between">
                          <div className="flex items-center">
                              {user.photoURL ? (
                                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full mr-2" />
                              ) : (
                                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center mr-2 text-teal-600 font-bold">
                                      {user.displayName?.[0] || 'U'}
                                  </div>
                              )}
                              <div className="text-sm">
                                  <div className="font-bold text-gray-800">{user.displayName}</div>
                                  <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                          </div>
                          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500" title="登出">
                              <LogOut size={16} />
                          </button>
                      </div>
                  ) : (
                      <div className="flex items-center justify-between">
                          <div className="flex items-center text-gray-500 text-sm">
                              <User size={16} className="mr-2" />
                              <span>目前為：訪客 (匿名)</span>
                          </div>
                          <button 
                              onClick={handleGoogleLogin}
                              className="flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700 shadow-sm"
                          >
                              <img src="https://www.google.com/favicon.ico" alt="G" className="w-3 h-3 mr-1.5" />
                              Google 登入
                          </button>
                      </div>
                  )}
                  {authError && (
                      <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded flex items-start">
                           <AlertTriangle size={12} className="mr-1 mt-0.5 flex-shrink-0" />
                           {authError}
                      </div>
                  )}
              </div>

              <div className="space-y-6">
                  <div className={`bg-white p-0 ${authError ? 'opacity-50 pointer-events-none' : ''}`}>
                      <h4 className="font-bold text-gray-700 mb-2 flex items-center">
                          <Download size={16} className="mr-1" /> 下載行程
                      </h4>
                      <div className="flex space-x-2">
                          <input 
                              type="text" 
                              placeholder="輸入代碼 (如: X9A2)" 
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                              value={syncCodeInput}
                              onChange={(e) => setSyncCodeInput(e.target.value)}
                          />
                          <button 
                              onClick={handleDownloadFromCloud}
                              disabled={isSyncing}
                              className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 text-sm"
                          >
                              {isSyncing ? <Loader2 className="animate-spin" /> : '下載'}
                          </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">輸入朋友分享的代碼，或您在電腦上產生的代碼。</p>
                  </div>

                  <div className="border-t border-gray-100 pt-4 text-center">
                      <button 
                        onClick={() => document.getElementById('file-upload').click()}
                        className="text-teal-600 text-sm font-medium hover:underline flex items-center justify-center w-full"
                      >
                        <Upload size={14} className="mr-1" />
                        匯入本機 JSON 檔案
                      </button>
                      <input id="file-upload" type="file" className="hidden" accept=".json" onChange={handleImport} />
                  </div>
              </div>
          </div>
      </div>
  );

  const renderTripList = () => (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <header className="bg-teal-600 text-white p-6 rounded-b-3xl shadow-lg mb-6 flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold mb-1">我的旅程</h1>
            <p className="opacity-90 text-xs flex items-center">
                {user && !user.isAnonymous ? `Hi, ${user.displayName}` : 'AI 助手 & 雲端同步 Ready'}
            </p>
        </div>
        <div className="flex space-x-2">
            <button 
                onClick={() => setShowCloudModal(true)}
                className="p-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors relative overflow-hidden w-10 h-10 flex items-center justify-center"
            >
                {user && user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                    <Cloud size={20} className="text-white" />
                )}
                {authError && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-teal-600"></div>}
            </button>
        </div>
      </header>
      
      <div className="px-4 space-y-4">
        {trips.map(trip => (
          <div 
            key={trip.id}
            onClick={() => { setActiveTripId(trip.id); setActiveDay(1); setCurrentView('detail'); }}
            className="bg-white rounded-2xl shadow-sm p-4 active:scale-95 transition-transform cursor-pointer border border-gray-100 relative overflow-hidden group"
          >
            <div className="absolute right-4 top-4 flex space-x-2">
               {trip.cloudId && (
                   <span className="bg-teal-50 text-teal-600 text-[10px] px-2 py-1 rounded-full font-bold flex items-center">
                       <Cloud size={10} className="mr-1" /> {trip.cloudId}
                   </span>
               )}
               <button 
                onClick={(e) => handleDeleteTrip(e, trip.id)}
                className="p-2 bg-red-50 text-red-400 rounded-full hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <Trash2 size={16} />
               </button>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                 {trip.coverImage ? (
                   <img src={trip.coverImage} alt="cover" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center bg-teal-100 text-teal-600">
                     <MapPin />
                   </div>
                 )}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800">{trip.title}</h3>
                <div className="flex items-center text-gray-500 text-sm mt-1">
                  <Calendar size={14} className="mr-1" />
                  {trip.startDate}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  共 {Object.keys(trip.days).length} 天
                </div>
              </div>
            </div>
          </div>
        ))}

        <button 
          onClick={handleCreateTrip}
          className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-medium flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          建立新行程
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-around text-xs text-gray-500">
         <div className="flex flex-col items-center cursor-pointer" onClick={handleExport}>
            <Download size={20} className="mb-1 text-teal-600" />
            <span>備份資料</span>
         </div>
         <div className="flex flex-col items-center cursor-pointer" onClick={() => setShowCloudModal(true)}>
            <Cloud size={20} className="mb-1 text-teal-600" />
            <span>雲端同步</span>
         </div>
      </div>
      
      {showCloudModal && renderCloudModal()}
    </div>
  );

  const renderTripDetail = () => {
    const trip = trips.find(t => t.id === activeTripId);
    const days = Object.keys(trip.days).map(Number).sort((a,b) => a-b);
    const currentActivities = trip.days[activeDay] || [];

    return (
      <div className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <div className="p-4 flex items-center justify-between">
            <button onClick={() => setCurrentView('list')} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            
            <div className="flex-1 px-2 overflow-hidden flex flex-col items-center justify-center">
                {isEditingTitle ? (
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <input 
                            type="text" 
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-center text-sm w-32 font-bold text-gray-800 px-1 focus:outline-none"
                            autoFocus
                        />
                        <button onClick={handleSaveTitle} className="p-1 text-teal-600 hover:bg-white rounded-full"><Check size={14}/></button>
                        <button onClick={() => setIsEditingTitle(false)} className="p-1 text-red-500 hover:bg-white rounded-full"><X size={14}/></button>
                    </div>
                ) : (
                    <>
                        <h2 className="font-bold text-lg text-gray-800 truncate text-center max-w-[200px]">{trip.title}</h2>
                        {trip.cloudId && (
                            <div className="flex justify-center items-center text-[10px] text-teal-600 font-medium cursor-pointer" onClick={() => alert(`同步代碼: ${trip.cloudId}`)}>
                                <Cloud size={10} className="mr-1" /> {trip.cloudId}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center">
                 <button 
                  onClick={() => handleUploadToCloud(trip)}
                  className="p-2 hover:bg-teal-50 rounded-full text-teal-600 mr-1"
                  title="上傳更新到雲端"
                >
                  {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                </button>
                
                {!isEditingTitle && (
                    <button 
                      onClick={() => {
                        setTempTitle(trip.title);
                        setIsEditingTitle(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <Edit2 size={18} className="text-gray-600" />
                    </button>
                )}
            </div>
          </div>

          {/* Days Scroller */}
          <div className="flex overflow-x-auto px-4 pb-2 scrollbar-hide space-x-3">
            {days.map(d => (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeDay === d 
                  ? 'bg-teal-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Day {d}
              </button>
            ))}
            <button 
              onClick={handleAddDay}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 hover:bg-gray-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 p-4 pb-24 relative">
            
          {/* AI Suggestion Bar */}
          <div className="mb-4">
             <button
                onClick={() => handleAiSuggestActivity(currentActivities)}
                disabled={isAiLoading}
                className="w-full py-2 bg-gradient-to-r from-violet-100 to-indigo-100 text-indigo-700 rounded-xl text-sm font-bold flex items-center justify-center border border-indigo-200 shadow-sm"
             >
                {isAiLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
                {isAiLoading ? 'AI 正在思考最佳行程...' : 'AI 推薦下一個行程'}
             </button>
          </div>

          {currentActivities.length === 0 ? (
            <div className="text-center mt-20 text-gray-400">
              <div className="text-4xl mb-4">🌴</div>
              <p>這天還沒有安排行程</p>
              <p className="text-sm mt-2">使用上方 AI 推薦或右下角新增</p>
            </div>
          ) : (
            <div className="space-y-6 relative">
              {/* Vertical Line */}
              <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-200"></div>
              
              {currentActivities.map((item, index) => (
                <div key={item.id} className="relative flex group">
                  {/* Time Node */}
                  <div className="flex flex-col items-center mr-4 z-10 w-[55px] flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500 mb-1">{item.time}</span>
                    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${item.type === 'food' ? 'bg-orange-500' : item.type === 'transport' ? 'bg-purple-500' : 'bg-teal-500'}`}></div>
                  </div>

                  {/* Card */}
                  <div 
                    className={`flex-1 rounded-2xl p-4 border ${getActivityColor(item.type)} active:scale-[0.98] transition-transform`}
                    onClick={() => {
                        setEditingItem(item);
                        setCurrentView('edit_activity');
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center text-xs font-semibold uppercase tracking-wider opacity-60">
                        {getActivityIcon(item.type)}
                        <span className="ml-1">{item.type === 'food' ? '美食' : item.type === 'sight' ? '景點' : item.type === 'transport' ? '交通' : '住宿'}</span>
                      </div>
                      <div className="flex space-x-1">
                        <button 
                           onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.location}`); }}
                           className="p-1.5 bg-white/50 rounded-full hover:bg-white text-blue-600"
                        >
                            <MapPin size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-800 text-lg">{item.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 flex items-center">
                        <MapPin size={12} className="mr-1 inline" /> {item.location}
                    </p>
                    
                    {item.notes && (
                        <div className="mt-3 pt-3 border-t border-black/5 text-sm text-gray-600 bg-white/30 rounded p-2 whitespace-pre-line">
                            📝 {item.notes}
                        </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Add Button */}
        <button 
          onClick={() => { setEditingItem({}); setCurrentView('edit_activity'); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 active:scale-90 transition-all z-20"
        >
          <Plus size={28} />
        </button>
      </div>
    );
  };

  const renderActivityEditor = () => {
    const isEdit = !!editingItem.id;
    return (
      <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
         <div className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
            <button onClick={() => setCurrentView('detail')} className="p-2"><X size={24} /></button>
            <h2 className="font-bold text-lg">{isEdit ? '編輯活動' : '新增活動'}</h2>
            <button 
                onClick={() => handleSaveActivity(editingItem)}
                disabled={!editingItem.title || !editingItem.time}
                className="text-teal-600 font-bold disabled:opacity-50"
            >
                儲存
            </button>
         </div>

         <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            {/* Type Selector */}
            <div className="grid grid-cols-4 gap-3">
                {['sight', 'food', 'transport', 'hotel'].map(type => (
                    <button
                        key={type}
                        onClick={() => setEditingItem({...editingItem, type})}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                            editingItem.type === type 
                            ? 'border-teal-500 bg-teal-50 text-teal-700' 
                            : 'border-transparent bg-white text-gray-500'
                        }`}
                    >
                        {getActivityIcon(type)}
                        <span className="text-xs mt-1 font-medium">
                            {type === 'food' ? '美食' : type === 'sight' ? '景點' : type === 'transport' ? '交通' : '住宿'}
                        </span>
                    </button>
                ))}
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">時間</label>
                    <input 
                        type="time" 
                        value={editingItem.time || ''}
                        onChange={e => setEditingItem({...editingItem, time: e.target.value})}
                        className="w-full text-2xl font-bold text-gray-800 focus:outline-none"
                    />
                </div>
                <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-400 mb-1">名稱</label>
                    <input 
                        type="text" 
                        placeholder="例如：大皇宮、路邊攤"
                        value={editingItem.title || ''}
                        onChange={e => setEditingItem({...editingItem, title: e.target.value})}
                        className="w-full text-lg font-medium text-gray-800 focus:outline-none placeholder-gray-300"
                    />
                </div>
                <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-400 mb-1">地點 (用於 Google Maps)</label>
                    <div className="flex items-center">
                        <MapPin size={16} className="text-gray-400 mr-2" />
                        <input 
                            type="text" 
                            placeholder="輸入地點名稱或地址"
                            value={editingItem.location || ''}
                            onChange={e => setEditingItem({...editingItem, location: e.target.value})}
                            className="w-full text-base text-gray-700 focus:outline-none placeholder-gray-300"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm relative">
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-gray-400">備註 / 攻略</label>
                    <button 
                        onClick={handleAiGenerateNotes}
                        disabled={isAiLoading || (!editingItem.title && !editingItem.location)}
                        className="flex items-center space-x-1 text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full font-bold disabled:opacity-50"
                    >
                        {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        <span>AI 攻略</span>
                    </button>
                </div>
                <textarea 
                    rows={6}
                    placeholder="輸入必吃菜單、交通注意、門票價格..."
                    value={editingItem.notes || ''}
                    onChange={e => setEditingItem({...editingItem, notes: e.target.value})}
                    className="w-full text-base text-gray-700 focus:outline-none placeholder-gray-300 resize-none"
                />
            </div>

            {isEdit && (
                <button 
                    onClick={() => { handleDeleteActivity(editingItem.id); setCurrentView('detail'); }}
                    className="w-full py-3 text-red-500 bg-white rounded-xl shadow-sm font-medium hover:bg-red-50"
                >
                    刪除此活動
                </button>
            )}
         </div>
      </div>
    );
  };

  return (
    <div className="font-sans text-gray-900 bg-gray-50 min-h-screen select-none">
      {currentView === 'list' && renderTripList()}
      {currentView === 'detail' && renderTripDetail()}
      {currentView === 'edit_activity' && renderActivityEditor()}
    </div>
  );
}