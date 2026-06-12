/**
 * News Crawler Service - Frontend only
 * Crawls news from Vietnamese news websites directly in React Native
 */

// Helper function to parse HTML and extract links
const parseHTMLForLinks = (html, selectors) => {
  const results = [];
  
  try {
    // Extract sections/containers based on selector
    const { containerSelector, titleSelector, linkSelector, linkPrefix } = selectors;
    
    // Find all containers
    const containerRegex = new RegExp(containerSelector, 'gi');
    const containers = html.match(containerRegex) || [];
    
    containers.forEach(container => {
      // Find titles
      const titleMatches = container.match(new RegExp(titleSelector, 'gi')) || [];
      
      titleMatches.forEach(titleMatch => {
        // Extract title from title attribute or text content
        const titleAttrMatch = titleMatch.match(/title=["']([^"']+)["']/i);
        const title = titleAttrMatch ? titleAttrMatch[1] : null;
        
        // Extract link
        const linkMatch = titleMatch.match(/href=["']([^"']+)["']/i);
        let link = linkMatch ? linkMatch[1] : null;
        
        if (title && link) {
          // Make link absolute
          if (link.startsWith('/')) {
            link = linkPrefix + link;
          } else if (!link.startsWith('http')) {
            link = linkPrefix + '/' + link;
          }
          
          results.push({
            title: title.trim(),
            url: link.trim()
          });
        }
      });
    });
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return results;
};

// VNExpress crawler
export const crawlVNExpress = async (category = 'thoi-su', maxArticles = 100) => {
  const articles = [];
  const newsPerPage = 25;
  const numPages = Math.ceil(maxArticles / newsPerPage);
  
  try {
    for (let page = 1; page <= numPages && articles.length < maxArticles; page++) {
      const url = page === 1 
        ? `https://vnexpress.net/${category}`
        : `https://vnexpress.net/${category}-p${page}`;
      
      try {
        console.log(`[VNExpress] Crawling page ${page}: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.warn(`[VNExpress] Response not OK: ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        console.log(`[VNExpress] HTML length: ${html.length}`);
        
        // Method 1: Try to find h3 with class "title-news" (more flexible)
        const h3Regex = /<h3[^>]*class=["'][^"']*title-news[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi;
        const h3Matches = html.match(h3Regex) || [];
        console.log(`[VNExpress] Found ${h3Matches.length} h3.title-news elements`);
        
        h3Matches.forEach(h3 => {
          // Try multiple patterns to extract link and title
          let link = null;
          let title = null;
          
          // Pattern 1: href and title in same <a> tag
          const pattern1 = h3.match(/<a[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i);
          if (pattern1) {
            link = pattern1[1];
            title = pattern1[2];
          } else {
            // Pattern 2: href in <a>, title as attribute of <a>
            const pattern2 = h3.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
            if (pattern2) {
              link = pattern2[1];
              // Try to get title from <a> tag's title attribute or text content
              const titleMatch = h3.match(/title=["']([^"']+)["']/i) || h3.match(/>([^<]+)</);
              if (titleMatch) {
                title = titleMatch[1];
              }
            }
          }
          
          if (link && title && articles.length < maxArticles) {
            // Normalize link
            if (link.startsWith('/')) {
              link = 'https://vnexpress.net' + link;
            } else if (!link.startsWith('http')) {
              link = 'https://vnexpress.net/' + link;
            }
            
            // Skip if already exists
            if (articles.some(a => a.url === link)) return;
            
            articles.push({
              title: title.trim(),
              url: link.trim(),
              source: 'vnexpress',
              date: new Date().toISOString().split('T')[0],
              category: categorizeNews(title)
            });
          }
        });
        
        // Method 2: Fallback - find any article links in article containers
        if (articles.length === 0) {
          console.log('[VNExpress] Trying fallback method...');
          // Look for article links with data-medium or article-item class
          const articleLinkRegex = /<article[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>[\s\S]*?<\/article>/gi;
          const articleMatches = html.match(articleLinkRegex) || [];
          
          articleMatches.forEach(article => {
            const linkMatch = article.match(/href=["']([^"']+)["']/i);
            const titleMatch = article.match(/title=["']([^"']+)["']/i) || article.match(/<h[23][^>]*>([^<]+)</i);
            
            if (linkMatch && titleMatch && articles.length < maxArticles) {
              let link = linkMatch[1];
              const title = titleMatch[1];
              
              if (link.startsWith('/')) {
                link = 'https://vnexpress.net' + link;
              } else if (!link.startsWith('http')) {
                link = 'https://vnexpress.net/' + link;
              }
              
              if (!articles.some(a => a.url === link)) {
                articles.push({
                  title: title.trim(),
                  url: link.trim(),
                  source: 'vnexpress',
                  date: new Date().toISOString().split('T')[0],
                  category: categorizeNews(title)
                });
              }
            }
          });
        }
        
        console.log(`[VNExpress] Page ${page}: Found ${articles.length} articles so far`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[VNExpress] Error crawling page ${page}:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('[VNExpress] Error crawling:', error);
  }
  
  console.log(`[VNExpress] Total articles before filter: ${articles.length}`);
  const filtered = filterEnvironmentNews(articles);
  console.log(`[VNExpress] Total articles after filter: ${filtered.length}`);
  
  return filtered;
};

// Thanh Niên crawler
export const crawlThanhNien = async (category = 'thoi-su', maxArticles = 100) => {
  const articles = [];
  const newsPerPage = 25;
  const numPages = Math.ceil(maxArticles / newsPerPage);
  
  try {
    for (let page = 1; page <= numPages && articles.length < maxArticles; page++) {
      const url = page === 1
        ? `https://thanhnien.vn/${category}`
        : `https://thanhnien.vn/${category}/trang-${page}.html`;
      
      try {
        console.log(`[Thanh Niên] Crawling page ${page}: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.warn(`[Thanh Niên] Response not OK: ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        console.log(`[Thanh Niên] HTML length: ${html.length}`);
        
        // Method 1: Find links with class "story__title"
        const storyTitleRegex = /<a[^>]*class=["'][^"']*story__title[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
        const storyMatches = html.match(storyTitleRegex) || [];
        console.log(`[Thanh Niên] Found ${storyMatches.length} story__title links`);
        
        storyMatches.forEach(story => {
          const linkMatch = story.match(/href=["']([^"']+)["']/i);
          const titleMatch = story.match(/title=["']([^"']+)["']/i) || story.match(/>([^<]+)</);
          
          if (linkMatch && titleMatch && articles.length < maxArticles) {
            let link = linkMatch[1];
            const title = titleMatch[1];
            
            // Skip video links
            if (link.toLowerCase().includes('video')) return;
            
            if (link.startsWith('/')) {
              link = 'https://thanhnien.vn' + link;
            } else if (!link.startsWith('http')) {
              link = 'https://thanhnien.vn/' + link;
            }
            
            if (!articles.some(a => a.url === link)) {
              articles.push({
                title: title.trim(),
                url: link.trim(),
                source: 'thanhnien',
                date: new Date().toISOString().split('T')[0],
                category: categorizeNews(title)
              });
            }
          }
        });
        
        console.log(`[Thanh Niên] Page ${page}: Found ${articles.length} articles so far`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Thanh Niên] Error crawling page ${page}:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('[Thanh Niên] Error crawling:', error);
  }
  
  console.log(`[Thanh Niên] Total articles before filter: ${articles.length}`);
  const filtered = filterEnvironmentNews(articles);
  console.log(`[Thanh Niên] Total articles after filter: ${filtered.length}`);
  
  return filtered;
};

// VietnamNet crawler
export const crawlVietnamNet = async (category = 'thoi-su', maxArticles = 100) => {
  const articles = [];
  const newsPerPage = 25;
  const numPages = Math.ceil(maxArticles / newsPerPage);
  
  try {
    for (let page = 1; page <= numPages && articles.length < maxArticles; page++) {
      const url = page === 1
        ? `https://vietnamnet.vn/vn/${category}/`
        : `https://vietnamnet.vn/vn/${category}/trang${page}/`;
      
      try {
        console.log(`[VietnamNet] Crawling page ${page}: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.warn(`[VietnamNet] Response not OK: ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        console.log(`[VietnamNet] HTML length: ${html.length}`);
        
        // Method 1: Find h3 tags with links inside
        const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
        const h3Matches = html.match(h3Regex) || [];
        console.log(`[VietnamNet] Found ${h3Matches.length} h3 elements`);
        
        h3Matches.forEach(h3 => {
          const linkMatch = h3.match(/<a[^>]*href=["']([^"']+)["']/i);
          const titleMatch = h3.match(/title=["']([^"']+)["']/i) || h3.match(/>([^<]+)</);
          
          if (linkMatch && titleMatch && articles.length < maxArticles) {
            let link = linkMatch[1];
            const title = titleMatch[1];
            
            if (link.startsWith('/')) {
              link = 'https://vietnamnet.vn' + link;
            } else if (!link.startsWith('http')) {
              link = 'https://vietnamnet.vn/vn/' + link;
            }
            
            if (!articles.some(a => a.url === link)) {
              articles.push({
                title: title.trim(),
                url: link.trim(),
                source: 'vietnamnet',
                date: new Date().toISOString().split('T')[0],
                category: categorizeNews(title)
              });
            }
          }
        });
        
        console.log(`[VietnamNet] Page ${page}: Found ${articles.length} articles so far`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[VietnamNet] Error crawling page ${page}:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('[VietnamNet] Error crawling:', error);
  }
  
  console.log(`[VietnamNet] Total articles before filter: ${articles.length}`);
  const filtered = filterEnvironmentNews(articles);
  console.log(`[VietnamNet] Total articles after filter: ${filtered.length}`);
  
  return filtered;
};

// Categorize news
const categorizeNews = (title) => {
  const text = title.toLowerCase();
  
  // IQAir/AQI articles go to Môi trường instead of Công nghệ
  if (text.includes('iqair') || text.includes('air quality index') || text.includes('aqi')) {
    return 'Môi trường';
  }
  if (text.includes('weather') || text.includes('temperature') || text.includes('forecast') || text.includes('thời tiết')) {
    return 'Thời tiết';
  }
  if (text.includes('pollution') || text.includes('air quality') || text.includes('environment') || 
      text.includes('pm2.5') || text.includes('pm 2.5') || text.includes('ô nhiễm') || 
      text.includes('môi trường') || text.includes('không khí') || text.includes('bụi mịn')) {
    return 'Môi trường';
  }
  if (text.includes('health') || text.includes('disease') || text.includes('medical') || 
      text.includes('respiratory') || text.includes('sức khỏe') || text.includes('bệnh')) {
    return 'Sức khỏe';
  }
  
  return 'Môi trường'; // Default
};

// Filter environment-related news
const filterEnvironmentNews = (articles) => {
  const keywords = [
    'môi trường', 'không khí', 'ô nhiễm', 'pm2.5', 'pm 2.5', 'bụi mịn',
    'air quality', 'pollution', 'environment', 'aqi',
    'chất lượng không khí', 'ô nhiễm không khí', 'bảo vệ môi trường'
  ];
  
  return articles.filter(article => {
    const text = article.title.toLowerCase();
    return keywords.some(kw => text.includes(kw));
  });
};

// Crawl all sources
export const crawlAllSources = async (category = 'thoi-su', maxArticlesPerSource = 30) => {
  const results = {
    vnexpress: [],
    thanhnien: [],
    vietnamnet: [],
    all: []
  };
  
  try {
    // Crawl in parallel
    const [vnexpress, thanhnien, vietnamnet] = await Promise.all([
      crawlVNExpress(category, maxArticlesPerSource),
      crawlThanhNien(category, maxArticlesPerSource),
      crawlVietnamNet(category, maxArticlesPerSource)
    ]);
    
    results.vnexpress = vnexpress;
    results.thanhnien = thanhnien;
    results.vietnamnet = vietnamnet;
    results.all = [...vnexpress, ...thanhnien, ...vietnamnet];
    
    // Remove duplicates by URL
    const uniqueArticles = [];
    const seenUrls = new Set();
    
    results.all.forEach(article => {
      if (!seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        uniqueArticles.push(article);
      }
    });
    
    results.all = uniqueArticles;
    
    return results;
  } catch (error) {
    console.error('Error crawling all sources:', error);
    return results;
  }
};

