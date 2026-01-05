import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { scaleFont } from '../constants/responsive';
import { crawlAllSources } from '../services/newsCrawler';
import { formatDate, transformNews } from '../utils/newsUtils';

export default function NewsScreen() {
  const navigation = useNavigation();
  
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState(null);

  const categories = [
    'Tất cả',
    'Thời tiết',
    'Môi trường',
    'Sức khỏe',
  ];

  const [filter, setFilter] = useState('Tất cả');
  const [selectedNews, setSelectedNews] = useState(null);
  const [webViewLoading, setWebViewLoading] = useState(true);

  // Crawl and transform news
  const crawlAndTransformNews = useCallback(async () => {
    try {
      setLoading(true);
      setCrawling(true);
      setError(null);

      console.log('🕷️ Starting news crawl from frontend...');
      
      // Crawl from all sources
      const crawlResults = await crawlAllSources('thoi-su', 30);
      
      // Transform to frontend format
      const transformedNews = transformNews(crawlResults.all);
      
      setNewsData(transformedNews);
      console.log('✅ Loaded', transformedNews.length, 'articles from crawl');
    } catch (err) {
      console.error('❌ Error crawling news:', err);
      setError(err.message);
      setNewsData([]);
    } finally {
      setLoading(false);
      setCrawling(false);
    }
  }, []);

  // Crawl when screen is opened (useFocusEffect)
  useFocusEffect(
    useCallback(() => {
      crawlAndTransformNews();
    }, [crawlAndTransformNews])
  );

  // Filter news based on category
  const filteredNews = useMemo(() => {
    const sortedNews = [...newsData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    if (filter === 'Tất cả') {
      return sortedNews;
    }
    return sortedNews.filter(n => n.category === filter);
  }, [newsData, filter]);


  const openNewsDetail = (news) => {
    if (news.url && news.url !== '#') {
      setSelectedNews(news);
      setWebViewLoading(true);
    } else {
      Alert.alert('Thông báo', 'Bài viết chưa có liên kết chi tiết');
    }
  };

  const closeNewsDetail = () => {
    setSelectedNews(null);
    setWebViewLoading(false);
  };

  const openInBrowser = async () => {
    if (selectedNews?.url) {
      try {
        const supported = await Linking.canOpenURL(selectedNews.url);
        if (supported) {
          await Linking.openURL(selectedNews.url);
        } else {
          Alert.alert('Lỗi', 'Không thể mở liên kết này');
        }
      } catch (error) {
        console.error('Error opening URL:', error);
        Alert.alert('Lỗi', 'Không thể mở trình duyệt');
      }
    }
  };

  // Handle retry - crawl again
  const handleRetry = async () => {
    await crawlAndTransformNews();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tin tức</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>
              {crawling ? 'Đang crawl tin tức mới...' : 'Đang tải tin tức...'}
            </Text>
            {crawling && (
              <Text style={styles.crawlingSubtext}>
                Đang lấy tin tức từ VNExpress, Thanh Niên, VietnamNet...
              </Text>
            )}
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Không thể tải tin tức</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : newsData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>Chưa có tin tức</Text>
          </View>
        ) : (
          <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesWrapper}
        >
          {categories.map((cat) => {
            const isActive = filter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                ]}
                onPress={() => setFilter(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.newsCountRow}>
          <Text style={styles.newsCountText}>
            {filteredNews.length} bài viết{' '}
            {filter !== 'Tất cả' ? `trong "${filter}"` : ''}
          </Text>
        </View>

        {filteredNews.map((news) => (
          <TouchableOpacity 
            key={news.id} 
            style={styles.card}
            onPress={() => openNewsDetail(news)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={styles.emojiWrapper}>
                {news.img && typeof news.img === 'string' && news.img.startsWith('http') ? (
                  <Image 
                    source={{ uri: news.img }} 
                    style={styles.newsImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.emoji}>📰</Text>
                )}
              </View>
              <View style={styles.cardHeaderContent}>
                <View style={styles.chipRow}>
                  <Text style={styles.categoryBadge}>{news.category}</Text>
                  {/* <Text style={styles.dateText}>{formatDate(news.date)}</Text> */}
                </View>
                <Text style={styles.cardTitle}>{news.title}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.sourceText}>{news.source}</Text>
            </View>
          </TouchableOpacity>
        ))}
        </>
        )}
      </ScrollView>

      {/* News Detail Modal */}
      <Modal
        visible={selectedNews !== null}
        animationType="slide"
        onRequestClose={closeNewsDetail}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={closeNewsDetail}
            >
              <Feather name="arrow-left" size={24} color="#0f172a" />
            </TouchableOpacity>
            <View style={styles.modalHeaderTitleContainer}>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                {selectedNews?.title || 'Đang tải...'}
              </Text>
              <Text style={styles.modalHeaderSource}>{selectedNews?.source}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalExternalButton}
              onPress={openInBrowser}
            >
              <Feather name="external-link" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>

          {webViewLoading && (
            <View style={styles.modalWebViewLoadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.modalWebViewLoadingText}>Đang tải bài viết...</Text>
            </View>
          )}

          {selectedNews && (
            <WebView
              source={{ uri: selectedNews.url }}
              style={styles.modalWebView}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={() => {
                setWebViewLoading(false);
                Alert.alert('Lỗi', 'Không thể tải bài viết');
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: scaleFont(28),
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  categoriesWrapper: {
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  newsCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  newsCountText: {
    fontSize: scaleFont(13),
    color: '#475569',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  emojiWrapper: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: scaleFont(24),
  },
  newsImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: scaleFont(14),
    color: '#64748b',
    fontWeight: '500',
  },
  crawlingSubtext: {
    marginTop: 8,
    fontSize: scaleFont(12),
    color: '#94a3b8',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: scaleFont(14),
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: scaleFont(14),
    color: '#94a3b8',
  },
  cardHeaderContent: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBadge: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  dateText: {
    fontSize: scaleFont(10),
    color: '#94a3b8',
  },
  cardTitle: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#0f172a',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  sourceText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#2563eb',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalHeaderTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  modalHeaderTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  modalHeaderSource: {
    fontSize: scaleFont(12),
    color: '#64748b',
  },
  modalExternalButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalWebView: {
    flex: 1,
  },
  modalWebViewLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalWebViewLoadingText: {
    marginTop: 12,
    fontSize: scaleFont(14),
    color: '#64748b',
    fontWeight: '500',
  },
});



