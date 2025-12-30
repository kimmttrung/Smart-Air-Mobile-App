import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

/**
 * Quản lý lịch sử vị trí (history) và bộ lọc ngày
 * - Tách khỏi AnalyticExposureScreen để giảm độ phức tạp
 * - Không thay đổi hành vi: vẫn lấy 7 ngày gần nhất, set historyLoaded sau khi load
 *
 * @param {Function} getLocationHistory - hàm lấy lịch sử từ useLocationTracking
 * @param {Function} onUserLocationUpdate - callback(optional) để set vị trí gần nhất
 */
export default function useExposureHistory(getLocationHistory, onUserLocationUpdate) {
  const [historyData, setHistoryData] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'last3days', 'last7days', or 'YYYY-MM-DD'
  const [dayStats, setDayStats] = useState(null); // stats for a selected specific day

  // Load lịch sử 7 ngày gần nhất
  const loadHistoryBasic = useCallback(async () => {
    try {
      const history = await getLocationHistory(8); // lấy 7 ngày
      setHistoryData(history);
      setHistoryLoaded(true);

      // Lấy vị trí gần nhất của user từ history
      if (history?.length > 0 && onUserLocationUpdate) {
        const latestLocation = history[0]; // History đã sorted theo timestamp giảm dần
        onUserLocationUpdate({
          name: latestLocation.address || 'Vị trí của bạn',
          address: latestLocation.address,
          aqi: latestLocation.aqi,
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
        });
      }
      return history;
    } catch (error) {
      console.error('[useExposureHistory] Failed to load history:', error);
      setHistoryLoaded(true);
      return [];
    }
  }, [getLocationHistory, onUserLocationUpdate]);

  // Filter history theo dateFilter
  const filteredHistoryData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return historyData.filter((item) => {
      const itemDate = new Date(item.timestamp);
      const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

      switch (dateFilter) {
        case 'today':
          return itemDate >= today;
        case 'last3days': {
          const threeDaysAgo = new Date(today);
          threeDaysAgo.setDate(today.getDate() - 3);
          return itemDate >= threeDaysAgo;
        }
        case 'last7days': {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          return itemDate >= sevenDaysAgo;
        }
        case 'all':
          return true;
        default: {
          // Specific date (YYYY-MM-DD)
          if (dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
            const [year, month, day] = dateFilter.split('-').map(Number);
            const filterDate = new Date(year, month - 1, day);
            return itemDateOnly.getTime() === filterDate.getTime();
          }
          return true;
        }
      }
    });
  }, [historyData, dateFilter]);

  // Load day stats khi dateFilter thay đổi
  useEffect(() => {
    if (!dateFilter || typeof dateFilter !== 'string') {
      setDayStats(null);
      return;
    }

    let targetDate = null;
    if (dateFilter === 'today') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      targetDate = `${yyyy}-${mm}-${dd}`;
    } else {
      const isSpecificDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFilter);
      if (isSpecificDate) targetDate = dateFilter;
    }

    if (!targetDate) {
      setDayStats(null);
      return;
    }

    let cancelled = false;
    const fetchStats = async () => {
      try {
        setDayStats(null);
        // console.log('[useExposureHistory] Loading day stats for date:', targetDate);
        const stats = await api.getLocationStatsForDay(targetDate);
        if (!cancelled) {
          setDayStats(stats);
          setHistoryLoaded(true);
        }
      } catch (err) {
        if (!cancelled) console.error('[useExposureHistory] Failed to load day stats:', err.message || err);
      }
    };

    fetchStats();
    return () => { cancelled = true; };
  }, [dateFilter]);

  // Reload history function
  const reloadHistory = useCallback(async ({ setLoading, overviewLoaded, loadOverviewData }) => {
    setLoading?.(true);
    try {
      await loadHistoryBasic();
      if (overviewLoaded && loadOverviewData) {
        // Overview sẽ tự reload khi historyData thay đổi
        setHistoryLoaded(false);
      }
    } finally {
      setLoading?.(false);
    }
  }, [loadHistoryBasic]);

  return {
    historyData,
    historyLoaded,
    dateFilter,
    setDateFilter,
    filteredHistoryData,
    loadHistoryBasic,
    setHistoryLoaded,
    dayStats,
    setDayStats,
    reloadHistory,
  };
}


