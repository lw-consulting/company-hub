import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { aiAssistantDocuments, aiAssistants, aiDocumentChunks } from '../../db/schema/ai-assistants.js';
import { NotFoundError } from '../../lib/errors.js';
import { chunkText } from './chunker.js';

const MAX_TEXT_LENGTH = 200_000;

const SEARCH_STOP_WORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'ist', 'sind', 'hat', 'haben', 'wird', 'werden',
  'fuer', 'von', 'mit', 'auf', 'aus', 'bei', 'the', 'and', 'for', 'with', 'from', 'that', 'this',
  'was', 'wie', 'wer', 'den', 'dem', 'des', 'nicht', 'sich', 'auch', 'noch', 'kann', 'ich', 'mir',
  'mich', 'bitte', 'welcher', 'welche', 'wieviel',
]);

function normalizeText(text: string) {
  const normalized = text.replace(/\u0000/g, '').trim();
  if (normalized.length <= MAX_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TEXT_LENGTH)}\n\n[... Dokument gekuerzt ...]`;
}

function tokenizeQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9.,/\-\s]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));
}

function scorePassage(passage: string, keywords: string[], rawQuery: string) {
  const normalizedPassage = passage.toLowerCase();
  const normalizedQuery = rawQuery.toLowerCase().trim();
  let score = 0;

  if (normalizedQuery && normalizedPassage.includes(normalizedQuery)) {
    score += 16;
  }

  for (const keyword of keywords) {
    if (!normalizedPassage.includes(keyword)) {
      continue;
    }

    score += /^\d+[a-z/-]*$/i.test(keyword) ? 9 : 5;
  }

  if (/[0-9]/.test(normalizedPassage)) {
    score += 2;
  }

  if (normalizedPassage.includes('|')) {
    score += 3;
  }

  return score;
}

export function extractTextFromBuffer(buffer: Buffer, fileType: string) {
  if (!['txt', 'md', 'csv', 'xml', 'json'].includes(fileType)) {
    throw new Error(`Dateityp .${fileType} wird in dieser Version nicht unterstuetzt`);
  }

  return normalizeText(buffer.toString('utf8'));
}

export async function listDocuments(assistantId: string, orgId: string) {
  const [assistant] = await db
    .select({ id: aiAssistants.id })
    .from(aiAssistants)
    .where(and(eq(aiAssistants.id, assistantId), eq(aiAssistants.orgId, orgId)))
    .limit(1);

  if (!assistant) {
    throw new NotFoundError('Assistent nicht gefunden');
  }

  return db
    .select()
    .from(aiAssistantDocuments)
    .where(eq(aiAssistantDocuments.assistantId, assistantId))
    .orderBy(aiAssistantDocuments.createdAt);
}

export async function createDocumentFromText(params: {
  assistantId: string;
  orgId: string;
  filename: string;
  fileType: string;
  mimeType?: string | null;
  fileSize: number;
  textContent: string;
  uploadedBy: string;
}) {
  const [assistant] = await db
    .select({ id: aiAssistants.id })
    .from(aiAssistants)
    .where(and(eq(aiAssistants.id, params.assistantId), eq(aiAssistants.orgId, params.orgId)))
    .limit(1);

  if (!assistant) {
    throw new NotFoundError('Assistent nicht gefunden');
  }

  const normalizedText = normalizeText(params.textContent);

  const [document] = await db
    .insert(aiAssistantDocuments)
    .values({
      assistantId: params.assistantId,
      filename: params.filename,
      fileType: params.fileType,
      mimeType: params.mimeType ?? null,
      fileSize: params.fileSize,
      textContent: normalizedText,
      includeInPrompt: true,
      uploadedBy: params.uploadedBy,
    })
    .returning();

  const chunks = chunkText(normalizedText);
  if (chunks.length > 0) {
    await db.insert(aiDocumentChunks).values(
      chunks.map((content, chunkIndex) => ({
        documentId: document.id,
        assistantId: params.assistantId,
        content,
        chunkIndex,
      })),
    );
  }

  return document;
}

export async function deleteDocument(documentId: string, orgId: string) {
  const [document] = await db
    .select({ id: aiAssistantDocuments.id })
    .from(aiAssistantDocuments)
    .innerJoin(aiAssistants, eq(aiAssistantDocuments.assistantId, aiAssistants.id))
    .where(and(eq(aiAssistantDocuments.id, documentId), eq(aiAssistants.orgId, orgId)))
    .limit(1);

  if (!document) {
    throw new NotFoundError('Dokument nicht gefunden');
  }

  await db.delete(aiAssistantDocuments).where(eq(aiAssistantDocuments.id, documentId));
}

export async function toggleIncludeInPrompt(documentId: string, orgId: string, includeInPrompt: boolean) {
  const [document] = await db
    .select({
      id: aiAssistantDocuments.id,
      assistantId: aiAssistantDocuments.assistantId,
      textContent: aiAssistantDocuments.textContent,
    })
    .from(aiAssistantDocuments)
    .innerJoin(aiAssistants, eq(aiAssistantDocuments.assistantId, aiAssistants.id))
    .where(and(eq(aiAssistantDocuments.id, documentId), eq(aiAssistants.orgId, orgId)))
    .limit(1);

  if (!document) {
    throw new NotFoundError('Dokument nicht gefunden');
  }

  await db
    .update(aiAssistantDocuments)
    .set({
      includeInPrompt,
      updatedAt: new Date(),
    })
    .where(eq(aiAssistantDocuments.id, documentId));

  await db.delete(aiDocumentChunks).where(eq(aiDocumentChunks.documentId, documentId));

  if (includeInPrompt) {
    const chunks = chunkText(document.textContent);
    if (chunks.length > 0) {
      await db.insert(aiDocumentChunks).values(
        chunks.map((content, chunkIndex) => ({
          documentId,
          assistantId: document.assistantId,
          content,
          chunkIndex,
        })),
      );
    }
  }
}

export async function getIncludedDocuments(assistantId: string) {
  const documents = await db
    .select({
      filename: aiAssistantDocuments.filename,
      textContent: aiAssistantDocuments.textContent,
    })
    .from(aiAssistantDocuments)
    .where(and(eq(aiAssistantDocuments.assistantId, assistantId), eq(aiAssistantDocuments.includeInPrompt, true)));

  return documents.map((document) => ({
    filename: document.filename,
    content: document.textContent,
  }));
}

export async function searchRelevantPassages(assistantId: string, query: string, maxPassages = 6) {
  const documents = await getIncludedDocuments(assistantId);
  const keywords = tokenizeQuery(query);

  const passages: Array<{ filename: string; content: string; score: number }> = [];

  for (const document of documents) {
    const lines = document.content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const passage = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join('\n');
      const score = scorePassage(passage, keywords, query);
      if (score <= 0) {
        continue;
      }

      passages.push({
        filename: document.filename,
        content: passage,
        score,
      });
    }
  }

  return passages
    .sort((a, b) => b.score - a.score)
    .filter((passage, index, list) => list.findIndex((candidate) =>
      candidate.filename === passage.filename && candidate.content === passage.content) === index)
    .slice(0, maxPassages)
    .map(({ filename, content }) => ({ filename, content }));
}

export async function searchRelevantChunks(assistantId: string, query: string, maxChunks = 8) {
  const keywords = tokenizeQuery(query);

  if (keywords.length === 0) {
    const chunks = await db
      .select({
        content: aiDocumentChunks.content,
        filename: aiAssistantDocuments.filename,
      })
      .from(aiDocumentChunks)
      .innerJoin(aiAssistantDocuments, eq(aiDocumentChunks.documentId, aiAssistantDocuments.id))
      .where(
        and(
          eq(aiDocumentChunks.assistantId, assistantId),
          eq(aiAssistantDocuments.includeInPrompt, true),
        ),
      )
      .orderBy(aiDocumentChunks.chunkIndex)
      .limit(maxChunks);

    return chunks.map((chunk) => ({ filename: chunk.filename, content: chunk.content }));
  }

  const searchConditions = keywords.map((keyword) =>
    sql`${aiDocumentChunks.content} ILIKE ${`%${keyword}%`}`,
  );
  const matchCondition = sql.join(searchConditions, sql` OR `);
  const matchScore = sql.join(
    keywords.map((keyword) => sql`CASE WHEN ${aiDocumentChunks.content} ILIKE ${`%${keyword}%`} THEN 1 ELSE 0 END`),
    sql` + `,
  );

  const chunks = await db
    .select({
      content: aiDocumentChunks.content,
      filename: aiAssistantDocuments.filename,
      score: matchScore.as('score'),
    })
    .from(aiDocumentChunks)
    .innerJoin(aiAssistantDocuments, eq(aiDocumentChunks.documentId, aiAssistantDocuments.id))
    .where(
      and(
        eq(aiDocumentChunks.assistantId, assistantId),
        eq(aiAssistantDocuments.includeInPrompt, true),
        matchCondition,
      ),
    )
    .orderBy(sql`score DESC`)
    .limit(maxChunks);

  return chunks.map((chunk) => ({ filename: chunk.filename, content: chunk.content }));
}
