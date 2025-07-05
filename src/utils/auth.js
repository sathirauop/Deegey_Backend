const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function createAuthenticatedClient(jwtToken) {
  if (!jwtToken) {
    throw new Error('JWT token is required for authenticated client');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`
      }
    }
  });
}

module.exports = {
  createAuthenticatedClient,
};