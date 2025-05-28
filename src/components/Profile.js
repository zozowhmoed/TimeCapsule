import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import userService from '../services/userService';

function Profile({ user, showNotification, onBack }) {
  const [profile, setProfile] = useState({
    firstName: '',
    fatherName: '',
    lastName: '',
    uniqueCode: '',
    hasVerifiedCode: false
  });
  
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userData = await userService.getUserData(user.uid);
        if (userData) {
          setProfile({
            firstName: userData.firstName || '',
            fatherName: userData.fatherName || '',
            lastName: userData.lastName || '',
            uniqueCode: userData.uniqueCode || '',
            hasVerifiedCode: userData.hasVerifiedCode || false
          });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        showNotification('حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user, showNotification]);

  const handleSave = async () => {
    try {
      await userService.updateProfile(user.uid, {
        firstName: profile.firstName,
        fatherName: profile.fatherName,
        lastName: profile.lastName
      });
      showNotification('تم حفظ التعديلات بنجاح');
      if (onBack) {
        onBack();
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      showNotification('حدث خطأ أثناء حفظ التعديلات');
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profile.uniqueCode);
    showNotification('تم نسخ الكود إلى الحافظة');
  };

  if (loading) {
    return <div className="loading">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-form">
        <h2>الملف الشخصي</h2>
        
        <div className="profile-section">
          <div className="profile-header">
            <img src={user.photoURL} alt="صورة الملف الشخصي" className="profile-avatar" />
            <h3>{user.displayName}</h3>
            <p className="user-email">{user.email}</p>
          </div>
        </div>
        
        <div className="form-group">
          <label>الاسم الأول:</label>
          <input 
            value={profile.firstName}
            onChange={(e) => setProfile({...profile, firstName: e.target.value})}
            placeholder="أدخل الاسم الأول"
          />
        </div>
        
        <div className="form-group">
          <label>اسم الأب:</label>
          <input 
            value={profile.fatherName}
            onChange={(e) => setProfile({...profile, fatherName: e.target.value})}
            placeholder="أدخل اسم الأب"
          />
        </div>
        
        <div className="form-group">
          <label>اسم العائلة:</label>
          <input 
            value={profile.lastName}
            onChange={(e) => setProfile({...profile, lastName: e.target.value})}
            placeholder="أدخل اسم العائلة"
          />
        </div>

        {profile.uniqueCode && (
          <div className="form-group unique-code-group">
            <label>الكود المميز:</label>
            <div className="code-display">
              <input 
                type="text" 
                value={profile.uniqueCode} 
                readOnly 
                className="code-input"
              />
              <button 
                onClick={copyToClipboard}
                className="copy-button"
                title="نسخ الكود"
              >
                نسخ
              </button>
            </div>
            <p className="code-status">
              حالة التحقق: {profile.hasVerifiedCode ? '✅ تم التحقق' : '❌ غير مفعل'}
            </p>
            <p className="code-notice">
              هذا الكود يستخدم للتحقق عند إنشاء مجموعات جديدة. لا تشاركه مع أحد.
            </p>
          </div>
        )}
        
        <div className="profile-actions">
          <button onClick={handleSave} className="save-button">
            حفظ التعديلات
          </button>
          
          <button 
            onClick={handleBack} 
            className="back-button"
          >
            الرجوع
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;