import type { ArchiveBackup, BackupData, BackupRecord } from "./types";

const BACKUP_STRING_FIELDS = ["title", "author", "date", "imageUrl", "status", "quote", "review"] as const;
const BACKUP_NUMBER_FIELDS = ["createdAt", "totalPages", "currentPage", "trashedAt"] as const;
export const BACKUP_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const BACKUP_MAX_RECORDS = 5000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBackupData(value: unknown, source: "books" | "trash"): BackupData {
  if (!isPlainObject(value)) throw new Error("책 데이터 형식이 올바르지 않아요.");
  const data: BackupData = {};
  for (const key of BACKUP_STRING_FIELDS) {
    if (!(key in value)) continue;
    const item = value[key];
    if (typeof item !== "string") throw new Error(`책 데이터의 ${key} 값이 문자열이 아니에요.`);
    data[key] = item;
  }
  for (const key of BACKUP_NUMBER_FIELDS) {
    if (key === "trashedAt" && source !== "trash") continue;
    if (!(key in value)) continue;
    const item = value[key];
    if (item !== null && (typeof item !== "number" || !Number.isFinite(item))) {
      throw new Error(`책 데이터의 ${key} 값이 올바르지 않아요.`);
    }
    data[key] = item as number | null;
  }
  if (data.status !== undefined && data.status !== "완독" && data.status !== "읽는 중") {
    throw new Error("독서 상태가 올바르지 않아요.");
  }
  for (const field of ["totalPages", "currentPage", "createdAt", "trashedAt"] as const) {
    const num = data[field];
    if (typeof num === "number" && !Number.isSafeInteger(num)) {
      throw new Error(`${field} 값이 올바르지 않아요.`);
    }
  }
  if (typeof data.totalPages === "number" && data.totalPages <= 0) throw new Error("전체 페이지 수가 올바르지 않아요.");
  if (typeof data.currentPage === "number" && (data.currentPage < 0 ||
      (typeof data.totalPages === "number" && data.currentPage > data.totalPages))) {
    throw new Error("현재 읽은 페이지 수가 올바르지 않아요.");
  }
  return data;
}

export function parseArchiveBackup(value: unknown, currentProjectId: string): ArchiveBackup {
  if (!isPlainObject(value) || value.format !== "kwons-archive" || value.version !== 1) {
    throw new Error("KWON'S ARCHIVE 백업 파일(v1)이 아니에요.");
  }
  if (typeof value.projectId !== "string" || value.projectId !== currentProjectId) {
    throw new Error("다른 Firebase 프로젝트의 백업이에요. 현재 아카이브와 프로젝트가 일치해야 해요.");
  }
  if (typeof value.exportedAt !== "string" || !Array.isArray(value.books) || !Array.isArray(value.trash)) {
    throw new Error("백업 파일의 구성 정보가 잘못되었어요.");
  }
  if (value.books.length + value.trash.length > BACKUP_MAX_RECORDS) {
    throw new Error("백업에 포함된 책이 너무 많아요.");
  }
  const parseRecords = (items: unknown[], source: "books" | "trash"): BackupRecord[] => {
    const seen = new Set<string>();
    return items.map((item) => {
      if (!isPlainObject(item) || typeof item.id !== "string" ||
          !item.id.trim() || item.id.includes("/") || item.id.length > 1500 ||
          /^__.*__$/.test(item.id) || seen.has(item.id)) {
        throw new Error(`${source} 컬렉션의 책 ID가 올바르지 않거나 중복되었어요.`);
      }
      seen.add(item.id);
      return { id: item.id, data: normalizeBackupData(item.data, source) };
    });
  };
  const books = parseRecords(value.books, "books");
  const trash = parseRecords(value.trash, "trash");
  const bookIds = new Set(books.map((entry) => entry.id));
  if (trash.some((entry) => bookIds.has(entry.id))) {
    throw new Error("같은 책 ID가 책장과 휴지통에 동시에 들어 있는 백업은 복원할 수 없어요.");
  }
  return {
    format: "kwons-archive",
    version: 1,
    projectId: value.projectId,
    exportedAt: value.exportedAt,
    books,
    trash,
  };
}

