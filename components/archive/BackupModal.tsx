"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ArchiveBackup, RestoreMode } from "../../lib/archive/types";

export default function BackupModal({
  isBackupOpen, isAdmin, backupBusy, restorePreview, restoreFileName,
  restoreMode, setRestoreMode, backupFileRef, backupError, backupNotice,
  closeBackup, downloadArchiveBackup, loadBackupFile, restoreArchiveBackup,
}: {
  isBackupOpen: boolean;
  isAdmin: boolean;
  backupBusy: boolean;
  restorePreview: ArchiveBackup | null;
  restoreFileName: string;
  restoreMode: RestoreMode;
  setRestoreMode: Dispatch<SetStateAction<RestoreMode>>;
  backupFileRef: RefObject<HTMLInputElement | null>;
  backupError: string;
  backupNotice: string;
  closeBackup: () => void;
  downloadArchiveBackup: () => Promise<void>;
  loadBackupFile: (file: File | undefined) => Promise<void>;
  restoreArchiveBackup: () => Promise<void>;
}) {
  return (
      <AnimatePresence>
        {isBackupOpen && isAdmin && (
          <motion.div
            key="backup"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#24231f]/45 p-0 backdrop-blur-[5px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget) closeBackup(); }}
          >
            <motion.section
              role="dialog" aria-modal="true" aria-label="독서 기록 백업 및 복원"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="h-[100dvh] max-h-[100dvh] w-full max-w-[740px] overflow-y-auto overscroll-contain bg-white p-5 text-[#1A1A18] shadow-[0_24px_90px_rgba(0,0,0,.18)] sm:h-auto sm:max-h-[92vh] sm:p-12"
            >
              <div className="mb-8 flex items-start justify-between gap-5 border-b border-black/15 pb-7">
                <div>
                  <p className="mb-4 font-sans text-[10px] font-semibold tracking-[0.23em] text-[#6B665E]">PRIVATE ARCHIVE / ADMIN ONLY</p>
                  <h2 className="text-4xl font-normal tracking-[-0.07em] sm:text-5xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>Backup<span className="italic">.</span></h2>
                  <p className="mt-4 font-sans text-[12px] leading-6 text-[#66615A]">책장과 휴지통의 독서 기록을 JSON 파일로 보관하고 필요할 때 복원할 수 있어요.</p>
                </div>
                <button type="button" onClick={closeBackup} disabled={backupBusy} className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-[#6B665E] hover:text-black disabled:opacity-30" aria-label="백업 창 닫기">×</button>
              </div>

              <div className="border-b border-black/10 pb-9 font-sans">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B665E]">01 / EXPORT</p>
                <h3 className="mb-3 text-[18px] font-medium tracking-[-0.025em]">독서 기록 내려받기</h3>
                <p className="mb-6 text-[12px] leading-6 text-[#66615A]">현재 책장과 휴지통 전체를 백업해요. 감상문·인용문·독서 진행률도 포함됩니다.</p>
                <button type="button" disabled={backupBusy} onClick={() => void downloadArchiveBackup()} className="inline-flex min-h-11 items-center justify-center bg-[#1B1B19] px-6 text-[11px] font-semibold tracking-[0.12em] text-white transition-opacity hover:opacity-75 disabled:opacity-40">
                  {backupBusy ? "PLEASE WAIT..." : "DOWNLOAD JSON ↗"}
                </button>
              </div>

              <div className="py-9 font-sans">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B665E]">02 / RESTORE</p>
                <h3 className="mb-3 text-[18px] font-medium tracking-[-0.025em]">백업 파일 불러오기</h3>
                <p className="mb-5 text-[12px] leading-6 text-[#66615A]">먼저 JSON 파일을 검사해요. 파일 선택만으로 Firebase 데이터가 바뀌지는 않아요.</p>
                <input ref={backupFileRef} type="file" accept=".json,application/json" disabled={backupBusy}
                  aria-label="독서 기록 백업 JSON 선택"
                  onChange={(event) => { void loadBackupFile(event.target.files?.[0]); }}
                  className="block w-full max-w-full text-[12px] text-[#57534D] file:mr-4 file:min-h-11 file:cursor-pointer file:border file:border-[#CBC5BB] file:bg-white file:px-4 file:text-[11px] file:font-semibold file:uppercase file:tracking-[0.1em] file:text-[#262520] disabled:opacity-40" />
                {restorePreview && (
                  <div className="mt-6 border border-[#E4E0D9] p-4 sm:p-5">
                    <p className="mb-2 break-all text-[11px] text-[#66615A]">FILE / {restoreFileName}</p>
                    <p className="text-[13px] font-medium">책 {restorePreview.books.length}권 · 휴지통 {restorePreview.trash.length}권</p>
                    <p className="mt-2 text-[11px] leading-5 text-[#777168]">백업 시각: {new Date(restorePreview.exportedAt).toLocaleString("ko-KR")}</p>
                    <div className="mt-6 space-y-3 text-[12px] text-[#4C4842]">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="radio" name="restore-mode" checked={restoreMode === "missing"} disabled={backupBusy} onChange={() => setRestoreMode("missing")} className="mt-1" />
                        <span><strong>누락된 기록만 복원 (추천)</strong><span className="mt-1 block text-[11px] leading-5 text-[#777168]">같은 ID가 이미 있으면 건너뛰고, 현재 기록은 그대로 둡니다.</span></span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="radio" name="restore-mode" checked={restoreMode === "overwrite"} disabled={backupBusy} onChange={() => setRestoreMode("overwrite")} className="mt-1" />
                        <span><strong>같은 ID의 기록 덮어쓰기</strong><span className="mt-1 block text-[11px] leading-5 text-[#777168]">실수로 감상문을 수정했다면 이전 백업으로 되돌릴 수 있어요. 현재 변경사항은 사라집니다.</span></span>
                      </label>
                    </div>
                    <button type="button" disabled={backupBusy || restorePreview.books.length + restorePreview.trash.length === 0} onClick={() => void restoreArchiveBackup()}
                      className="mt-7 inline-flex min-h-11 items-center justify-center border border-[#24231f] px-6 text-[11px] font-semibold tracking-[0.12em] text-[#24231f] transition-colors hover:bg-[#F7F7F5] disabled:opacity-35">
                      {backupBusy ? "RESTORING..." : "RESTORE RECORDS ↗"}
                    </button>
                  </div>
                )}
              </div>
              {backupError && <p role="alert" className="border-t border-black/10 py-4 font-sans text-[12px] leading-6 text-red-800">{backupError}</p>}
              {backupNotice && <p role="status" className="border-t border-black/10 py-4 font-sans text-[12px] leading-6 text-[#4C4842]">{backupNotice}</p>}
              <p className="border-t border-black/10 pt-5 font-sans text-[11px] leading-6 text-[#777168]">백업에는 독서 감상 등 개인 기록이 들어 있어요. JSON 파일을 공개 GitHub에 업로드하지 마세요. 모든 복원은 현재 Firebase 프로젝트 안에서만 진행됩니다.</p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

  );
}
