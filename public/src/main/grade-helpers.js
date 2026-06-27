// src/main/grade-helpers.js
import { db, collection, addDoc, deleteDoc, getDocs, query, where } from '../firebase/init.js';
import { escapeHtml } from '../utils/helpers/dom.js';
import { getDynamicGradesDetailed } from '../db/localstorage.js';
import { showPage } from '../ui/navigation.js';
import { raceSettings } from '../core/raceSettings.js';
import { reapplyTheme } from '../ui/themes.js';

const customGradesCollection = collection(db, 'customGrades');
const studentsCollection = collection(db, 'students');

export async function addCustomGradeToFirestore(gradeName) {
    await addDoc(customGradesCollection, { name: gradeName });
}

export async function deleteCustomGradeFromFirestore(gradeName) {
    const q = query(customGradesCollection, where('name', '==', gradeName));
    const snapshot = await getDocs(q);
    snapshot.forEach(async (docSnap) => await deleteDoc(docSnap.ref));
}

export async function renderGradesGrid() {
    const container = document.getElementById('grades-grid');
    if (!container) return;
    const detailedGrades = getDynamicGradesDetailed();
    if (detailedGrades.length === 0) {
        container.innerHTML = `<div class="glass-panel p-8 text-center col-span-full"><div class="text-7xl mb-4">📚</div><div class="text-2xl font-bold text-yellow-400 mb-2">لا توجد صفوف</div><div class="text-gray-300 mb-4">يمكنك إضافة صفوف من صفحة إدارة الصفوف</div><button class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-full transition-all" onclick="window.showPage('grades-page')">➕ الذهاب لإضافة صفوف</button></div>`;
        return;
    }
    const stages = {
        ابتدائي: { name: '📘 المرحلة الابتدائية', grades: [], icon: '📘', color: '#10b981' },
        إعدادي: { name: '📙 المرحلة الإعدادية', grades: [], icon: '📙', color: '#f59e0b' },
        ثانوي: { name: '📕 المرحلة الثانوية', grades: [], icon: '📕', color: '#ef4444' },
        أخرى: { name: '📓 صفوف أخرى', grades: [], icon: '📓', color: '#8b5cf6' }
    };
    detailedGrades.forEach(item => {
        const stage = item.stage;
        if (stages[stage]) stages[stage].grades.push(item.name);
        else stages['أخرى'].grades.push(item.name);
    });
    let html = '';
    for (const [key, stage] of Object.entries(stages)) {
        if (stage.grades.length === 0) continue;
        html += `<div class="stage-divider" style="grid-column: 1/-1; margin-top: 1rem;"><div class="flex items-center justify-center gap-3"><span style="font-size: 1.5rem;">${stage.icon}</span><span style="color: ${stage.color};">${stage.name}</span></div></div>`;
        stage.grades.forEach(grade => {
            html += `<button class="gradeSelectBtn glass-panel p-4 rounded-2xl transition-all duration-300 hover:scale-105 cursor-pointer" data-grade="${escapeHtml(grade)}" style="background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2)); border: 1px solid rgba(255,215,0,0.3);"><div class="text-3xl mb-2">${stage.icon}</div><div class="font-bold text-lg">${escapeHtml(grade)}</div></button>`;
        });
    }
    container.innerHTML = html;
    container.querySelectorAll('.gradeSelectBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const grade = btn.dataset.grade;
            if (grade) {
                raceSettings.grade = grade;
                showPage('team-competition-type-screen');
            }
        });
    });
    setTimeout(() => reapplyTheme(), 50);
}