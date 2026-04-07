import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../../config/database.js';
import { users } from '../../db/schema/users.js';
import { fileUploads } from '../../db/schema/file-uploads.js';
import { env } from '../../config/env.js';
import { ValidationError } from '../../lib/errors.js';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadAvatar(
  userId: string,
  orgId: string,
  file: { filename: string; mimetype: string; data: Buffer }
): Promise<{ avatarUrl: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new ValidationError({ file: ['Nur JPEG, PNG und WebP Bilder erlaubt'] });
  }

  if (file.data.length > MAX_AVATAR_SIZE) {
    throw new ValidationError({ file: ['Maximale Dateigröße: 5MB'] });
  }

  const ext = file.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : file.mimetype.split('/')[1];
  const filename = `${userId}-${Date.now()}.${ext}`;
  const dir = path.join(env.UPLOAD_DIR, 'avatars');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), file.data);

  const avatarUrl = `/uploads/avatars/${filename}`;

  // Update user avatar
  await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, userId));

  // Record in file_uploads
  await db.insert(fileUploads).values({
    orgId,
    uploadedBy: userId,
    filename: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.data.length,
    storageKey: path.join(dir, filename),
    entityType: 'avatar',
    entityId: userId,
  });

  return { avatarUrl };
}
