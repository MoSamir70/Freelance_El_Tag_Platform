// src/landing/sections/liveStats.js
import { animateNumber } from '../utils/helpers.js';

let statsInterval = null;
let isStatsVisible = false;

const statsElements = {
    visitors: null,
    students: null,
    teachers: null,
    questions: null
};

// دالة لزيادة إحصائية معينة (تُستدعى من أي مكان في المنصة)
export async function incrementStat(statName, by = 1, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const db = firebase.firestore();
            const statsRef = db.collection('platformStats').doc('current');
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(statsRef);
                const currentValue = doc.exists ? (doc.data()[statName] || 0) : 0;
                const newValue = currentValue + by;
                transaction.set(statsRef, { 
                    [statName]: newValue, 
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp() 
                }, { merge: true });
            });
            
            // تحديث الواجهة إذا كان القسم ظاهراً والعناصر موجودة
            if (window._liveStatsElements && window._liveStatsElements[statName]) {
                const el = window._liveStatsElements[statName];
                const currentDisplay = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
                const newDisplay = currentDisplay + by;
                if (window.animateNumber) window.animateNumber(el, newDisplay, 800);
                else el.textContent = newDisplay;
            }
            
            console.log(`[Stats] Incremented ${statName} by ${by}`);
            return { success: true };
        } catch (error) {
            console.warn(`[Stats] Attempt ${attempt+1} failed for ${statName}:`, error);
            if (attempt === retries - 1) {
                console.error(`[Stats] Failed to increment ${statName} after ${retries} attempts`);
                return { success: false, error: error.message };
            }
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
}

// دالة لتعيين عناصر الواجهة للوصول إليها من أي مكان
export function setLiveStatsElements(elements) {
    window._liveStatsElements = elements;
}

// ✅ الإصلاح الأهم: توحيد أسماء الحقول بين القراءة والكتابة
async function fetchLiveStats() {
    try {
        const db = firebase.firestore();
        const statsRef = db.collection('platformStats').doc('current');
        const docSnap = await statsRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data();
            return {
                // الآن نقرأ نفس الحقول التي نكتبها
                visitors: data.visitors || 1247,
                students: data.students || 584,
                teachers: data.teachers || 32,
                questions: data.questions || 15280
            };
        } else {
            return { visitors: 1247, students: 584, teachers: 32, questions: 15280 };
        }
    } catch (error) {
        console.error('خطأ في جلب الإحصائيات:', error);
        return { visitors: 1247, students: 584, teachers: 32, questions: 15280 };
    }
}

// تحديث الأرقام
async function updateStatsNumbers() {
    const stats = await fetchLiveStats();
    
    if (statsElements.visitors) animateNumber(statsElements.visitors, stats.visitors, 1500);
    if (statsElements.students) animateNumber(statsElements.students, stats.students, 1500);
    if (statsElements.teachers) animateNumber(statsElements.teachers, stats.teachers, 1500);
    if (statsElements.questions) animateNumber(statsElements.questions, stats.questions, 1500);
    
    const dateTimeEl = document.getElementById('stats-last-update');
    if (dateTimeEl) {
        dateTimeEl.textContent = `آخر تحديث: ${new Date().toLocaleString('ar-EG')}`;
    }
}

// مراقب ظهور القسم
function initStatsObserver() {
    const statsSection = document.getElementById('live-stats-section');
    if (!statsSection) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isStatsVisible) {
                isStatsVisible = true;
                updateStatsNumbers();
                if (statsInterval) clearInterval(statsInterval);
                statsInterval = setInterval(updateStatsNumbers, 30000);
            } else if (!entry.isIntersecting && isStatsVisible) {
                if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
                isStatsVisible = false;
            }
        });
    }, { threshold: 0.3 });
    
    observer.observe(statsSection);
}

// تهيئة العناصر
function initElements() {
    statsElements.visitors = document.getElementById('stat-total-visitors');
    statsElements.students = document.getElementById('stat-total-students');
    statsElements.teachers = document.getElementById('stat-total-teachers');
    statsElements.questions = document.getElementById('stat-total-questions');
}

// التهيئة الرئيسية
export function initLiveStats() {
    initElements();
    
    // تخزين العناصر في window للوصول إليها من أي مكان
    if (statsElements.visitors) {
        setLiveStatsElements({
            visitors: statsElements.visitors,
            students: statsElements.students,
            teachers: statsElements.teachers,
            questions: statsElements.questions
        });
    }
    
    initStatsObserver();
    
    const statsSection = document.getElementById('live-stats-section');
    if (statsSection && window.scrollY + window.innerHeight > statsSection.offsetTop) {
        isStatsVisible = true;
        updateStatsNumbers();
        if (statsInterval) clearInterval(statsInterval);
        statsInterval = setInterval(updateStatsNumbers, 30000);
    }
}

// تسجيل زائر جديد
export async function registerVisitor() {
    try {
        const db = firebase.firestore();
        const statsRef = db.collection('platformStats').doc('current');
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(statsRef);
            const currentVisitors = doc.exists ? doc.data().visitors || 0 : 0;  // ✅ نفس الاسم
            transaction.set(statsRef, {
                visitors: currentVisitors + 1,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        
        if (isStatsVisible && statsElements.visitors) {
            const newCount = (parseInt(statsElements.visitors.textContent.replace(/[^0-9]/g, '')) || 0) + 1;
            animateNumber(statsElements.visitors, newCount, 800);
        }
    } catch (error) {
        console.error('خطأ في تسجيل الزائر:', error);
    }
}