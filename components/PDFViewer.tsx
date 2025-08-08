import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PDFProgress, PDFHighlight } from '@/types';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
};

interface PDFViewerProps {
  source: string;
  transcriptId: string;
  onProgressUpdate?: (progress: PDFProgress) => void;
}

export function PDFViewer({ source, transcriptId, onProgressUpdate }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [highlights, setHighlights] = useState<PDFHighlight[]>([]);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showPDF, setShowPDF] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');

  useEffect(() => {
    loadHighlights();
  }, [transcriptId]);

  const loadHighlights = async () => {
    // In production, this would load from your database/storage
    // For now, simulate some highlights
    const mockHighlights: PDFHighlight[] = [
      {
        id: 'highlight-1',
        page: 1,
        text: 'Mind training is essential for spiritual development',
        color: '#fbbf24',
        createdAt: new Date().toISOString(),
      },
    ];
    setHighlights(mockHighlights);
  };

  const saveProgress = async () => {
    const progress: PDFProgress = {
      transcriptId,
      page: currentPage,
      highlights,
      lastRead: new Date().toISOString(),
    };
    onProgressUpdate?.(progress);
  };

  const addHighlight = (text: string, color: string = '#fbbf24') => {
    if (!text.trim()) return;

    const newHighlight: PDFHighlight = {
      id: `highlight-${Date.now()}`,
      page: currentPage,
      text: text.trim(),
      color,
      createdAt: new Date().toISOString(),
    };

    const updatedHighlights = [...highlights, newHighlight];
    setHighlights(updatedHighlights);
    setSelectedText('');
    setIsHighlighting(false);
    saveProgress();
  };

  const removeHighlight = (highlightId: string) => {
    const updatedHighlights = highlights.filter(h => h.id !== highlightId);
    setHighlights(updatedHighlights);
    saveProgress();
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      saveProgress();
    }
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  if (Platform.OS === 'web') {
    // Web implementation using iframe
    return (
      <View style={styles.container}>
        {/* PDF Viewer Controls */}
        <View style={styles.controls}>
          <View style={styles.pageControls}>
            <TouchableOpacity 
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={[styles.pageButton, currentPage <= 1 && styles.pageButtonDisabled]}
            >
              <Ionicons name="chevron-back" size={20} color={currentPage <= 1 ? colors.gray[400] : colors.burgundy[500]} />
            </TouchableOpacity>
            
            <Text style={styles.pageInfo}>
              Page {currentPage} of {totalPages}
            </Text>
            
            <TouchableOpacity 
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              style={[styles.pageButton, currentPage >= totalPages && styles.pageButtonDisabled]}
            >
              <Ionicons name="chevron-forward" size={20} color={currentPage >= totalPages ? colors.gray[400] : colors.burgundy[500]} />
            </TouchableOpacity>
          </View>

          <View style={styles.zoomControls}>
            <TouchableOpacity onPress={zoomOut} style={styles.zoomButton}>
              <Ionicons name="remove" size={16} color={colors.burgundy[500]} />
            </TouchableOpacity>
            <Text style={styles.zoomText}>{Math.round(scale * 100)}%</Text>
            <TouchableOpacity onPress={zoomIn} style={styles.zoomButton}>
              <Ionicons name="add" size={16} color={colors.burgundy[500]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* PDF Content Area */}
        <View style={styles.pdfContainer}>
          {showPDF ? (
            <View style={[styles.pdfIframe, { transform: [{ scale }] }]}>
              {/* In production, this would be an iframe or WebView showing the actual PDF */}
              <View style={styles.mockPDFPage}>
                <Text style={styles.mockPDFTitle}>Mind Training 2 - Transcript</Text>
                <Text style={styles.mockPDFContent}>
                  {`This is a demo of the PDF transcript viewer. In the production app, this would display the actual PDF content from your sample files:

• 2023-10-26_27-MIND TRAINING 2.pdf
• 2024-04-11_12-JKR-Mind_Training_2.pdf

The PDF viewer would show the full transcript with:
- Searchable text
- Zoom controls  
- Page navigation
- Highlighting capabilities
- Reading progress tracking

Jigme Khyentse Rinpoche's teachings on mind training and the 37 practices of bodhisattvas would be displayed here with proper formatting and typography.

You can simulate highlighting by selecting this text and using the highlight button below.`}
                </Text>
                
                {/* Simulated highlights */}
                {highlights
                  .filter(h => h.page === currentPage)
                  .map(highlight => (
                    <View key={highlight.id} style={[styles.highlightBox, { backgroundColor: highlight.color + '40' }]}>
                      <Text style={styles.highlightText}>{highlight.text}</Text>
                      <TouchableOpacity 
                        onPress={() => removeHighlight(highlight.id)}
                        style={styles.removeHighlight}
                      >
                        <Ionicons name="close" size={12} color={colors.gray[600]} />
                      </TouchableOpacity>
                    </View>
                  ))
                }
              </View>
            </View>
          ) : (
            <View style={styles.pdfPlaceholder}>
              <Ionicons name="document-text-outline" size={64} color={colors.gray[400]} />
              <Text style={styles.placeholderTitle}>PDF Transcript</Text>
              <Text style={styles.placeholderText}>
                In production, this would load your PDF transcripts directly from the samples folder or AWS S3.
              </Text>
              <TouchableOpacity 
                onPress={() => setShowPDF(true)}
                style={styles.loadPDFButton}
              >
                <Text style={styles.loadPDFButtonText}>View Demo PDF</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Highlighting Controls */}
        {showPDF && (
          <View style={styles.highlightControls}>
            <TouchableOpacity
              onPress={() => setIsHighlighting(!isHighlighting)}
              style={[styles.highlightButton, isHighlighting && styles.highlightButtonActive]}
            >
              <Ionicons name="brush" size={16} color={isHighlighting ? "white" : colors.burgundy[500]} />
              <Text style={[styles.highlightButtonText, isHighlighting && styles.highlightButtonTextActive]}>
                Highlight
              </Text>
            </TouchableOpacity>

            {isHighlighting && (
              <View style={styles.highlightColorPicker}>
                {['#fbbf24', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'].map(color => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => addHighlight('Selected text would appear here', color)}
                    style={[styles.colorOption, { backgroundColor: color }]}
                  />
                ))}
              </View>
            )}

            <Text style={styles.highlightCount}>
              {highlights.filter(h => h.page === currentPage).length} highlights on this page
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Native implementation (iOS/Android) would use react-native-pdf
  return (
    <View style={styles.container}>
      <Text style={styles.nativeMessage}>
        PDF viewer for native platforms would be implemented here using react-native-pdf
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageButton: {
    padding: 8,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginHorizontal: 16,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomButton: {
    backgroundColor: colors.gray[100],
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 4,
  },
  zoomText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[700],
    marginHorizontal: 8,
  },
  pdfContainer: {
    flex: 1,
  },
  pdfIframe: {
    flex: 1,
    backgroundColor: 'white',
  },
  mockPDFPage: {
    padding: 24,
    backgroundColor: 'white',
    minHeight: '100%',
  },
  mockPDFTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginBottom: 20,
    textAlign: 'center',
  },
  mockPDFContent: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.gray[800],
    marginBottom: 20,
  },
  highlightBox: {
    padding: 8,
    borderRadius: 4,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.saffron[500],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  highlightText: {
    fontSize: 14,
    color: colors.gray[700],
    flex: 1,
    fontStyle: 'italic',
  },
  removeHighlight: {
    padding: 4,
  },
  pdfPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginTop: 16,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  loadPDFButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loadPDFButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  highlightControls: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  highlightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  highlightButtonActive: {
    backgroundColor: colors.burgundy[500],
  },
  highlightButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  highlightButtonTextActive: {
    color: 'white',
  },
  highlightColorPicker: {
    flexDirection: 'row',
    marginRight: 12,
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  highlightCount: {
    fontSize: 12,
    color: colors.gray[500],
  },
  nativeMessage: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    padding: 40,
  },
});