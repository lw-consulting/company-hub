import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../../config/database.js';
import { users } from '../../db/schema/users.js';
import { organizations } from '../../db/schema/organizations.js';
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

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

export async function uploadLogo(
  orgId: string,
  file: { filename: string; mimetype: string; data: Buffer }
): Promise<{ logoUrl: string }> {
  if (!ALLOWED_LOGO_TYPES.includes(file.mimetype)) {
    throw new ValidationError({ file: ['Nur JPEG, PNG, WebP oder SVG erlaubt'] });
  }
  if (file.data.length > MAX_LOGO_SIZE) {
    throw new ValidationError({ file: ['Maximale Dateigröße: 2MB'] });
  }

  const ext = file.mimetype === 'image/svg+xml' ? 'svg'
    : file.mimetype.split('/')[1] === 'jpeg' ? 'jpg'
    : file.mimetype.split('/')[1];
  const filename = `${orgId}-${Date.now()}.${ext}`;
  const dir = path.join(env.UPLOAD_DIR, 'logos');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), file.data);

  const logoUrl = `/uploads/logos/${filename}`;
  await db.update(organizations).set({ logoUrl, updatedAt: new Date() }).where(eq(organizations.id, orgId));
  return { logoUrl };
}

const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
];
const MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50MB

export async function uploadPostMedia(
  userId: string,
  orgId: string,
  file: { filename: string; mimetype: string; data: Buffer }
): Promise<{ url: string; mimetype: string; filename: string; size: number }> {
  if (!ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
    throw new ValidationError({ file: [`Dateityp ${file.mimetype} nicht erlaubt`] });
  }
  if (file.data.length > MAX_MEDIA_SIZE) {
    throw new ValidationError({ file: ['Maximale Dateigröße: 50MB'] });
  }

  // Sanitize filename
  const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${randomUUID()}-${safeName}`;
  const dir = path.join(env.UPLOAD_DIR, 'posts');

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), file.data);

  const url = `/uploads/posts/${filename}`;

  await db.insert(fileUploads).values({
    orgId,
    uploadedBy: userId,
    filename: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.data.length,
    storageKey: path.join(dir, filename),
    entityType: 'post',
  });

  return { url, mimetype: file.mimetype, filename: file.filename, size: file.data.length };
}
