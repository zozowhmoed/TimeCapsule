// services/codeService.js
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const generateSecureCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint32Array(16);
  window.crypto.getRandomValues(array);
  let code = '';
  array.forEach(value => {
    code += chars[value % chars.length];
  });
  return code;
};

const codeService = {
  /**
   * إنشاء أو استرجاع الكود المميز للمستخدم
   * @param {string} userId - معرّف المستخدم
   * @returns {Promise<{success: boolean, code?: string, alreadyExists?: boolean, error?: string}>}
   */
  generateAndStoreCode: async (userId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      // إذا كان المستخدم لديه كود بالفعل
      if (userSnap.exists() && userSnap.data().uniqueCode) {
        return { 
          success: true, 
          code: userSnap.data().uniqueCode,
          alreadyExists: true
        };
      }
      
      // إنشاء كود مميز جديد أكثر أماناً
      const code = generateSecureCode();
      
      // حفظ الكود في قاعدة البيانات
      const userData = {
        uniqueCode: code,
        hasVerifiedCode: false,
        codeGeneratedAt: new Date()
      };
      
      if (userSnap.exists()) {
        await updateDoc(userRef, userData);
      } else {
        await setDoc(userRef, userData, { merge: true });
      }
      
      return { success: true, code };
    } catch (error) {
      console.error("Error generating code:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * التحقق من صحة الكود المدخل
   * @param {string} userId - معرّف المستخدم
   * @param {string} enteredCode - الكود المدخل
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  verifyUserCode: async (userId, enteredCode) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return { success: false, message: "المستخدم غير موجود" };
      }
      
      const userData = userSnap.data();
      
      if (!userData.uniqueCode) {
        return { success: false, message: "لا يوجد كود مميز لهذا المستخدم" };
      }
      
      if (userData.uniqueCode !== enteredCode) {
        return { success: false, message: "الكود غير صحيح" };
      }
      
      // تحديث حالة التحقق وإضافة وقت التحقق
      await updateDoc(userRef, { 
        hasVerifiedCode: true,
        codeVerifiedAt: new Date() 
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error verifying code:", error);
      return { success: false, message: "حدث خطأ أثناء التحقق" };
    }
  },

  /**
   * التحقق من حالة التحقق للمستخدم
   * @param {string} userId - معرّف المستخدم
   * @returns {Promise<boolean>}
   */
  checkCodeVerification: async (userId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return false;
      }
      
      return userSnap.data().hasVerifiedCode || false;
    } catch (error) {
      console.error("Error checking verification:", error);
      return false;
    }
  },

  /**
   * الحصول على معلومات الكود للمستخدم
   * @param {string} userId - معرّف المستخدم
   * @returns {Promise<{code: string, generatedAt: Date, verified: boolean, verifiedAt?: Date}|null>}
   */
  getCodeInfo: async (userId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists() || !userSnap.data().uniqueCode) {
        return null;
      }
      
      const data = userSnap.data();
      return {
        code: data.uniqueCode,
        generatedAt: data.codeGeneratedAt?.toDate() || null,
        verified: data.hasVerifiedCode || false,
        verifiedAt: data.codeVerifiedAt?.toDate() || null
      };
    } catch (error) {
      console.error("Error getting code info:", error);
      return null;
    }
  }
};

export default codeService;