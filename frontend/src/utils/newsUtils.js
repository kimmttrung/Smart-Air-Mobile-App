/**
 * News utility functions
 */

// Map source names to display names
export const SOURCE_MAP = {
  'vnexpress': 'VNExpress',
  'thanhnien': 'Thanh Niên',
  'vietnamnet': 'VietnamNet'
};

/**
 * Format date to relative time or date string
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

/**
 * Transform crawled articles to frontend format
 * @param {Array} articles - Array of crawled articles
 * @returns {Array} Transformed articles
 */
export const transformNews = (articles) => {
  return articles.map((article, index) => ({
    id: `news-${index}-${Date.now()}`,
    title: article.title,
    source: SOURCE_MAP[article.source] || article.source,
    date: article.date,
    category: article.category,
    img: null,
    summary: 'Đọc thêm để biết chi tiết...',
    url: article.url,
  }));
};

