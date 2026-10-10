"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { BookForm, ReadingStatus } from "../../lib/archive/types";
import { todayString } from "../../lib/archive/utils";

const fieldClass =
  "mt-2 block w-full rounded-none border-b border-[#c9c7c1] bg-transparent px-0 py-3 text-[16px] text-[#262520] outline-none placeholder:text-[#716C64] focus:border-[#24231f] sm:text-[14px]";

export default function BookFormModal({
  isFormOpen, isAdmin, isSaving, editingBookId, form, setForm,
  handleSubmit, closeForm,
}: {
  isFormOpen: boolean;
  isAdmin: boolean;
  isSaving: boolean;
  editingBookId: string | null;
  form: BookForm;
  setForm: Dispatch<SetStateAction<BookForm>>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  closeForm: () => void;
}) {
  return (
      <AnimatePresence>
        {isFormOpen && isAdmin && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#24231f]/45 p-0 backdrop-blur-[5px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) closeForm(); }}
          >
            <motion.section
              role="dialog" aria-modal="true" aria-label={editingBookId ? "책 수정" : "책 등록"}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="h-[100dvh] max-h-[100dvh] w-full max-w-[710px] overflow-y-auto overscroll-contain bg-white p-5 text-[#1A1A18] shadow-[0_24px_90px_rgba(0,0,0,.18)] sm:h-auto sm:max-h-[92vh] sm:p-12"
            >
              <div className="mb-8 flex items-start justify-between gap-5 border-b border-black/15 pb-7">
                <div>
                  <p className="mb-4 text-[10px] font-semibold tracking-[0.23em] text-[#6B665E]">ARCHIVE EDITOR</p>
                  <h2 className="text-4xl font-normal tracking-[-0.07em] sm:text-5xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{editingBookId ? "Edit a book." : "Add a book."}</h2>
                </div>
                <button type="button" onClick={closeForm} disabled={isSaving} className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-[#6B665E] hover:text-black" aria-label="입력창 닫기">×</button>
              </div>
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-7">
                <div className="grid gap-7 sm:grid-cols-2">
                  <label className="block text-[12px] text-[#77746c]">책 제목 *
                    <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="책 제목" className={fieldClass} />
                  </label>
                  <label className="block text-[12px] text-[#77746c]">작가 *
                    <input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="작가" className={fieldClass} />
                  </label>
                  <label className="block text-[12px] text-[#77746c]">독서 상태
                    <select value={form.status} onChange={(event) => {
                      const status = event.target.value as ReadingStatus;
                      setForm({
                        ...form,
                        status,
                        startDate: status === "읽는 중" && !form.startDate ? todayString() : form.startDate,
                        finishedDate: status === "완독" && !form.finishedDate ? todayString() : form.finishedDate,
                      });
                    }} className={fieldClass}>
                      <option value="완독">완독</option><option value="읽는 중">읽는 중</option>
                    </select>
                  </label>
                  <label className="block text-[12px] text-[#77746c]">독서 시작일 (선택)
                    <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={fieldClass} />
                  </label>
                  {form.status === "완독" && (
                    <label className="block text-[12px] text-[#77746c]">완독일 (선택)
                      <input type="date" min={form.startDate || undefined} value={form.finishedDate} onChange={(event) => setForm({ ...form, finishedDate: event.target.value })} className={fieldClass} />
                    </label>
                  )}
                </div>
                {form.status === "읽는 중" && (
                  <div className="border-y border-[#E4E0D9] py-6 font-sans">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B665E]">READING PROGRESS / 페이지 기록</p>
                    <p className="mb-5 text-[11px] leading-6 text-[#6B665E]">전체 페이지 수와 현재 읽은 페이지를 입력하면 책에 진행률이 표시돼요. 둘 다 비워둘 수도 있어요.</p>
                    <div className="grid grid-cols-2 gap-5">
                      <label className="block text-[12px] text-[#57534D]">전체 페이지 수
                        <input type="number" min={1} step={1} inputMode="numeric" value={form.totalPages} onChange={(event) => setForm({ ...form, totalPages: event.target.value })} placeholder="예: 350" className={fieldClass} />
                      </label>
                      <label className="block text-[12px] text-[#57534D]">현재 읽은 페이지
                        <input type="number" min={0} step={1} inputMode="numeric" value={form.currentPage} onChange={(event) => setForm({ ...form, currentPage: event.target.value })} placeholder="예: 140" className={fieldClass} />
                      </label>
                    </div>
                    {form.totalPages.trim() && /^\d+$/.test(form.totalPages.trim()) && Number.isSafeInteger(Number(form.totalPages)) && Number(form.totalPages) > 0 && /^\d*$/.test(form.currentPage.trim()) && Number.isSafeInteger(Number(form.currentPage || 0)) && Number(form.currentPage || 0) <= Number(form.totalPages) && (
                      <div className="mt-4 space-y-2">
                        <p className="font-mono text-[11px] tabular-nums text-[#57534D]">
                          현재 진행률: {Math.round((Number(form.currentPage || 0) / Number(form.totalPages)) * 100)}%
                        </p>
                        {form.currentPage.trim() !== "" && Number(form.currentPage) === Number(form.totalPages) && (
                          <p role="status" className="text-[12px] font-semibold leading-6 text-[#38362F]">
                            마지막 페이지까지 읽었어요! 저장하면 자동으로 완독 처리하고 완독일을 기록해요.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <label className="block text-[12px] text-[#77746c]">책 표지 이미지 URL
                  <input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." className={fieldClass} />
                </label>
                <label className="block text-[12px] text-[#77746c]">기억하고 싶은 문장 (선택)
                  <textarea rows={2} value={form.quote || ""} onChange={(event) => setForm({ ...form, quote: event.target.value })} placeholder="오래 기억하고 싶은 한 문장" className={`${fieldClass} resize-y`} />
                </label>
                <label className="block text-[12px] text-[#77746c]">독서 감상 (선택)
                  <textarea rows={4} value={form.review || ""} onChange={(event) => setForm({ ...form, review: event.target.value })} placeholder="책을 읽고 난 후의 생각들" className={`${fieldClass} resize-y`} />
                </label>
                <div className="flex justify-end gap-6 border-t border-black/15 pt-7 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <button type="button" disabled={isSaving} onClick={closeForm} className="text-[#77756F] hover:text-black">CANCEL</button>
                  <button type="submit" disabled={isSaving} className="bg-[#1B1B19] px-7 py-4 text-white transition-colors hover:bg-[#494841] disabled:opacity-50">
                    {isSaving ? "SAVING..." : editingBookId ? "SAVE CHANGES ↗" : "ADD BOOK ↗"}
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
  );
}
