import React, { useState, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, query, where, setDoc, onSnapshot, runTransaction, arrayUnion } from 'firebase/firestore';
import './App.css';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDoLr3Dnb5YbCnUtTexaz84YOH5h8Ukfoc",
  authDomain: "frist-b073a.firebaseapp.com",
  projectId: "frist-b073a",
  storageBucket: "frist-b073a.appspot.com",
  messagingSenderId: "580630150830",
  appId: "1:580630150830:web:815ba6942a64909329b73f",
  measurementId: "G-GH3D6EMB6L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function Timer({ user, onBack, groupId }) {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('ar');
  const [notification, setNotification] = useState(null);
  const [studySessions, setStudySessions] = useState([]);

  // Calculate user level with exponential growth
  const calculateLevel = (points) => {
    const base = 100;
    const growthFactor = 1.15;
    
    let level = 1;
    let requiredPoints = base;
    let totalPointsNeeded = base;
    
    while (points >= totalPointsNeeded) {
      level++;
      requiredPoints = Math.floor(requiredPoints * growthFactor);
      totalPointsNeeded += requiredPoints;
    }
    
    const pointsForCurrentLevel = points - (totalPointsNeeded - requiredPoints);
    
    return {
      currentLevel: level,
      nextLevelPoints: requiredPoints,
      progress: (pointsForCurrentLevel / requiredPoints) * 100,
      pointsToNextLevel: requiredPoints - pointsForCurrentLevel
    };
  };

  const { currentLevel, progress, pointsToNextLevel } = calculateLevel(points);

  // Toggle dark/light theme
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    showNotification(newMode ? 'تم تفعيل الوضع المظلم' : 'تم تفعيل الوضع الفاتح');
  };

  // Change language
  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    showNotification(lang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English');
  };

  // Show notification
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Format time as HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add study session to history
  const addStudySession = (duration, pointsEarned) => {
    const newSession = {
      date: new Date(),
      duration,
      pointsEarned
    };
    setStudySessions(prev => [newSession, ...prev].slice(0, 10));
  };

  // Update points in Firestore
  const updatePoints = async (newPoints) => {
    try {
      const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
      if (groupDoc.exists() && !groupDoc.data().bannedMembers?.includes(user.uid)) {
        await updateDoc(doc(db, "studyGroups", groupId), {
          [`userPoints.${user.uid}`]: newPoints
        });
      }
    } catch (error) {
      console.error("Error updating points:", error);
    }
  };

  // Fetch group data
  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        setLoadingMembers(true);
        const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setIsCreator(groupData.creator === user.uid);
          setBannedMembers(groupData.bannedMembers || []);
          
          const userPoints = groupData.userPoints?.[user.uid] || 0;
          setPoints(userPoints);
          
          if (groupData.members) {
            const membersPromises = groupData.members.map(async (uid) => {
              const userDoc = await getDoc(doc(db, "users", uid));
              if (userDoc.exists()) {
                return {
                  uid,
                  name: userDoc.data().displayName,
                  photoURL: userDoc.data().photoURL,
                  points: groupData.userPoints?.[uid] || 0
                };
              }
              return null;
            });
            
            const membersList = (await Promise.all(membersPromises)).filter(Boolean);
            membersList.sort((a, b) => b.points - a.points);
            setMembers(membersList);
          }
        }
      } catch (error) {
        console.error("Error fetching group data:", error);
      } finally {
        setLoadingMembers(false);
      }
    };
    
    fetchGroupData();
    
    const unsubscribe = onSnapshot(doc(db, "studyGroups", groupId), fetchGroupData);
    return () => unsubscribe();
  }, [groupId, user.uid]);

  // Simulate online users
  useEffect(() => {
    const interval = setInterval(() => {
      const randomOnline = members
        .filter(() => Math.random() > 0.7)
        .map(member => member.uid);
      setOnlineUsers(randomOnline);
    }, 10000);

    return () => clearInterval(interval);
  }, [members]);

  // Timer logic
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Points and level up logic
  useEffect(() => {
    if (isRunning && time > 0 && time % 30 === 0 && time !== lastUpdateTime) {
      const newPoints = points + 1;
      setPoints(newPoints);
      updatePoints(newPoints);
      setLastUpdateTime(time);
      
      // Check for level up
      const newLevelData = calculateLevel(newPoints);
      if (newLevelData.currentLevel > currentLevel) {
        showNotification(`🎉 تقدمت للمستوى ${newLevelData.currentLevel}!`);
      }
    }
  }, [time, isRunning]);

  // Load theme and language preferences
  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedMode ? 'dark' : 'light');
    }

    const savedLang = localStorage.getItem('language') || 'ar';
    setLanguage(savedLang);
  }, []);

  // Remove member from group
  const removeMember = async (memberId) => {
    if (window.confirm(`هل أنت متأكد من حذف هذا العضو من المجموعة؟`)) {
      try {
        await runTransaction(db, async (transaction) => {
          const groupDoc = await transaction.get(doc(db, "studyGroups", groupId));
          if (!groupDoc.exists()) throw new Error("المجموعة غير موجودة");
          
          const groupData = groupDoc.data();
          const updatedMembers = groupData.members.filter(m => m !== memberId);
          const updatedUserPoints = {...groupData.userPoints};
          delete updatedUserPoints[memberId];
          
          transaction.update(doc(db, "studyGroups", groupId), {
            members: updatedMembers,
            userPoints: updatedUserPoints
          });
        });
        showNotification("تم حذف العضو بنجاح");
      } catch (error) {
        console.error("Error removing member:", error);
        showNotification("حدث خطأ أثناء حذف العضو");
      }
    }
  };

  // Ban/unban member
  const toggleBanMember = async (memberId) => {
    if (window.confirm(`هل أنت متأكد من ${bannedMembers.includes(memberId) ? 'إلغاء حظر' : 'حظر'} هذا العضو؟`)) {
      try {
        await runTransaction(db, async (transaction) => {
          const groupDoc = await transaction.get(doc(db, "studyGroups", groupId));
          if (!groupDoc.exists()) throw new Error("المجموعة غير موجودة");
          
          const groupData = groupDoc.data();
          const currentBanned = groupData.bannedMembers || [];
          const isBanned = currentBanned.includes(memberId);
          
          const updatedBanned = isBanned 
            ? currentBanned.filter(id => id !== memberId)
            : [...currentBanned, memberId];
          
          const updates = {
            bannedMembers: updatedBanned,
            banHistory: arrayUnion({
              memberId: memberId,
              bannedBy: user.uid,
              timestamp: new Date(),
              action: isBanned ? "unban" : "ban"
            })
          };
          
          if (!isBanned) {
            updates[`userPoints.${memberId}`] = 0;
          }
          
          transaction.update(doc(db, "studyGroups", groupId), updates);
        });
        
        showNotification(`تم ${bannedMembers.includes(memberId) ? 'إلغاء حظر' : 'حظر'} العضو بنجاح`);
      } catch (error) {
        console.error("Error updating banned members:", error);
        showNotification("حدث خطأ أثناء تحديث قائمة الحظر");
      }
    }
  };

  // Reset timer and save session
  const resetTimer = () => {
    if (time > 0) {
      addStudySession(time, Math.floor(time / 30));
    }
    setIsRunning(false);
    setTime(0);
  };

  return (
    <div className="timer-container">
      {/* Header Section */}
      <div className="timer-header">
        <button onClick={onBack} className="back-button">
          ← العودة للمجموعات
        </button>
        
        <div className="user-info" onClick={() => setShowProfileMenu(!showProfileMenu)}>
          <div className="avatar-container">
            <img src={user.photoURL} alt="صورة المستخدم" className="user-avatar" />
            {onlineUsers.includes(user.uid) && <div className="online-status"></div>}
          </div>
          <span className="user-display-name">{user.displayName}</span>
          {bannedMembers.includes(user.uid) && (
            <span className="banned-warning">(حسابك محظور)</span>
          )}
        </div>
      </div>

      {/* Profile Menu */}
      {showProfileMenu && (
        <div className="profile-menu">
          <div className="menu-item" onClick={() => {
            setShowProfileModal(true);
            setShowProfileMenu(false);
          }}>
            الملف الشخصي
          </div>
          <div className="menu-item" onClick={() => {
            setShowSettingsModal(true);
            setShowProfileMenu(false);
          }}>
            الإعدادات
          </div>
        </div>
      )}

      {/* Main Timer Display */}
      <div className="timer-display">
        <div className="time-display">
          <h2>وقت المذاكرة</h2>
          <div className="time">{formatTime(time)}</div>
        </div>
        
        <div className="stats-display">
          <div className="stat-box">
            <span className="stat-label">النقاط</span>
            <span className="stat-value">{points}</span>
          </div>
          
          <div className="stat-box">
            <span className="stat-label">المستوى</span>
            <span className="stat-value">{currentLevel}</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-label">
            <span>التقدم للمستوى {currentLevel + 1}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {pointsToNextLevel} نقطة متبقية للوصول للمستوى التالي
          </div>
        </div>
        
        {/* Timer Controls */}
        <div className="timer-controls">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`control-button ${isRunning ? 'pause-button' : 'start-button'}`}
            disabled={bannedMembers.includes(user.uid)}
          >
            {isRunning ? 'إيقاف' : 'بدء'}
          </button>
          
          <button 
            onClick={resetTimer}
            className="control-button reset-button"
          >
            إعادة تعيين
          </button>
          
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="control-button members-button"
          >
            {showMembers ? 'إخفاء الأعضاء' : 'عرض الأعضاء'}
          </button>
        </div>
      </div>

      {/* Members Sidebar */}
      {showMembers && (
        <div className="members-sidebar">
          <h3>ترتيب المجموعة</h3>
          
          {loadingMembers ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>جاري تحميل الأعضاء...</p>
            </div>
          ) : (
            <>
              <div className="leaderboard">
                {members
                  .filter(member => !bannedMembers.includes(member.uid))
                  .map((member, index) => (
                    <div key={member.uid} className={`member-item ${member.uid === user.uid ? 'current-user' : ''}`}>
                      <span className="member-rank">{index + 1}</span>
                      
                      <div className="avatar-container">
                        <img src={member.photoURL} alt={member.name} className="member-avatar" />
                        {onlineUsers.includes(member.uid) && <div className="online-status"></div>}
                      </div>
                      
                      <div className="member-info">
                        <span className="member-name">{member.name}</span>
                        <span className="member-points">{member.points} نقطة</span>
                      </div>
                      
                      {isCreator && member.uid !== user.uid && (
                        <div className="member-actions">
                          <button 
                            onClick={() => toggleBanMember(member.uid)}
                            className="ban-button"
                            title={bannedMembers.includes(member.uid) ? "إلغاء الحظر" : "حظر العضو"}
                          >
                            {bannedMembers.includes(member.uid) ? "🚫" : "⛔"}
                          </button>
                          <button 
                            onClick={() => removeMember(member.uid)}
                            className="remove-button"
                            title="حذف العضو"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
              
              {bannedMembers.length > 0 && (
                <div className="banned-section">
                  <h4>الأعضاء المحظورين</h4>
                  {members
                    .filter(member => bannedMembers.includes(member.uid))
                    .map((member) => (
                      <div key={member.uid} className="member-item banned-member">
                        <div className="avatar-container">
                          <img src={member.photoURL} alt={member.name} className="member-avatar" />
                        </div>
                        
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="banned-label">محظور</span>
                        </div>
                        
                        {isCreator && (
                          <button 
                            onClick={() => toggleBanMember(member.uid)}
                            className="unban-button"
                          >
                            إلغاء الحظر
                          </button>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setShowProfileModal(false)}>
              &times;
            </button>
            
            <div className="profile-header">
              <img src={user.photoURL} alt="صورة الملف الشخصي" className="profile-avatar" />
              <h2>{user.displayName}</h2>
              <p className="user-level">المستوى {currentLevel}</p>
            </div>
            
            <div className="profile-stats">
              <div className="stat-row">
                <span className="stat-label">إجمالي النقاط:</span>
                <span className="stat-value">{points}</span>
              </div>
              
              <div className="stat-row">
                <span className="stat-label">إجمالي وقت الدراسة:</span>
                <span className="stat-value">{Math.floor(time / 3600)} ساعة</span>
              </div>
              
              <div className="stat-row">
                <span className="stat-label">النقاط للوصول للمستوى التالي:</span>
                <span className="stat-value">{pointsToNextLevel}</span>
              </div>
            </div>
            
            {studySessions.length > 0 && (
              <div className="sessions-history">
                <h3>آخر جلسات الدراسة</h3>
                <div className="sessions-list">
                  {studySessions.map((session, index) => (
                    <div key={index} className="session-item">
                      <span className="session-date">
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                      <span className="session-duration">
                        {formatTime(session.duration)}
                      </span>
                      <span className="session-points">
                        +{session.pointsEarned} نقطة
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setShowSettingsModal(false)}>
              &times;
            </button>
            
            <h2>الإعدادات</h2>
            
            <div className="settings-option">
              <span>الوضع المظلم:</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={toggleDarkMode}
                />
                <span className="slider round"></span>
              </label>
            </div>
            
            <div className="settings-option">
              <span>اللغة:</span>
              <select 
                value={language} 
                onChange={(e) => changeLanguage(e.target.value)}
                className="language-select"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            
            <button 
              className="logout-button"
              onClick={() => {
                signOut(auth);
                setShowSettingsModal(false);
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('ar');
  const [notification, setNotification] = useState(null);

  // Show notification
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Toggle dark/light theme
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    showNotification(newMode ? 'تم تفعيل الوضع المظلم' : 'تم تفعيل الوضع الفاتح');
  };

  // Load theme preference
  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedMode ? 'dark' : 'light');
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await setDoc(doc(db, "users", currentUser.uid), {
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          email: currentUser.email,
          lastLogin: new Date()
        }, { merge: true });
        
        setUser(currentUser);
        await fetchUserGroups(currentUser.uid);
      } else {
        setUser(null);
        setGroups([]);
        setSelectedGroup(null);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Fetch user's groups
  const fetchUserGroups = async (userId) => {
    setLoadingGroups(true);
    try {
      const q = query(
        collection(db, "studyGroups"),
        where("members", "array-contains", userId)
      );
      
      const querySnapshot = await getDocs(q);
      const groupsArray = [];
      
      const groupsPromises = querySnapshot.docs.map(async (docSnap) => {
        const groupData = docSnap.data();
        
        if (groupData.bannedMembers?.includes(userId)) {
          return null;
        }
        
        const creatorDoc = await getDoc(doc(db, "users", groupData.creator));
        const creatorName = creatorDoc.exists() ? creatorDoc.data().displayName : "مستخدم غير معروف";
        
        return { 
          id: docSnap.id, 
          ...groupData,
          creatorName,
          code: docSnap.id.slice(0, 6).toUpperCase(),
          isCreator: groupData.creator === userId
        };
      });
      
      const groups = (await Promise.all(groupsPromises)).filter(Boolean);
      setGroups(groups);
      
      if (selectedGroup && !groups.some(g => g.id === selectedGroup)) {
        setSelectedGroup(null);
      }
    } catch (error) {
      console.error("Error fetching user groups:", error);
      showNotification("حدث خطأ أثناء جلب المجموعات");
    } finally {
      setLoadingGroups(false);
    }
  };

  // Google login
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      showNotification(`مرحباً ${result.user.displayName}!`);
    } catch (error) {
      console.error("Error signing in:", error);
      showNotification("حدث خطأ أثناء تسجيل الدخول");
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification("تم تسجيل الخروج بنجاح");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Create new group
  const addStudyGroup = async () => {
    if (!groupName.trim()) {
      showNotification("الرجاء إدخال اسم المجموعة");
      return;
    }
    
    try {
      const newGroup = {
        name: groupName.trim(),
        createdAt: new Date(),
        creator: user.uid,
        members: [user.uid],
        userPoints: { [user.uid]: 0 },
        bannedMembers: []
      };
      
      await addDoc(collection(db, "studyGroups"), newGroup);
      setGroupName('');
      showNotification(`تم إنشاء مجموعة "${groupName.trim()}" بنجاح`);
      await fetchUserGroups(user.uid);
    } catch (error) {
      console.error("Error adding group:", error);
      showNotification("حدث خطأ أثناء إنشاء المجموعة");
    }
  };

  // Delete group
  const deleteGroup = async (groupId) => {
    if (window.confirm("هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع بياناتها نهائياً")) {
      try {
        const groupItem = document.getElementById(`group-${groupId}`);
        if (groupItem) {
          groupItem.style.transform = 'scale(0.9)';
          groupItem.style.opacity = '0.5';
          groupItem.style.transition = 'all 0.3s ease';
          groupItem.style.animation = 'shake 0.5s';
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await deleteDoc(doc(db, "studyGroups", groupId));
        showNotification("تم حذف المجموعة بنجاح");
        await fetchUserGroups(user.uid);
      } catch (error) {
        console.error("Error deleting group:", error);
        showNotification("حدث خطأ أثناء حذف المجموعة");
      }
    }
  };

  // Join group by code
  const joinGroupByCode = async () => {
    if (!joinCode.trim()) {
      showNotification("الرجاء إدخال كود المجموعة");
      return;
    }
    
    try {
      const allGroupsQuery = collection(db, "studyGroups");
      const allGroupsSnapshot = await getDocs(allGroupsQuery);
      
      let groupToJoin = null;
      allGroupsSnapshot.forEach(doc => {
        const groupCode = doc.id.slice(0, 6).toUpperCase();
        if (groupCode === joinCode.toUpperCase().trim()) {
          groupToJoin = { 
            id: doc.id, 
            ...doc.data(),
            code: groupCode
          };
        }
      });
      
      if (groupToJoin) {
        if (groupToJoin.bannedMembers?.includes(user.uid)) {
          showNotification(`أنت محظور من هذه المجموعة (${groupToJoin.name})`);
          return;
        }
        
        if (groupToJoin.members && groupToJoin.members.includes(user.uid)) {
          setSelectedGroup(groupToJoin.id);
          setShowJoinModal(false);
          setJoinCode('');
          return;
        }
        
        await updateDoc(doc(db, "studyGroups", groupToJoin.id), {
          [`userPoints.${user.uid}`]: 0,
          members: [...(groupToJoin.members || []), user.uid]
        });
        
        setSelectedGroup(groupToJoin.id);
        setShowJoinModal(false);
        setJoinCode('');
        showNotification(`تم الانضمام إلى مجموعة "${groupToJoin.name}"`);
        await fetchUserGroups(user.uid);
      } else {
        showNotification("لا توجد مجموعة بهذا الكود");
      }
    } catch (error) {
      console.error("Error joining group:", error);
      showNotification("حدث خطأ أثناء الانضمام للمجموعة");
    }
  };

  // Handle join group
  const handleJoinGroup = (groupId) => {
    setSelectedGroup(groupId);
  };

  // Back to groups list
  const handleBackToGroups = () => {
    setSelectedGroup(null);
  };

  if (selectedGroup && user) {
    return (
      <div className="App">
        <Timer 
          user={user} 
          onBack={handleBackToGroups}
          groupId={selectedGroup}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <button 
        onClick={toggleDarkMode} 
        className="theme-toggle"
        aria-label={darkMode ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الغامق'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
      
      <header className="App-header">
        <div className="login-container">
          {!user ? (
            <div className="welcome-screen">
              <h1>مجموعات الدراسة التعاونية</h1>
              <p>انضم إلى مجتمع المذاكرة مع الأصدقاء وحقق أهدافك التعليمية</p>
              <button className="login-button" onClick={handleLogin}>
                <span>تسجيل الدخول باستخدام Google</span>
              </button>
            </div>
          ) : (
            <div className="user-welcome">
              <div className="user-info">
                <img src={user.photoURL} alt="صورة المستخدم" className="user-avatar" />
                <div className="user-details">
                  <h2>مرحباً {user.displayName}!</h2>
                  <button className="logout-button" onClick={handleLogout}>
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {user && (
          <div className="group-management">
            <div className="group-creation">
              <h2>إنشاء مجموعة جديدة</h2>
              <div className="input-group">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="أدخل اسم المجموعة"
                  onKeyPress={(e) => e.key === 'Enter' && addStudyGroup()}
                />
                <button className="create-button" onClick={addStudyGroup}>
                  إنشاء
                </button>
              </div>
            </div>
            
            <div className="join-group">
              <h2>الانضمام إلى مجموعة</h2>
              <button 
                className="join-button"
                onClick={() => setShowJoinModal(true)}
              >
                الانضمام بمجموعة موجودة
              </button>
            </div>
          </div>
        )}

        {user && (
          <div className="study-groups">
            <h2>مجموعاتك الدراسية</h2>
            
            {loadingGroups ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>جاري تحميل المجموعات...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="empty-state">
                <img src="/empty-groups.svg" alt="لا توجد مجموعات" className="empty-image" />
                <p>لا توجد مجموعات متاحة حالياً</p>
                <button 
                  className="create-button"
                  onClick={() => document.querySelector('.group-creation input').focus()}
                >
                  إنشاء مجموعة جديدة
                </button>
              </div>
            ) : (
              <div className="groups-grid">
                {groups.map((group) => (
                  <div key={group.id} id={`group-${group.id}`} className="group-card">
                    <div className="group-content">
                      <h3 className="group-name">{group.name}</h3>
                      <p className="group-meta">
                        <span className="group-creator">المنشئ: {group.creatorName}</span>
                        <span className="group-code">كود: {group.code}</span>
                      </p>
                      {group.isCreator && <span className="creator-badge">أنت المنشئ</span>}
                    </div>
                    
                    <div className="group-actions">
                      <button 
                        onClick={() => handleJoinGroup(group.id)} 
                        className="join-button"
                      >
                        دخول المجموعة
                      </button>
                      
                      {group.isCreator && (
                        <button 
                          onClick={() => deleteGroup(group.id)} 
                          className="delete-button"
                        >
                          حذف المجموعة
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {showJoinModal && (
          <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button className="close-button" onClick={() => setShowJoinModal(false)}>
                &times;
              </button>
              
              <h2>الانضمام إلى مجموعة</h2>
              <p>أدخل كود المجموعة المكون من 6 أحرف</p>
              
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="أدخل كود المجموعة"
                maxLength={6}
                className="join-input"
              />
              
              <div className="modal-actions">
                <button onClick={joinGroupByCode} className="confirm-button">
                  تأكيد الانضمام
                </button>
                <button 
                  onClick={() => setShowJoinModal(false)} 
                  className="cancel-button"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {notification && (
          <div className="notification">
            {notification}
          </div>
        )}

        <footer className="app-footer">
          <p>تم تطويره بواسطة محمد أبو طبيخ © {new Date().getFullYear()}</p>
        </footer>
      </header>
    </div>
  );
}

export default App;