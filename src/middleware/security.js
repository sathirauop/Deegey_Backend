const helmet = require('helmet');

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Enforce HTTPS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict permissions
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Content Security Policy
const contentSecurityPolicy = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ['\'self\''],
    scriptSrc: ['\'self\'', '\'unsafe-inline\''],
    styleSrc: ['\'self\'', '\'unsafe-inline\''],
    imgSrc: ['\'self\'', 'data:', 'https:'],
    connectSrc: ['\'self\''],
    fontSrc: ['\'self\''],
    objectSrc: ['\'none\''],
    mediaSrc: ['\'self\''],
    frameSrc: ['\'none\''],
  },
});

// URL validation for photos
const validatePhotoUrl = (url) => {
  try {
    const urlObj = new URL(url);
    
    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs allowed');
    }
    
    // Whitelist allowed domains
    const allowedDomains = [
      'storage.supabase.co',
      'supabase.co',
      // Add your CDN domains here
    ];
    
    if (process.env.ALLOWED_IMAGE_DOMAINS) {
      allowedDomains.push(...process.env.ALLOWED_IMAGE_DOMAINS.split(','));
    }
    
    const isAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      throw new Error('Image domain not allowed');
    }
    
    // Prevent localhost/internal IPs
    const internalPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^\[::1\]$/,
    ];
    
    if (internalPatterns.some(pattern => pattern.test(urlObj.hostname))) {
      throw new Error('Internal URLs not allowed');
    }
    
    return true;
  } catch (error) {
    throw new Error('Invalid photo URL');
  }
};

// Text sanitization helper
const sanitizeText = (text) => {
  if (!text) return text;
  
  // Remove any HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  const MAX_LENGTH = 5000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }
  
  return sanitized;
};

module.exports = {
  helmet,
  securityHeaders,
  contentSecurityPolicy,
  validatePhotoUrl,
  sanitizeText,
};