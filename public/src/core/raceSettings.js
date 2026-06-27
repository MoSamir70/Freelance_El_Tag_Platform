// src/core/raceSettings.js
// إعدادات السباق المؤقتة – يتم إعادة تعيينها عند بدء سباق جديد
// [FIX] إضافة resetRaceSettings شاملة لجميع الخصائص (بما في ذلك الحقول المضافة حديثاً)

export let raceSettings = {
    grade: null,
    studentIds: [],
    players: [],           // ✅ لدعم البطولات والسباقات المباشرة
    competitionType: null,
    teams: [],
    subject: null,
    lessons: [],
    accumulative: false,
    goal: 10,
    timer: 12,
    gameMode: null,
    isTeam: false,
    availableStudents: [],
    raceType: null,
    modeSettings: {},
    mergeMode: false,
    mergedMaterials: [],
    mergedLessons: [],
    selectedLessonsWithMaterial: [],  // ✅ مهم للدروس المدمجة
    isOnline: false,
    onlineRoomPin: null
};

export function resetRaceSettings() {
    raceSettings.grade = null;
    raceSettings.studentIds = [];
    raceSettings.players = [];
    raceSettings.competitionType = null;
    raceSettings.teams = [];
    raceSettings.subject = null;
    raceSettings.lessons = [];
    raceSettings.accumulative = false;
    raceSettings.goal = 10;
    raceSettings.timer = 12;
    raceSettings.gameMode = null;
    raceSettings.isTeam = false;
    raceSettings.availableStudents = [];
    raceSettings.raceType = null;
    raceSettings.modeSettings = {};
    raceSettings.mergeMode = false;
    raceSettings.mergedMaterials = [];
    raceSettings.mergedLessons = [];
    raceSettings.selectedLessonsWithMaterial = [];
    raceSettings.isOnline = false;
    raceSettings.onlineRoomPin = null;
}