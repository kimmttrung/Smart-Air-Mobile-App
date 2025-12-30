import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { scaleFont } from '../constants/responsive';
export default function NewsScreen() {
  // Fallback articles about weather and air pollution in Vietnamese
  const fallbackArticles = [];

  // NewsAPI configuration - Free tier API
  const NEWS_API_KEY = 'd3867633e8d94f38af3885c5afb6c898'; // Free NewsAPI key
  const NEWS_API_URL = 'https://newsapi.org/v2/everything';
  
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const categories = [
    'Tất cả',
    'Thời tiết',
    'Môi trường',
    'Sức khỏe',
    'Khoa học',
    'Công nghệ',
  ];

  const [filter, setFilter] = useState('Tất cả');
  const [bookmarked, setBookmarked] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  const [webViewLoading, setWebViewLoading] = useState(true);

  // Fetch news from NewsAPI (optional - fallback articles always available)
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);

        // Priority queries: Vietnam AQI first, then general air quality
        const priorityQueries = [
          'air quality Vietnam',
          'pollution Hanoi Vietnam',
          'AQI Vietnam',
          'air pollution Vietnam',
        ];
        
        const secondaryQueries = [
          'IQAir air quality Asia',
          'PM2.5 Southeast Asia',
          'air quality monitoring Asia',
          'environmental health Asia'
        ];
        
        // Use 2 Vietnam queries + 1 regional query
        const selectedQueries = [
          priorityQueries[0], // Always Vietnam air quality
          priorityQueries[Math.floor(Math.random() * (priorityQueries.length - 1)) + 1],
          secondaryQueries[Math.floor(Math.random() * secondaryQueries.length)]
        ];
        
        const allArticles = [];
        
        for (const query of selectedQueries) {
          try {
            const url = `${NEWS_API_URL}?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=15&apiKey=${NEWS_API_KEY}`;
            
            console.log(`📰 Fetching news for: ${query}`);
            const response = await fetch(url);
            
            if (!response.ok) {
              console.warn(`Failed to fetch for query "${query}": ${response.status}`);
              continue;
            }
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.articles && data.articles.length > 0) {
              allArticles.push(...data.articles);
            }
          } catch (queryError) {
            console.warn(`Error fetching query "${query}":`, queryError.message);
          }
        }
        
        if (allArticles.length > 0) {
          // Remove duplicates by URL
          const uniqueArticles = allArticles.filter((article, index, self) =>
            index === self.findIndex((a) => a.url === article.url)
          );
          
          // Transform API data to match our format
          const transformedNews = uniqueArticles
            .filter(article => 
              article.title && 
              article.description && 
              article.title !== '[Removed]' &&
              article.url &&
              article.url !== ''
            )
            .map((article, index) => {
              const titleAndDesc = (article.title + ' ' + article.description).toLowerCase();
              const isVietnam = titleAndDesc.includes('vietnam') || 
                               titleAndDesc.includes('hanoi') || 
                               titleAndDesc.includes('ho chi minh') ||
                               titleAndDesc.includes('saigon');
              
              return {
                id: 100 + index,
                title: article.title,
                source: article.source?.name || 'News',
                date: article.publishedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                category: categorizeNews(article.title + ' ' + article.description),
                img: article.urlToImage || null,
                summary: article.description || 'Đọc thêm để biết chi tiết...',
                readTime: estimateReadTime(article.content || article.description),
                views: Math.floor(Math.random() * 5000) + 1000 + 'k',
                url: article.url,
                isVietnam: isVietnam, // Flag for sorting
              };
            });
          
          // Sort: Vietnam articles first, then by date
          transformedNews.sort((a, b) => {
            if (a.isVietnam && !b.isVietnam) return -1;
            if (!a.isVietnam && b.isVietnam) return 1;
            return new Date(b.date) - new Date(a.date);
          });
          
          const topNews = transformedNews.slice(0, 25);
          
          // Combine API news with fallback articles
          setNewsData([...topNews, ...fallbackArticles]);
          console.log('✅ Loaded', topNews.length, 'API news (', topNews.filter(n => n.isVietnam).length, 'Vietnam) +', fallbackArticles.length, 'fallback articles');
        } else {
          // Keep fallback articles if API fails
          console.log('⚠️ API returned no articles, using fallback only');
          setNewsData(fallbackArticles);
        }
      } catch (err) {
        console.error('❌ Error fetching news:', err);
        setError(err.message);
        // Keep fallback articles on error
        console.log('📰 Using', fallbackArticles.length, 'fallback articles');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [refreshTrigger]);

  // Categorize news based on keywords
  const categorizeNews = (text) => {
    const lowerText = text.toLowerCase();
    
    // IQAir and air quality monitoring
    if (lowerText.includes('iqair') || lowerText.includes('air quality index') || lowerText.includes('aqi')) {
      return 'Công nghệ';
    }
    
    if (lowerText.includes('weather') || lowerText.includes('temperature') || lowerText.includes('forecast')) {
      return 'Thời tiết';
    }
    
    if (lowerText.includes('pollution') || lowerText.includes('air quality') || lowerText.includes('environment') || lowerText.includes('pm2.5') || lowerText.includes('pm 2.5')) {
      return 'Môi trường';
    }
    
    if (lowerText.includes('health') || lowerText.includes('disease') || lowerText.includes('medical') || lowerText.includes('respiratory')) {
      return 'Sức khỏe';
    }
    if (lowerText.includes('climate') || lowerText.includes('science') || lowerText.includes('research')) {
      return 'Khoa học';
    }
    if (lowerText.includes('technology') || lowerText.includes('innovation') || lowerText.includes('tech')) {
      return 'Công nghệ';
    }
    return 'Môi trường'; // Default category
  };

  // Estimate read time based on content length
  const estimateReadTime = (content) => {
    if (!content) return '2 phút đọc';
    const words = content.split(' ').length;
    const minutes = Math.ceil(words / 200); // Average reading speed
    return `${minutes} phút đọc`;
  };

  const sortedNews = useMemo(
    () =>
      [...newsData].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [newsData],
  );

  const filteredNews =
    filter === 'Tất cả'
      ? sortedNews
      : sortedNews.filter((n) => n.category === filter);

  const toggleBookmark = (id) => {
    setBookmarked((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const openNewsDetail = (news) => {
    if (news.url && news.url !== '#') {
      setSelectedNews(news);
      setWebViewUrl(news.url);
      setWebViewLoading(true);
      setShowWebView(true);
    } else {
      Alert.alert('Thông báo', 'Bài viết chưa có liên kết chi tiết');
    }
  };

  const openInBrowser = async () => {
    if (webViewUrl) {
      try {
        const supported = await Linking.canOpenURL(webViewUrl);
        if (supported) {
          await Linking.openURL(webViewUrl);
        } else {
          Alert.alert('Lỗi', 'Không thể mở liên kết này');
        }
      } catch (error) {
        console.error('Error opening URL:', error);
        Alert.alert('Lỗi', 'Không thể mở trình duyệt');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tin tức</Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="filter" size={18} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Đang tải tin tức...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Không thể tải tin tức</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => setRefreshTrigger(prev => prev + 1)}
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

        {filteredNews.map((news) => {
          const isBookmarked = bookmarked.includes(news.id);
          return (
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
                    <Text style={styles.dateText}>{formatDate(news.date)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{news.title}</Text>
                </View>
              </View>

              <Text style={styles.summary}>{news.summary}</Text>

              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  <Text style={styles.sourceText}>{news.source}</Text>
                  <Text style={styles.dotDivider}>•</Text>
                  <Text style={styles.metaText}>{news.readTime}</Text>
                  <Text style={styles.dotDivider}>•</Text>
                  <Text style={styles.metaText}>{news.views} lượt xem</Text>
                </View>

                <View style={styles.footerRight}>
                  <TouchableOpacity 
                    style={styles.iconCircleSecondary}
                    onPress={() => openNewsDetail(news)}
                  >
                    <Feather name="external-link" size={15} color="#0f172a" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconCircleSecondary}>
                    <Feather name="share-2" size={15} color="#0f172a" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleBookmark(news.id)}
                    style={[
                      styles.iconCirclePrimary,
                      isBookmarked && styles.iconCirclePrimaryActive,
                    ]}
                  >
                    <Feather
                      name={isBookmarked ? 'bookmark' : 'bookmark'}
                      size={15}
                      color={isBookmarked ? '#b45309' : '#1d4ed8'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        </>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModal} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Bộ lọc</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.filterModalClose}
              >
                <Feather name="x" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.filterModalContent}>
              <Text style={styles.filterSectionTitle}>Sắp xếp theo</Text>
              <TouchableOpacity style={styles.filterOption}>
                <Text style={styles.filterOptionText}>Mới nhất</Text>
                <Feather name="check" size={18} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterOption}>
                <Text style={styles.filterOptionText}>Phổ biến nhất</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterOption}>
                <Text style={styles.filterOptionText}>Xem nhiều nhất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={() => setShowWebView(false)}
      >
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              style={styles.webViewBackButton}
              onPress={() => setShowWebView(false)}
            >
              <Feather name="x" size={24} color="#0f172a" />
            </TouchableOpacity>
            <View style={styles.webViewHeaderTitle}>
              <Text style={styles.webViewTitle} numberOfLines={1}>
                {selectedNews?.title || 'Đang tải...'}
              </Text>
              <Text style={styles.webViewSource}>{selectedNews?.source}</Text>
            </View>
            <TouchableOpacity
              style={styles.webViewActionButton}
              onPress={openInBrowser}
            >
              <Feather name="external-link" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
          {webViewLoading && (
            <View style={styles.webViewLoadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.webViewLoadingText}>Đang tải bài viết...</Text>
            </View>
          )}
          <WebView
            source={{ uri: webViewUrl }}
            style={styles.webView}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            onError={() => {
              setWebViewLoading(false);
              Alert.alert('Lỗi', 'Không thể tải bài viết');
            }}
          />
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: scaleFont(28),
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: scaleFont(13),
    color: '#64748b',
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
  summary: {
    fontSize: scaleFont(13),
    color: '#4b5563',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'column',
    // justifyContent: 'space-between',
    // alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  sourceText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#2563eb',
  },
  metaText: {
    fontSize: scaleFont(11),
    color: '#94a3b8',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotDivider: {
    fontSize: scaleFont(12),
    color: '#cbd5e1',
    marginHorizontal: 4,
  },
  iconCircleSecondary: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePrimary: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePrimaryActive: {
    backgroundColor: '#fef3c7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: '#0f172a',
  },
  filterModalClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalContent: {
    gap: 12,
  },
  filterSectionTitle: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterOptionText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#0f172a',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  webViewBackButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  webViewHeaderTitle: {
    flex: 1,
    marginRight: 12,
  },
  webViewTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  webViewSource: {
    fontSize: scaleFont(12),
    color: '#64748b',
  },
  webViewActionButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webView: {
    flex: 1,
  },
  webViewLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  webViewLoadingText: {
    marginTop: 12,
    fontSize: scaleFont(14),
    color: '#64748b',
    fontWeight: '500',
  },
});



