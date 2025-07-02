const validateModel = (ModelClass, schema) => {
  return (req, res, next) => {
    try {
      req.validatedData = ModelClass.validate(req.body, schema);
      next();
    } catch (error) {
      if (error.isValidation) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details,
          code: 'VALIDATION_ERROR',
        });
      }

      return res.status(500).json({
        error: 'Validation processing failed',
        message: error.message,
        code: 'VALIDATION_PROCESSING_ERROR',
      });
    }
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return res.status(400).json({
          error: 'Query validation failed',
          details,
          code: 'QUERY_VALIDATION_ERROR',
        });
      }

      req.validatedQuery = value;
      next();
    } catch (err) {
      return res.status(500).json({
        error: 'Query validation processing failed',
        message: err.message,
        code: 'QUERY_VALIDATION_PROCESSING_ERROR',
      });
    }
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return res.status(400).json({
          error: 'Parameter validation failed',
          details,
          code: 'PARAMS_VALIDATION_ERROR',
        });
      }

      req.validatedParams = value;
      next();
    } catch (err) {
      return res.status(500).json({
        error: 'Parameter validation processing failed',
        message: err.message,
        code: 'PARAMS_VALIDATION_PROCESSING_ERROR',
      });
    }
  };
};

const sanitizeOutput = (ModelClass) => {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          data = data.map((item) => {
            if (item && typeof item === 'object') {
              const model = new ModelClass();
              return model.sanitizeForClient(item);
            }
            return item;
          });
        } else if (data.user) {
          const model = new ModelClass();
          data.user = model.sanitizeForClient(data.user);
        } else if (data.users) {
          const model = new ModelClass();
          data.users = data.users.map((user) => model.sanitizeForClient(user));
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  validateModel,
  validateQuery,
  validateParams,
  sanitizeOutput,
};
