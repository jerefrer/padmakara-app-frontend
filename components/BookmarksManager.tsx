import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bookmark } from '@/types';
import i18n from '@/utils/i18n';

const colors = {
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface BookmarksManagerProps {
  trackId: string;
  currentPosition: number; // in milliseconds
  onSeekToBookmark: (position: number) => void;
}

export function BookmarksManager({ trackId, currentPosition, onSeekToBookmark }: BookmarksManagerProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBookmarkNote, setNewBookmarkNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const bookmarksKey = `bookmarks_${trackId}`;

  useEffect(() => {
    loadBookmarks();
  }, [trackId]);

  const loadBookmarks = async () => {
    try {
      setIsLoading(true);
      const savedBookmarks = await AsyncStorage.getItem(bookmarksKey);
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        setBookmarks(parsed.sort((a: Bookmark, b: Bookmark) => a.position - b.position));
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBookmarks = async (newBookmarks: Bookmark[]) => {
    try {
      await AsyncStorage.setItem(bookmarksKey, JSON.stringify(newBookmarks));
      setBookmarks(newBookmarks.sort((a, b) => a.position - b.position));
    } catch (error) {
      console.error('Error saving bookmarks:', error);
    }
  };

  const addBookmark = async () => {
    if (newBookmarkNote.trim().length === 0) {
      Alert.alert('Error', 'Please enter a note for the bookmark');
      return;
    }

    const newBookmark: Bookmark = {
      id: `bookmark_${Date.now()}`,
      trackId,
      position: Math.floor(currentPosition / 1000), // Convert to seconds
      note: newBookmarkNote.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedBookmarks = [...bookmarks, newBookmark];
    await saveBookmarks(updatedBookmarks);
    
    setNewBookmarkNote('');
    setShowAddModal(false);
    
    Alert.alert('Success', 'Bookmark added successfully');
  };

  const deleteBookmark = async (bookmarkId: string) => {
    Alert.alert(
      'Delete Bookmark',
      'Are you sure you want to delete this bookmark?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
            await saveBookmarks(updatedBookmarks);
          },
        },
      ]
    );
  };

  const seekToBookmark = (bookmark: Bookmark) => {
    onSeekToBookmark(bookmark.position * 1000); // Convert to milliseconds
    setShowModal(false);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderBookmarkItem = ({ item }: { item: Bookmark }) => (
    <View style={styles.bookmarkItem}>
      <TouchableOpacity 
        onPress={() => seekToBookmark(item)}
        style={styles.bookmarkContent}
      >
        <View>
          <Text style={styles.bookmarkTime}>{formatTime(item.position)}</Text>
          <Text style={styles.bookmarkNote} numberOfLines={2}>
            {item.note}
          </Text>
        </View>
        <Ionicons name="play-circle-outline" size={24} color={colors.burgundy[500]} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => deleteBookmark(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={20} color={colors.gray[500]} />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      {/* Bookmarks Button */}
      <TouchableOpacity onPress={() => setShowModal(true)} style={styles.bookmarksButton}>
        <Ionicons name="bookmarks-outline" size={20} color={colors.burgundy[500]} />
        <Text style={styles.bookmarksButtonText}>
          {i18n.t('player.bookmarks')} ({bookmarks.length})
        </Text>
      </TouchableOpacity>

      {/* Bookmarks Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('player.bookmarks')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>

            {bookmarks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bookmarks-outline" size={48} color={colors.gray[400]} />
                <Text style={styles.emptyStateText}>No bookmarks yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add bookmarks to save important moments in this track
                </Text>
              </View>
            ) : (
              <FlatList
                data={bookmarks}
                renderItem={renderBookmarkItem}
                keyExtractor={(item) => item.id}
                style={styles.bookmarksList}
                showsVerticalScrollIndicator={false}
              />
            )}

            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              style={styles.addBookmarkButton}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.addBookmarkButtonText}>Add Bookmark</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Bookmark Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addModalContent}>
            <Text style={styles.addModalTitle}>Add Bookmark</Text>
            <Text style={styles.addModalSubtitle}>
              At: {formatTime(Math.floor(currentPosition / 1000))}
            </Text>
            
            <TextInput
              style={styles.noteInput}
              placeholder="Enter a note for this bookmark..."
              value={newBookmarkNote}
              onChangeText={setNewBookmarkNote}
              multiline
              maxLength={200}
              autoFocus
            />
            
            <View style={styles.addModalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setNewBookmarkNote('');
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={addBookmark}
                style={[styles.modalButton, styles.saveButton]}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bookmarksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  bookmarksButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[600],
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  bookmarksList: {
    maxHeight: 300,
  },
  bookmarkItem: {
    backgroundColor: colors.gray[100],
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  bookmarkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  bookmarkTime: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  bookmarkNote: {
    fontSize: 14,
    color: colors.gray[700],
    flex: 1,
    marginRight: 12,
  },
  deleteButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 8,
  },
  addBookmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.burgundy[500],
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  addBookmarkButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  addModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  addModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  addModalSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 20,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  addModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.gray[100],
  },
  saveButton: {
    backgroundColor: colors.burgundy[500],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[600],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});