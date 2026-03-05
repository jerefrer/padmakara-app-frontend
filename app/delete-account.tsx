import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/apiService';
import { API_ENDPOINTS } from '@/services/apiConfig';

const CONFIRMATION_PHRASE = 'permanently delete';
const CONFIRMATION_PHRASE_PT = 'eliminar permanentemente';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user, logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredPhrase = language === 'pt' ? CONFIRMATION_PHRASE_PT : CONFIRMATION_PHRASE;
  const isConfirmed = confirmText.toLowerCase().trim() === requiredPhrase;

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiService.delete(API_ENDPOINTS.DELETE_ACCOUNT);

      if (!response.success) {
        setError(response.error || (t('deleteAccount.errorGeneric') || 'Failed to delete account. Please try again.'));
        setIsDeleting(false);
        return;
      }

      // Clear local state and redirect
      await logout();
      router.replace('/(tabs)' as any);
    } catch (err) {
      console.error('Account deletion error:', err);
      setError(t('deleteAccount.errorGeneric') || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} disabled={isDeleting}>
          <Ionicons name="arrow-back" size={24} color={isDeleting ? colors.gray[300] : colors.gray[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('deleteAccount.title') || 'Delete Account'}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Warning icon */}
        <View style={styles.warningIconContainer}>
          <Ionicons name="warning" size={48} color="#dc2626" />
        </View>

        <Text style={styles.warningTitle}>
          {t('deleteAccount.warningTitle') || 'This action is permanent'}
        </Text>

        <Text style={styles.warningBody}>
          {t('deleteAccount.warningBody') || 'Deleting your account will permanently remove all of your data from our servers. This cannot be undone.'}
        </Text>

        {/* What will be deleted */}
        <Text style={styles.sectionTitle}>
          {t('deleteAccount.whatIsDeletedTitle') || 'What will be deleted:'}
        </Text>

        <View style={styles.deletionItem}>
          <Ionicons name="person-outline" size={18} color="#dc2626" />
          <Text style={styles.deletionText}>
            {t('deleteAccount.deleteProfile') || 'Your profile, email address, and dharma name'}
          </Text>
        </View>
        <View style={styles.deletionItem}>
          <Ionicons name="musical-notes-outline" size={18} color="#dc2626" />
          <Text style={styles.deletionText}>
            {t('deleteAccount.deleteProgress') || 'All listening progress and track completion history'}
          </Text>
        </View>
        <View style={styles.deletionItem}>
          <Ionicons name="bookmark-outline" size={18} color="#dc2626" />
          <Text style={styles.deletionText}>
            {t('deleteAccount.deleteBookmarks') || 'All bookmarks, notes, and PDF highlights'}
          </Text>
        </View>
        <View style={styles.deletionItem}>
          <Ionicons name="phone-portrait-outline" size={18} color="#dc2626" />
          <Text style={styles.deletionText}>
            {t('deleteAccount.deleteDevices') || 'All device activations'}
          </Text>
        </View>
        <View style={styles.deletionItem}>
          <Ionicons name="people-outline" size={18} color="#dc2626" />
          <Text style={styles.deletionText}>
            {t('deleteAccount.deleteGroupAccess') || 'Access to all retreat group recordings'}
          </Text>
        </View>

        <Text style={styles.warningNote}>
          {t('deleteAccount.warningNote') || 'If you wish to use the app again in the future, you will need to request a new account and wait for approval from the administration.'}
        </Text>

        {/* Account info */}
        {user && (
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>
              {t('deleteAccount.accountLabel') || 'Account to be deleted:'}
            </Text>
            <Text style={styles.accountEmail}>{user.email}</Text>
          </View>
        )}

        {/* Confirmation input */}
        <Text style={styles.confirmLabel}>
          {t('deleteAccount.confirmLabel', { phrase: requiredPhrase }) ||
            `To confirm, type "${requiredPhrase}" below:`}
        </Text>

        <TextInput
          style={[styles.confirmInput, isConfirmed && styles.confirmInputReady]}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={requiredPhrase}
          placeholderTextColor={colors.gray[400]}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isDeleting}
        />

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Delete button */}
        <Pressable
          style={[styles.deleteButton, !isConfirmed && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={!isConfirmed || isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#ffffff" />
              <Text style={styles.deleteButtonText}>
                {t('deleteAccount.deleteButton') || 'Permanently Delete My Account'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Cancel link */}
        <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={isDeleting}>
          <Text style={styles.cancelButtonText}>
            {t('deleteAccount.cancel') || 'Cancel — take me back'}
          </Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[200],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.cream[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray[800],
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: 12,
  },
  warningBody: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 14,
  },
  deletionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    paddingLeft: 4,
  },
  deletionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray[600],
  },
  warningNote: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.gray[500],
    fontStyle: 'italic',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  accountInfo: {
    backgroundColor: colors.cream[100],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: 14,
    marginBottom: 24,
  },
  accountLabel: {
    fontSize: 13,
    color: colors.gray[500],
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
  },
  confirmLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray[700],
    marginBottom: 10,
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.gray[800],
    backgroundColor: colors.white,
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  confirmInputReady: {
    borderColor: '#dc2626',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    fontSize: 15,
    color: colors.gray[500],
  },
  bottomSpacer: {
    height: 60,
  },
});
