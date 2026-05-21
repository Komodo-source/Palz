import React, { useRef, useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PALETTE = {
  rose: '#FF8FA3',
  rosePale: '#FFF0F3',
  textDark: '#4A3728',
  textMid: '#7A6B60',
};

// Builds the full-page Leaflet HTML with the given default coordinates
function buildMapHtml(lat, lng) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;font-family:system-ui,sans-serif}
    #hint{
      position:fixed;top:12px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.7);color:#fff;border-radius:20px;
      padding:7px 16px;font-size:13px;z-index:9999;white-space:nowrap;
      pointer-events:none;
    }
    #confirm-btn{
      position:fixed;bottom:22px;left:50%;transform:translateX(-50%);
      background:#FF8FA3;color:#fff;border:none;border-radius:14px;
      padding:14px 36px;font-size:15px;font-weight:700;cursor:pointer;
      z-index:9999;box-shadow:0 4px 16px rgba(255,143,163,0.45);
      min-width:200px;text-align:center;
    }
    .leaflet-control-attribution{display:none}
  </style>
</head>
<body>
<div id="map"></div>
<div id="hint">Appuie pour placer l'épingle 📍</div>
<button id="confirm-btn" onclick="confirmLocation()">Confirmer ce lieu</button>
<script>
  var selectedLat=${lat}, selectedLng=${lng};
  var map=L.map('map',{zoomControl:true}).setView([selectedLat,selectedLng],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  var pinIcon=L.divIcon({
    html:'<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">📍</div>',
    iconSize:[32,32],iconAnchor:[16,32],className:''
  });
  var marker=L.marker([selectedLat,selectedLng],{draggable:true,icon:pinIcon}).addTo(map);

  function hideHint(){document.getElementById('hint').style.opacity='0';}

  marker.on('dragend',function(e){
    var p=marker.getLatLng();
    selectedLat=p.lat;selectedLng=p.lng;hideHint();
  });

  map.on('click',function(e){
    selectedLat=e.latlng.lat;selectedLng=e.latlng.lng;
    marker.setLatLng(e.latlng);hideHint();
  });

  function confirmLocation(){
    var msg=JSON.stringify({type:'LOCATION_SELECTED',lat:selectedLat,lng:selectedLng});
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg);}
    else{window.postMessage(msg,'*');}
  }
</script>
</body>
</html>`;
}

export default function MapPicker({ visible, onClose, onConfirm, initialLat = 48.8566, initialLng = 2.3522 }) {
  const webViewRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Lazy-load WebView to avoid bundling issues on web
  const [WebView, setWebView] = useState(null);
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const wv = require('react-native-webview').WebView;
      setWebView(() => wv);
    } catch {
      setWebView(null);
    }
  }, []);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOCATION_SELECTED') {
        onConfirm({ latitude: data.lat, longitude: data.lng });
      }
    } catch {}
  };

  const html = buildMapHtml(initialLat, initialLng);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={24} color={PALETTE.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choisir sur la carte</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Map */}
        {Platform.OS === 'web' || !WebView ? (
          <View style={styles.unsupported}>
            <Ionicons name="map-outline" size={48} color={PALETTE.rose} />
            <Text style={styles.unsupportedTitle}>Carte non disponible</Text>
            <Text style={styles.unsupportedHint}>
              Utilise "Saisir" pour entrer une adresse ou "Ma position" pour utiliser le GPS.
            </Text>
            <TouchableOpacity style={styles.closeAltBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeAltBtnText}>Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mapWrap}>
            {!mapReady && (
              <View style={styles.mapLoader}>
                <ActivityIndicator size="large" color={PALETTE.rose} />
                <Text style={styles.mapLoaderText}>Chargement de la carte...</Text>
              </View>
            )}
            <WebView
              ref={webViewRef}
              source={{ html }}
              style={[styles.webView, !mapReady && { opacity: 0 }]}
              onLoadEnd={() => setMapReady(true)}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0E0',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF0F3',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: PALETTE.textDark },
  mapWrap: { flex: 1, position: 'relative' },
  webView: { flex: 1 },
  mapLoader: {
    position: 'absolute', inset: 0, zIndex: 10,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#fff',
  },
  mapLoaderText: { fontSize: 14, color: PALETTE.textMid },
  unsupported: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32,
  },
  unsupportedTitle: { fontSize: 18, fontWeight: '700', color: PALETTE.textDark },
  unsupportedHint: { fontSize: 14, color: PALETTE.textMid, textAlign: 'center', lineHeight: 20 },
  closeAltBtn: {
    marginTop: 12, backgroundColor: PALETTE.rose,
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14,
  },
  closeAltBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
