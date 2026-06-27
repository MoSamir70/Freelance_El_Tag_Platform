// cache.js - نظام التخزين المؤقت المركزي
import { getCurrentTeacherId } from './helpers.js';
import { getStudents, getGameHistory, getStudentStats } from './student.js';

let cachedGlobalData = null;
let lastFetchTime = 0;
const CACHE_TTL = 2 * 60 * 1000; // دقيقتان

export async function fetchAllCachedData(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedGlobalData && (now - lastFetchTime) < CACHE_TTL) {
        console.log('[Cache] Returning cached data');
        return cachedGlobalData;
    }
    
    console.log('[Cache] Fetching fresh data');
    const teacherId = getCurrentTeacherId();
    if (!teacherId) return null;
    
    const [students, history] = await Promise.all([
        getStudents(),
        getGameHistory()
    ]);
    
    const studentStatsPromises = students.map(s => getStudentStats(s.id));
    const studentStatsArray = await Promise.all(studentStatsPromises);
    const studentStats = {};
    students.forEach((s, idx) => { studentStats[s.id] = studentStatsArray[idx]; });
    
    cachedGlobalData = { students, history, studentStats, lastUpdated: now };
    lastFetchTime = now;
    return cachedGlobalData;
}

export function invalidateGlobalCache() {
    cachedGlobalData = null;
    lastFetchTime = 0;
    console.log('[Cache] Global cache invalidated');
}

// إعادة تصدير دوال الكاش من utils/cache.js للتوحيد
export { getCached, setCached, invalidateCache } from '../../utils/cache.js';