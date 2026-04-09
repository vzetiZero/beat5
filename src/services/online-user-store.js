"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.touchOnlineSession = touchOnlineSession;
exports.removeOnlineSession = removeOnlineSession;
exports.getOnlineUserCount = getOnlineUserCount;
const ACTIVE_WINDOW_MS = 1000 * 60 * 5;
const sessionMap = new Map();
function pruneExpiredSessions(now = Date.now()) {
    for (const [sessionId, entry] of sessionMap.entries()) {
        if (now - entry.lastSeenAt > ACTIVE_WINDOW_MS) {
            sessionMap.delete(sessionId);
        }
    }
}
function touchOnlineSession(sessionId, user) {
    if (!sessionId || !user || !Number.isFinite(user.id) || user.id <= 0) {
        return;
    }
    const now = Date.now();
    pruneExpiredSessions(now);
    sessionMap.set(sessionId, {
        sessionId,
        userId: user.id,
        username: user.username,
        lastSeenAt: now
    });
}
function removeOnlineSession(sessionId) {
    if (!sessionId) {
        return;
    }
    sessionMap.delete(sessionId);
}
function getOnlineUserCount() {
    pruneExpiredSessions();
    return sessionMap.size;
}
