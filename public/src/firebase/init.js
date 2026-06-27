// src/firebase/init.js
import { firebaseConfig } from '../config.js';

let dbInstance = null;
let authInstance = null;
let storageInstance = null;
let initialized = false;

// سيتم تعبئتها لاحقاً
let Timestamp, FieldValue, serverTimestampFn;

async function initFirebase() {
    if (initialized) return;
    
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js");
        const firestore = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
        const authMod = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js");
        const storageMod = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js");

        const app = initializeApp(firebaseConfig);
        dbInstance = firestore.getFirestore(app);
        authInstance = authMod.getAuth(app);
        storageInstance = storageMod.getStorage(app);
        
        Timestamp = firestore.Timestamp;
        FieldValue = firestore.FieldValue;
        serverTimestampFn = firestore.serverTimestamp;
        
        // تعطيل persistence لمنع أخطاء تعدد الألسنة
        console.log('⚠️ Firestore persistence disabled to avoid multi-tab conflicts');
        
        initialized = true;
        console.log('✅ Firebase initialized (modular v9)');
    } catch (err) {
        console.error('❌ Firebase initialization failed:', err);
        // ⭐ الإضافة الوحيدة: رسالة للمستخدم لكن متوقفش التطبيق
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.bottom = '10px';
        errorDiv.style.right = '10px';
        errorDiv.style.backgroundColor = '#ef4444';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '10px';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.zIndex = '999999';
        errorDiv.style.fontSize = '12px';
        errorDiv.innerText = '⚠️ فشل الاتصال بالخادم. بعض الميزات قد لا تعمل. تأكد من اتصالك بالإنترنت.';
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
        // ⭐ هنا مش هنرمي الخطأ عشان المنصة متقفلش
    }
}

// ⭐ أهم نقطة: استنى التهيئة تخلص قبل ما نكمل (زي ما كان في الأصل)
await initFirebase();

// استيراد الدوال من Firebase (للاستخدام modular)
const {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction,
    serverTimestamp, arrayRemove, arrayUnion, increment
} = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");

const {
    onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut
} = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js");

const {
    ref, uploadBytes, getDownloadURL, deleteObject
} = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js");

// ✅ إنشاء كائن db متوافق مع الطريقة القديمة (db.collection)
const db = dbInstance;  // dbInstance هو كائن Firestore حقيقي
// إضافة دوال مساعدة للكائن db ليكون متوافقاً مع الكود القديم
db.collection = (path) => collection(dbInstance, path);
db.doc = (path) => doc(dbInstance, path);
db.runTransaction = (callback) => runTransaction(dbInstance, callback);
db.batch = () => writeBatch(dbInstance);

// تصدير كل ما يلزم
export {
    db,           // هذا هو المهم: كائن Firestore حقيقي مع دوال .collection و .doc
    dbInstance,
    authInstance as auth,
    storageInstance as storage,
    Timestamp,
    FieldValue,
    serverTimestamp,
    serverTimestampFn,
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction,
    arrayRemove, arrayUnion, increment,
    onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut,
    ref, uploadBytes, getDownloadURL, deleteObject
};