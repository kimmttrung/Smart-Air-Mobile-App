/**
 * Generate Leaflet map HTML template for WebView
 * Contains all Leaflet map initialization, WMS layer, markers, and event handlers
 */
export const generateLeafletHTML = (baseUrl, bottomOffsetPx = 10) => `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      /* Reserve space at the bottom so map controls / markers are not hidden
         by native overlays (AQI bar, bottom tab navigation). */
      #map {
        height: calc(100% - ${bottomOffsetPx}px);
        margin: 0;
        padding: 0;
        font-size: 10px;
      }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
      }
      .leaflet-control-zoom { display: none !important; }
      @keyframes ping {
        0% { transform: scale(1); opacity: 0.9; }
        75%, 100% { transform: scale(2); opacity: 0; }
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      // Override console.log to send to React Native
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = function(...args) {
        originalLog.apply(console, args);
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'console_log',
              payload: args.map(a => String(a)).join(' ')
            }));
          }
        } catch (e) {}
      };
      
      console.error = function(...args) {
        originalError.apply(console, args);
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'console_error',
              payload: args.map(a => String(a)).join(' ')
            }));
          }
        } catch (e) {}
      };
    
      const map = L.map('map', { 
        zoomControl: false,
        minZoom: 7,
        maxZoom: 16,
        maxBounds: [[8.0, 102.0], [24.0, 110.0]], // Giới hạn vùng Việt Nam
        maxBoundsViscosity: 0.5 // Độ "dính" khi kéo ra ngoài bounds
      }).setView([21.0285, 105.8542], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: 7,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      let wmsLayer = null;
      let currentDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
      
      function createWmsLayer(dateStr) {
        if (wmsLayer) {
          try { map.removeLayer(wmsLayer); } catch (e) {}
        }
        
        // Chuyển đổi date format nếu cần (YYYY-MM-DD -> YYYYMMDD)
        const dateParam = dateStr ? dateStr.replace(/-/g, '') : currentDate;
        
        // Sử dụng TiTiler server với AQI colormap từ BASE_URL
        const serverUrl = \`${baseUrl}\`;
        
        const tileUrl = serverUrl + '/pm25/tiles/{z}/{x}/{y}.png?date=' + dateParam + '&colormap_name=aqi';
        console.log('🗺️ Creating WMS layer with URL:', tileUrl.replace('{z}', '11').replace('{x}', '1626').replace('{y}', '901'));
        console.log('📍 Server URL:', serverUrl);
        console.log('📅 Date param:', dateParam);
        
        wmsLayer = L.tileLayer(
          tileUrl,
          {
            minZoom: 7,
            maxZoom: 16,
            transparent: true,
            opacity: 0.6,
            attribution: '&copy; SmartAQ PM2.5',
            crossOrigin: true
          }
        );
        
        wmsLayer.on('tileerror', function(error) {
          console.error('❌ Tile load error:', error.tile.src);
        });
        
        wmsLayer.on('tileload', function(event) {
          console.log('✅ Tile loaded successfully:', event.tile.src);
        });
        
        wmsLayer.addTo(map);
      }
      createWmsLayer();


      const stations = [
        // { id: 1, name: 'Vị trí của bạn', aqi: 141, lat: 21.038511, lng: 105.784817 },
        // { id: 2, name: 'Trạm Hà Đông', aqi: 91, lat: 20.980549, lng: 105.777182 },
        // { id: 3, name: 'Trạm Thanh Xuân', aqi: 81, lat: 20.999001, lng: 105.801448 },
        // { id: 4, name: 'Trạm Bắc Ninh', aqi: 87, lat: 21.121444, lng: 106.111273 },
        // { id: 5, name: 'Trạm Gia Lâm', aqi: 49, lat: 21.039937, lng: 105.921001 },
        // { id: 6, name: 'Trạm Ecopark', aqi: 40, lat: 20.946839, lng: 105.952934 },
        // { id: 7, name: 'Trạm Việt Trì', aqi: 108, lat: 21.323284, lng: 105.429681 },
        // { id: 8, name: 'Trạm Lục Ngạn', aqi: 88, lat: 21.275277, lng: 106.449584 },
        // { id: 9, name: 'Trạm Chí Linh', aqi: 101, lat: 21.141819, lng: 106.384886 }
      ];

      function getAqiColor(aqi) {
        if (aqi <= 50) return '#22c55e';
        if (aqi <= 100) return '#eab308';
        if (aqi <= 150) return '#f97316';
        if (aqi <= 200) return '#ef4444';
        if (aqi <= 300) return '#a21caf';
        return '#7f1d1d';
      }

      function getStatusText(aqi) {
        if (aqi <= 50) return 'Tốt';
        if (aqi <= 100) return 'Trung bình';
        if (aqi <= 150) return 'Kém';
        if (aqi <= 200) return 'Xấu';
        return 'Nguy hại';
      }

      stations.forEach((s) => {
        const color = getAqiColor(s.aqi);
        const pingHtml =
          s.aqi > 150
            ? '<div style="position:absolute;inset:0;border-radius:999px;background:rgba(239,68,68,0.4);animation:ping 1.2s infinite;"></div>'
            : '';

        const iconHtml =
          '<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">' +
          pingHtml +
          '<div style="position:relative;width:32px;height:32px;border-radius:999px;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#ffffff;background:' +
          color +
          ';">' +
          s.aqi +
          '</div></div>';

        const icon = L.divIcon({
          html: iconHtml,
          className: '',
          iconAnchor: [0, 0]
        });

        const marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
        marker.on('click', function () {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: 'station_click',
                  payload: { ...s, status: getStatusText(s.aqi) }
                })
              );
            }
            map.setView([s.lat, s.lng], 12);
          } catch (err) {
            console.error('postMessage error', err);
          }
        });
      });

      // Nhãn chủ quyền cho Quần đảo Hoàng Sa, Trường Sa (hardcode giống SmartAir-UI / OSM)
      function addSovereigntyLabel(lat, lng, text) {
        const html =
          '<div style="text-align:center;pointer-events:none;">' +
          '<span style="' +
          'display:inline-block;' +
          'color:#555;' +
          'font-weight:500;' +
          'font-size:10px;' +
          'font-style:italic;' +
          'padding:2px 8px;' +
          'border-radius:999px;' +
          'border:1px solid rgba(255,255,255,0.9);' +
          'white-space:nowrap;' +
          'font-family:-apple-system,BlinkMacSystemFont,\\\"Segoe UI\\\",Roboto,sans-serif;' +
          'text-shadow:' +
          '-1px -1px 0 #fff,' +
          ' 1px -1px 0 #fff,' +
          '-1px  1px 0 #fff,' +
          ' 1px  1px 0 #fff,' +
          ' 0    0   3px rgba(255,255,255,0.8);' +
          '">' +
          text +
          '</span>' +
          '</div>';
        const icon = L.divIcon({
          html,
          className: 'custom-map-label',
          iconSize: [200, 40],
          iconAnchor: [100, 20],
        });
        L.marker([lat, lng], {
          icon,
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        }).addTo(map);
      }

      addSovereigntyLabel(16.5, 112.0, 'Quần đảo Hoàng Sa');
      addSovereigntyLabel(10.0, 114.0, 'Quần đảo Trường Sa');

      // Marker cho địa điểm được chọn từ GPS / search / click map
      let externalMarker = null;
      function ensureExternalMarker(lat, lng) {
        const extIcon = L.divIcon({
          html:
            '<div style="width:18px;height:18px;border-radius:999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>',
          className: '',
          iconAnchor: [9, 9],
        });

        if (externalMarker) {
          externalMarker.setLatLng([lat, lng]);
        } else {
          externalMarker = L.marker([lat, lng], { icon: extIcon }).addTo(map);
        }
      }

      // Clear / remove the external (GPS/custom) marker from the map
      window.__clearExternalMarker = function () {
        try {
          if (externalMarker) {
            try { map.removeLayer(externalMarker); } catch (e) {}
            externalMarker = null;
          }
        } catch (e) {
          console.error('clearExternalMarker error', e);
        }
      };

      window.__setMapCenter = function (lat, lng) {
        try {
          map.setView([lat, lng], 12);
        } catch (e) {
          console.error('setMapCenter error', e);
        }
      };

      // Được gọi từ React Native khi có vị trí GPS hoặc địa điểm tìm kiếm
      window.__setExternalLocation = function (lat, lng) {
        try {
          ensureExternalMarker(lat, lng);
          map.setView([lat, lng], 12);
        } catch (e) {
          console.error('setExternalLocation error', e);
        }
      };

      window.__setWmsDate = function (isoDate) {
        try {
          if (isoDate) {
            // isoDate có thể là YYYY-MM-DD hoặc YYYYMMDD
            createWmsLayer(isoDate);
          }
        } catch (e) {
          console.error('setWmsDate error', e);
        }
      };

      // Function để update stations từ React Native
      let stationMarkers = [];
      let markersVisible = true;
      
      window.__updateStations = function (newStations) {
        try {
          // Xóa tất cả markers cũ
          stationMarkers.forEach(marker => map.removeLayer(marker));
          stationMarkers = [];

          // Thêm markers mới - chỉ cho stations có AQI data
          newStations.forEach((s) => {
            const aqi = s.aqi || s.baseAqi;
            
            // Bỏ qua stations không có data hoặc data = 0
            if (!aqi || aqi === 0) {
              // console.log('Skipping station without data:', s.name);
              return;
            }
            
            const color = getAqiColor(aqi);
            const iconHtml =
              '<div style="' +
              'width:28px;height:28px;border-radius:999px;' +
              'background:' + color + ';' +
              'display:flex;align-items:center;justify-content:center;' +
              'border:2px solid white;' +
              'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
              'font-size:10px;font-weight:600;color:#fff;">' +
              aqi +
              '</div>';

            const icon = L.divIcon({
              html: iconHtml,
              className: '',
              iconAnchor: [14, 14],
            });

            const marker = L.marker([s.lat, s.lng], { icon });
            
            // Chỉ add vào map nếu markers đang visible
            if (markersVisible) {
              marker.addTo(map);
            }
            
            marker.on('click', function () {
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(
                    JSON.stringify({
                      type: 'station_click',
                      payload: { ...s, status: getStatusText(aqi) }
                    })
                  );
                }
                map.setView([s.lat, s.lng], 12);
              } catch (err) {
                console.error('postMessage error', err);
              }
            });

            stationMarkers.push(marker);
          });

          console.log('Updated stations:', stationMarkers.length, 'out of', newStations.length, 'total');
        } catch (e) {
          console.error('updateStations error', e);
        }
      };

      // Function để toggle markers visibility
      window.__toggleMarkers = function (visible) {
        try {
          markersVisible = visible;
          stationMarkers.forEach(marker => {
            if (visible) {
              marker.addTo(map);
            } else {
              map.removeLayer(marker);
            }
          });
          console.log('Markers visibility:', visible);
        } catch (e) {
          console.error('toggleMarkers error', e);
        }
      };

      // Function để toggle heatmap visibility
      window.__toggleHeatmap = function (visible) {
        try {
          if (wmsLayer) {
            if (visible) {
              wmsLayer.addTo(map);
            } else {
              map.removeLayer(wmsLayer);
            }
            console.log('Heatmap visibility:', visible);
          }
        } catch (e) {
          console.error('toggleHeatmap error', e);
        }
      };

      map.on('click', function (e) {
        try {
          const { lat, lng } = e.latlng;
          ensureExternalMarker(lat, lng);
          
          // Send map click event to React Native
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                type: 'map_click',
                payload: { lat, lng }
              })
            );
          }
        } catch (err) {
          console.error('map click error', err);
        }
      });
    </script>
  </body>
</html>
`;

