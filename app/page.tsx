"use client";

import { LayoutGroup } from "framer-motion";
import { useArchiveController } from "../hooks/useArchiveController";
import BookshelfGallery from "../components/archive/BookshelfGallery";
import ArchiveIndex from "../components/archive/ArchiveIndex";
import BookDetail from "../components/archive/BookDetail";
import TrashModal from "../components/archive/TrashModal";
import BackupModal from "../components/archive/BackupModal";
import BookFormModal from "../components/archive/BookFormModal";

/** KWON'S ARCHIVE: 화면 컴포넌트를 조합하는 엔트리 포인트. */
export default function Home() {
  const {
    books, isLoading, isSaving, error, sortBy,
    setSortBy, isSearchOpen, setIsSearchOpen, searchQuery, setSearchQuery,
    searchInputRef, prefersReducedMotion, isFormOpen, editingBookId, selectionSource,
    form, setForm, authUser, authReady, authBusy,
    authError, trashedBooks, isTrashOpen, isTrashLoading, trashError,
    trashBusyId, isBackupOpen, backupBusy, backupError, backupNotice,
    restorePreview, restoreFileName, restoreMode, setRestoreMode, backupFileRef,
    adminUid, isAdmin, sortedBooks, filteredBooks, selectedBook,
    completedCount, readingCount, handleLogin, handleLogout, fetchBooks,
    fetchTrash, openTrash, openBackup, closeBackup, downloadArchiveBackup,
    loadBackupFile, restoreArchiveBackup, closeSearch, selectBook, closeForm,
    openAddForm, openEditForm, handleSubmit, handleDeleteBook, handleRestoreBook,
    handleDeleteForever, setSelectedBookId, setIsTrashOpen,
  } = useArchiveController();

  return (
    <LayoutGroup id="reading-archive-exhibition">
      <div className="min-h-screen bg-white text-[#1A1A18] selection:bg-[#22211f] selection:text-white" style={{ fontFamily: 'Georgia, "AppleMyungjo", "Nanum Myeongjo", "Batang", serif' }}>
        <BookshelfGallery
          books={sortedBooks}
          onSelect={selectBook}
          onAdd={openAddForm}
          onOpenTrash={openTrash}
          onOpenBackup={openBackup}
          isLoading={isLoading}
          isAdmin={isAdmin}
          authUser={authUser}
          authReady={authReady}
          authBusy={authBusy}
          authError={authError}
          hasAdminConfig={Boolean(adminUid)}
          onLogin={() => void handleLogin()}
          onLogout={() => void handleLogout()}
        />
        <ArchiveIndex
          books={books}
          completedCount={completedCount}
          readingCount={readingCount}
          filteredBooks={filteredBooks}
          sortBy={sortBy}
          setSortBy={setSortBy}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchInputRef={searchInputRef}
          closeSearch={closeSearch}
          error={error}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onSelect={selectBook}
          onAdd={openAddForm}
        />
        <BookDetail
          selectedBook={selectedBook}
          sortedBooks={sortedBooks}
          selectionSource={selectionSource}
          prefersReducedMotion={prefersReducedMotion}
          isAdmin={isAdmin}
          onClose={() => setSelectedBookId(null)}
          onEdit={openEditForm}
          onDelete={handleDeleteBook}
          onSaved={fetchBooks}
        />
        <TrashModal
          isTrashOpen={isTrashOpen}
          isAdmin={isAdmin}
          trashedBooks={trashedBooks}
          trashError={trashError}
          isTrashLoading={isTrashLoading}
          trashBusyId={trashBusyId}
          onClose={() => setIsTrashOpen(false)}
          onRestore={handleRestoreBook}
          onDeleteForever={handleDeleteForever}
          onRefresh={fetchTrash}
        />
        <BackupModal
          isBackupOpen={isBackupOpen}
          isAdmin={isAdmin}
          backupBusy={backupBusy}
          restorePreview={restorePreview}
          restoreFileName={restoreFileName}
          restoreMode={restoreMode}
          setRestoreMode={setRestoreMode}
          backupFileRef={backupFileRef}
          backupError={backupError}
          backupNotice={backupNotice}
          closeBackup={closeBackup}
          downloadArchiveBackup={downloadArchiveBackup}
          loadBackupFile={loadBackupFile}
          restoreArchiveBackup={restoreArchiveBackup}
        />
        <BookFormModal
          isFormOpen={isFormOpen}
          isAdmin={isAdmin}
          isSaving={isSaving}
          editingBookId={editingBookId}
          form={form}
          setForm={setForm}
          handleSubmit={handleSubmit}
          closeForm={closeForm}
        />
      </div>
    </LayoutGroup>
  );
}
