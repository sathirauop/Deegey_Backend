const { supabase } = require('../config/database');

const createSession = async (userId, deviceInfo = {}) => {
  try {
    const sessionData = {
      user_id: userId,
      device_type: deviceInfo.deviceType || 'unknown',
      device_name: deviceInfo.deviceName || 'unknown',
      ip_address: deviceInfo.ipAddress,
      user_agent: deviceInfo.userAgent,
      last_activity: new Date().toISOString(),
      is_active: true,
    };

    const { data, error } = await supabase
      .from('user_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Create session error:', error);
    return null;
  }
};

const updateSessionActivity = async (sessionId) => {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Update session activity error:', error);
    return null;
  }
};

const invalidateSession = async (sessionId) => {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Invalidate session error:', error);
    return false;
  }
};

const invalidateAllUserSessions = async (userId) => {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Invalidate all user sessions error:', error);
    return false;
  }
};

const getUserActiveSessions = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Get user active sessions error:', error);
    return [];
  }
};

const cleanupExpiredSessions = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('is_active', true)
      .lt('last_activity', cutoffDate.toISOString());

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Cleanup expired sessions error:', error);
    return false;
  }
};

const getSessionInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    deviceType: req.get('X-Device-Type') || 'web',
    deviceName: req.get('X-Device-Name') || 'Unknown Device',
  };
};

module.exports = {
  createSession,
  updateSessionActivity,
  invalidateSession,
  invalidateAllUserSessions,
  getUserActiveSessions,
  cleanupExpiredSessions,
  getSessionInfo,
};
