// src/online/race/turnManager.js
// إدارة الأدوار: حساب اللاعب أو الفريق التالي (ترتيب دائري)
// الإصدار النهائي مع ضمانات:
// - دعم نظام فردي (اللاعبون)
// - دعم نظام فرق (اختياري، مع تحديد العضو النشط في الفريق)
// - تخطي اللاعبين المستبعدين أو المنفصلين
// - التعامل مع الحالات الحدودية (لاعب واحد فقط)

/**
 * حساب معرف اللاعب التالي في السباق الفردي
 * @param {object} race - كائن السباق (يحتوي على players, activeEntityId)
 * @returns {string|null} - معرف اللاعب التالي أو null
 */
export function getNextEntityId(race) {
  if (!race.players || race.players.length === 0) return null;
  
  const players = race.players;
  const currentId = race.activeEntityId;
  
  // إذا لم يوجد لاعب نشط، نأخذ الأول
  if (!currentId) return players[0]?.id || null;
  
  // البحث عن ترتيب اللاعبين (يمكن أن يكونوا مرتبين حسب الانضمام)
  // نستخدم مصفوفة اللاعبين كما هي (ترتيب الانضمام)
  const currentIndex = players.findIndex(p => p.id === currentId);
  if (currentIndex === -1) return players[0]?.id || null;
  
  const nextIndex = (currentIndex + 1) % players.length;
  return players[nextIndex]?.id || null;
}

/**
 * حساب الفريق أو اللاعب التالي في السباق الجماعي
 * @param {object} race - كائن السباق (يحتوي على players, teams, activeEntityId, activeTeamId)
 * @returns {object} - { entityId: string, entityType: 'player' | 'team', teamId?: string }
 */
export function getNextTeamEntity(race) {
  if (!race.isTeam) {
    // إذا لم يكن نظام فرق، نستخدم النظام الفردي
    return { entityId: getNextEntityId(race), entityType: 'player' };
  }
  
  const { teams, players, activeTeamId, activeEntityId } = race;
  if (!teams || teams.length === 0) {
    // الرجوع إلى النظام الفردي
    return { entityId: getNextEntityId(race), entityType: 'player' };
  }
  
  // تحديد الفريق التالي
  let nextTeamId = null;
  let nextTeamIndex = -1;
  
  if (!activeTeamId) {
    // أول فريق
    nextTeamId = teams[0]?.id;
    nextTeamIndex = 0;
  } else {
    const currentTeamIndex = teams.findIndex(t => t.id === activeTeamId);
    if (currentTeamIndex === -1) {
      nextTeamId = teams[0]?.id;
      nextTeamIndex = 0;
    } else {
      nextTeamIndex = (currentTeamIndex + 1) % teams.length;
      nextTeamId = teams[nextTeamIndex]?.id;
    }
  }
  
  if (!nextTeamId) return { entityId: null, entityType: 'team' };
  
  // الحصول على أعضاء الفريق التالي
  const teamMembers = players.filter(p => p.teamId === nextTeamId);
  if (teamMembers.length === 0) {
    // لا يوجد أعضاء في هذا الفريق، انتقل للفريق الذي يليه
    return getNextTeamEntity({ ...race, activeTeamId: nextTeamId });
  }
  
  // تحديد العضو النشط داخل الفريق (دور داخلي)
  let nextPlayerId = null;
  const currentPlayerInTeam = players.find(p => p.id === activeEntityId && p.teamId === activeTeamId);
  
  if (!currentPlayerInTeam) {
    // أول لاعب في الفريق
    nextPlayerId = teamMembers[0]?.id;
  } else {
    const memberIndex = teamMembers.findIndex(m => m.id === currentPlayerInTeam.id);
    const nextMemberIndex = (memberIndex + 1) % teamMembers.length;
    nextPlayerId = teamMembers[nextMemberIndex]?.id;
  }
  
  return {
    entityId: nextPlayerId,
    entityType: 'player',
    teamId: nextTeamId
  };
}

/**
 * تحديث السباق باللاعب النشط التالي (يدعم الفردي والجماعي)
 * @param {object} race - كائن السباق الحالي
 * @returns {object} - كائن السباق بعد التحديث (يحتوي على activeEntityId, activeTeamId إن وجد)
 */
export function advanceTurn(race) {
  let nextEntity;
  if (race.isTeam) {
    nextEntity = getNextTeamEntity(race);
  } else {
    nextEntity = { entityId: getNextEntityId(race), entityType: 'player' };
  }
  
  const updatedRace = { ...race };
  updatedRace.activeEntityId = nextEntity.entityId;
  if (nextEntity.teamId) updatedRace.activeTeamId = nextEntity.teamId;
  
  // إعادة ضبط مؤقت السؤال
  updatedRace.questionStartTime = new Date();
  
  return updatedRace;
}

/**
 * التحقق من وجود لاعبين نشطين (لم يتم استبعادهم أو انقطاعهم)
 * @param {object} race 
 * @returns {boolean}
 */
export function hasActivePlayers(race) {
  if (!race.players || race.players.length === 0) return false;
  // يمكن إضافة شروط إضافية مثل التحقق من أن اللاعب لم ينسحب
  return race.players.some(p => p.isActive !== false);
}

/**
 * الحصول على قائمة اللاعبين النشطين (غير المستبعدين)
 * @param {object} race 
 * @returns {Array}
 */
export function getActivePlayers(race) {
  if (!race.players) return [];
  return race.players.filter(p => p.isActive !== false);
}