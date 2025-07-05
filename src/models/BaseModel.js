const { supabase, supabaseAdmin } = require('../config/database');

class BaseModel {
  constructor(tableName, authenticatedClient = null) {
    this.tableName = tableName;
    this.db = authenticatedClient || supabase;
    this.adminDb = supabaseAdmin;
  }

  async findById(id, select = '*') {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .select(select)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      throw new Error(
        `Error finding ${this.tableName} by ID: ${error.message}`
      );
    }
  }

  async findOne(filters, select = '*') {
    try {
      let query = this.db.from(this.tableName).select(select);

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      throw new Error(`Error finding ${this.tableName}: ${error.message}`);
    }
  }

  async findMany(filters = {}, options = {}) {
    try {
      const {
        select = '*',
        limit,
        offset,
        orderBy,
        orderDirection = 'asc',
      } = options;

      let query = this.db.from(this.tableName).select(select);

      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });

      if (orderBy) {
        query = query.order(orderBy, { ascending: orderDirection === 'asc' });
      }

      if (limit) {
        query = query.limit(limit);
      }

      if (offset) {
        query = query.range(offset, offset + (limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      throw new Error(
        `Error finding ${this.tableName} records: ${error.message}`
      );
    }
  }

  async create(data) {
    try {
      const { data: result, error } = await this.db
        .from(this.tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return result;
    } catch (error) {
      throw new Error(`Error creating ${this.tableName}: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      const { data: result, error } = await this.db
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return result;
    } catch (error) {
      throw new Error(`Error updating ${this.tableName}: ${error.message}`);
    }
  }

  async updateMany(filters, data) {
    try {
      let query = this.db.from(this.tableName).update(data);

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();

      if (error) {
        throw error;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Error updating ${this.tableName} records: ${error.message}`
      );
    }
  }

  async delete(id) {
    try {
      const { error } = await this.db
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error deleting ${this.tableName}: ${error.message}`);
    }
  }

  async deleteMany(filters) {
    try {
      let query = this.db.from(this.tableName).delete();

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { error } = await query;

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(
        `Error deleting ${this.tableName} records: ${error.message}`
      );
    }
  }

  async count(filters = {}) {
    try {
      let query = this.db
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return count;
    } catch (error) {
      throw new Error(`Error counting ${this.tableName}: ${error.message}`);
    }
  }

  sanitizeForClient(data) {
    if (!data) return null;

    const sanitized = { ...data };

    delete sanitized.password;
    delete sanitized.password_hash;
    delete sanitized.reset_token;
    delete sanitized.verification_token;

    return sanitized;
  }
}

module.exports = BaseModel;
