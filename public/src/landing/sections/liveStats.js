// src/landing/sections/liveStats.js
import { animateNumber } from '../utils/helpers.js';
import { db, collection, doc, getDoc, setDoc, runTransaction, serverTimestamp } from '../../firebase/init.js';

let statsInterval = null;
let isStatsVisible = false;

const statsElements = { visitors: null, students: null, teachers: null, questions: null };
const DEFAULT_STATS = { visitors: 1247, students: 584, teachers: 32, questions: 15280 };

async function fetchLiveStats() {
  try {
    const statsRef = doc(db, 'platformStats', 'current');
    const docSnap = await getDoc(statsRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        visitors: data.visitors ?? DEFAULT_STATS.visitors,
        students: data.students ?? DEFAULT_STATS.students,
        teachers: data.teachers ?? DEFAULT_STATS.teachers,
        questions: data.questions ?? DEFAULT_STATS.questions
      };
    }
    return { ...DEFAULT_STATS };
  } catch (error) {
    console.error('fetchLiveStats error:', error);
    // الرجوع إلى localStorage كحل احتياطي
    const local = JSON.parse(localStorage.getItem('taj_local_stats') || '{}');
    return {
      visitors: local.visitors ?? DEFAULT_STATS.visitors,
      students: local.students ?? DEFAULT_STATS.students,
      teachers: local.teachers ?? DEFAULT_STATS.teachers,
      questions: local.questions ?? DEFAULT_STATS.questions
    };
  }
}

async function updateStatsNumbers() {
  const stats = await fetchLiveStats();
  if (statsElements.visitors) animateNumber(statsElements.visitors, stats.visitors, 1500);
  if (statsElements.students) animateNumber(statsElements.students, stats.students, 1500);
  if (statsElements.teachers) animateNumber(statsElements.teachers, stats.teachers, 1500);
  if (statsElements.questions) animateNumber(statsElements.questions, stats.questions, 1500);
  const dateEl = document.getElementById('stats-last-update');
  if (dateEl) dateEl.textContent = `آخر تحديث: ${new Date().toLocaleString('ar-EG')}`;
}

function initStatsObserver() {
  const section = document.getElementById('live-stats-section');
  if (!section) return;
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isStatsVisible) {
      isStatsVisible = true;
      updateStatsNumbers();
      if (statsInterval) clearInterval(statsInterval);
      statsInterval = setInterval(updateStatsNumbers, 30000);
    } else if (!entries[0].isIntersecting && isStatsVisible) {
      if (statsInterval) clearInterval(statsInterval);
      statsInterval = null;
      isStatsVisible = false;
    }
  }, { threshold: 0.3 });
  observer.observe(section);
}

function initElements() {
  statsElements.visitors = document.getElementById('stat-total-visitors');
  statsElements.students = document.getElementById('stat-total-students');
  statsElements.teachers = document.getElementById('stat-total-teachers');
  statsElements.questions = document.getElementById('stat-total-questions');
}

export function initLiveStats() {
  initElements();
  initStatsObserver();
  const section = document.getElementById('live-stats-section');
  if (section && window.scrollY + window.innerHeight > section.offsetTop) {
    isStatsVisible = true;
    updateStatsNumbers();
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(updateStatsNumbers, 30000);
  }
  // إنشاء المستند إذا لم يكن موجوداً
  (async () => {
    try {
      const statsRef = doc(db, 'platformStats', 'current');
      const docSnap = await getDoc(statsRef);
      if (!docSnap.exists()) {
        await setDoc(statsRef, {
          visitors: DEFAULT_STATS.visitors,
          students: DEFAULT_STATS.students,
          teachers: DEFAULT_STATS.teachers,
          questions: DEFAULT_STATS.questions,
          lastUpdated: serverTimestamp()
        });
      }
    } catch(e) { console.warn('[Stats] Init stats doc error:', e); }
  })();
}

export async function incrementStat(statName, by = 1) {
  try {
    const statsRef = doc(db, 'platformStats', 'current');
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(statsRef);
      const current = docSnap.exists() ? (docSnap.data()[statName] ?? DEFAULT_STATS[statName]) : DEFAULT_STATS[statName];
      transaction.set(statsRef, { [statName]: current + by, lastUpdated: serverTimestamp() }, { merge: true });
    });
    if (isStatsVisible && statsElements[statName]) {
      const el = statsElements[statName];
      const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || DEFAULT_STATS[statName];
      animateNumber(el, current + by, 800);
    }
  } catch (error) {
    console.error('incrementStat error:', error);
    // الحل الاحتياطي: localStorage
    const local = JSON.parse(localStorage.getItem('taj_local_stats') || '{}');
    local[statName] = (local[statName] || DEFAULT_STATS[statName]) + by;
    localStorage.setItem('taj_local_stats', JSON.stringify(local));
    if (isStatsVisible && statsElements[statName]) {
      const el = statsElements[statName];
      const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || DEFAULT_STATS[statName];
      animateNumber(el, current + by, 800);
    }
  }
}

export async function registerVisitor() {
  await incrementStat('visitors', 1);
}