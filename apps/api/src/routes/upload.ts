import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { uploadImage } from '../services/s3Service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const uploadRouter = Router();

uploadRouter.post(
  '/api/admin/upload',
  authMiddleware,
  requireRole('admin'),
  upload.array('images', 10),
  async (req, res) => {
    const files = (req as { files?: Express.Multer.File[] }).files ?? [];
    const urls = await Promise.all(files.map((f) => uploadImage(f)));
    res.json({ urls });
  },
);

uploadRouter.post(
  '/api/upload/avatar',
  authMiddleware,
  upload.single('avatar'),
  async (req, res) => {
    const file = (req as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const url = await uploadImage(file, 'avatars');
    res.json({ url });
  },
);
