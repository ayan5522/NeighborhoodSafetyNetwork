const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { apiError } = require('../utils/response');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/incidents');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

// Multer Upload Instance
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      const err = new Error('Unsupported file type. Allowed formats: JPEG, PNG, WEBP.');
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  },
});

/**
 * Middleware wrapper for handling incident image attachment with friendly error codes.
 */
function handleIncidentImage(req, res, next) {
  const singleUpload = upload.single('image');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return apiError(res, 413, 'Image file size exceeds the 5MB limit.');
      }
      if (err.code === 'UNSUPPORTED_FILE_TYPE') {
        return apiError(res, 415, err.message);
      }
      return apiError(res, 400, `Upload error: ${err.message}`);
    }

    // If file was uploaded, attach normalized public URL path
    if (req.file) {
      req.body.image_url = `/uploads/incidents/${req.file.filename}`;
    }

    next();
  });
}

module.exports = {
  handleIncidentImage,
  UPLOADS_DIR,
};
