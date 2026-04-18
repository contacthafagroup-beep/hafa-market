const router = require('express').Router();
const multer = require('multer');
const sharp = require('sharp');
const { protect } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const { uploadLimiter } = require('../config/rateLimiter');

// ===== ALLOWED TYPES WITH MAGIC BYTES =====
const ALLOWED = {
  'image/jpeg':       { ext: ['jpg','jpeg'], magic: [0xFF,0xD8,0xFF] },
  'image/png':        { ext: ['png'],        magic: [0x89,0x50,0x4E,0x47] },
  'image/webp':       { ext: ['webp'],       magic: [0x52,0x49,0x46,0x46] },
  'image/gif':        { ext: ['gif'],        magic: [0x47,0x49,0x46] },
  'video/mp4':        { ext: ['mp4'],        magic: [0x00,0x00,0x00] },
  'audio/mpeg':       { ext: ['mp3'],        magic: [0xFF,0xFB] },
  'audio/webm':       { ext: ['webm'],       magic: [0x1A,0x45,0xDF,0xA3] },
  'application/pdf':  { ext: ['pdf'],        magic: [0x25,0x50,0x44,0x46] },
};

const MAX_SIZES = {
  image: 5  * 1024 * 1024,  // 5MB
  video: 50 * 1024 * 1024,  // 50MB
  audio: 10 * 1024 * 1024,  // 10MB
  application: 10 * 1024 * 1024, // 10MB
};

function validateMagicBytes(buffer, mimeType) {
  const allowed = ALLOWED[mimeType];
  if (!allowed) return false;
  return allowed.magic.every((byte, i) => buffer[i] === byte);
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new AppError(`File type ${file.mimetype} is not allowed.`, 400));
    }
    cb(null, true);
  },
});

async function processAndUpload(file) {
  const mimeType = file.mimetype;
  const category = mimeType.split('/')[0];
  const maxSize  = MAX_SIZES[category] || MAX_SIZES.application;

  if (file.size > maxSize) {
    throw new AppError(`File too large. Max size for ${category}: ${maxSize / 1024 / 1024}MB`, 400);
  }

  // Validate magic bytes
  if (!validateMagicBytes(file.buffer, mimeType)) {
    throw new AppError('File content does not match its declared type.', 400);
  }

  let buffer = file.buffer;
  let uploadMime = mimeType;

  // Auto-optimize images with sharp
  if (category === 'image' && mimeType !== 'image/gif') {
    buffer = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    uploadMime = 'image/webp';
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
    api_key:     process.env.CLOUDINARY_API_KEY,
    api_secret:  process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const folder = category === 'image' ? 'hafa-market/images'
                 : category === 'video' ? 'hafa-market/videos'
                 : category === 'audio' ? 'hafa-market/audio'
                 : 'hafa-market/docs';

    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', format: category === 'image' ? 'webp' : undefined },
      (err, result) => err ? reject(err) : resolve({
        url:       result.secure_url,
        publicId:  result.public_id,
        size:      result.bytes,
        format:    result.format,
        width:     result.width,
        height:    result.height,
        mimeType:  uploadMime,
      })
    ).end(buffer);
  });
}

router.post('/image', protect, uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded.', 400);
    const result = await processAndUpload(req.file);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Alias /video to the same handler (accepts video/* mime types)
router.post('/video', protect, uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded.', 400);
    const result = await processAndUpload(req.file);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/multiple', protect, uploadLimiter, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) throw new AppError('No files uploaded.', 400);
    const results = await Promise.all(req.files.map(processAndUpload));
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

module.exports = router;
