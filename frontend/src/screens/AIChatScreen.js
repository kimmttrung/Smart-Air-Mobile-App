/**
 * AIChatScreen.js
 * Light-mode chat UI styled like ChatGPT.
 * Features: OpenAI-compatible API, animated typing dots, chat history tab.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { scaleFont } from '../constants/responsive';
import { sendChatMessage } from '../services/chatbotService';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & palette  (light mode)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:           '#f7f8fc',
  surface:      '#ffffff',
  surfaceAlt:   '#f0f2f8',
  border:       '#e2e5ef',
  accent:       '#10a37f',
  accentLight:  '#e6f5f1',
  accentDark:   '#0d8a6a',
  userBubble:   '#10a37f',
  botBubble:    '#ffffff',
  errorBubble:  '#fff0f0',
  errorBorder:  '#fca5a5',
  text:         '#111827',
  textSec:      '#6b7280',
  textInv:      '#ffffff',
  textError:    '#dc2626',
  online:       '#22c55e',
};

const STORAGE_KEY = '@smartair_chat_history';
const MAX_SESSIONS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const buildHistory = (messages) =>
  messages
    .slice(1)
    .filter((m) => !m.isError)
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

const timeNow = () =>
  new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const dateLabel = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const WELCOME_MSG = () => ({
  id: 1,
  sender: 'bot',
  text: 'Xin chào! Tôi là trợ lý AI của SmartAir 👋\nBạn muốn biết gì về chất lượng không khí hôm nay?',
  time: timeNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TypingIndicator
// ─────────────────────────────────────────────────────────────────────────────
function TypingIndicator() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const cc = useRef(new Animated.Value(0)).current;
  const dots = [a, b, cc];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    anims.forEach((an) => an.start());
    return () => anims.forEach((an) => an.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={ty.wrap}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            ty.dot,
            {
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -5],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}
const ty = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 2, gap: 5 },
  dot:  { width: 7, height: 7, borderRadius: 999, backgroundColor: C.accent },
});

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ message, onRetry }) {
  const isUser  = message.sender === 'user';
  const isError = !!message.isError;

  return (
    <View style={[mb.row, isUser ? mb.rowUser : mb.rowBot]}>
      {!isUser && (
        <View style={[mb.avatar, isError ? mb.avatarErr : mb.avatarBot]}>
          <Text style={mb.avatarTxt}>{isError ? '!' : 'AI'}</Text>
        </View>
      )}

      <View style={[mb.wrap, isUser ? mb.wrapUser : mb.wrapBot]}>
        <View style={[mb.body, isUser ? mb.bodyUser : isError ? mb.bodyErr : mb.bodyBot]}>
          <Text style={[mb.txt, isUser ? mb.txtUser : isError ? mb.txtErr : mb.txtBot]}>
            {message.text}
          </Text>
        </View>

        {isError && message.retryText ? (
          <TouchableOpacity style={mb.retryBtn} onPress={() => onRetry(message.retryText)} activeOpacity={0.75}>
            <Text style={mb.retryTxt}>↺ Thử lại</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[mb.time, isUser ? mb.timeUser : mb.timeBot]}>{message.time}</Text>
      </View>

      {isUser && (
        <View style={[mb.avatar, mb.avatarUser]}>
          <Text style={mb.avatarTxt}>U</Text>
        </View>
      )}
    </View>
  );
}

const mb = StyleSheet.create({
  row:       { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end', paddingHorizontal: 12 },
  rowUser:   { justifyContent: 'flex-end' },
  rowBot:    { justifyContent: 'flex-start' },

  avatar:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarBot: { backgroundColor: C.accent },
  avatarUser:{ backgroundColor: '#6366f1', marginLeft: 8 },
  avatarErr: { backgroundColor: '#ef4444' },
  avatarTxt: { color: '#fff', fontWeight: '700', fontSize: scaleFont(11) },

  wrap:     { maxWidth: '78%' },
  wrapUser: { alignItems: 'flex-end' },
  wrapBot:  { marginLeft: 8, alignItems: 'flex-start' },

  body:     { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bodyUser: { backgroundColor: C.userBubble, borderBottomRightRadius: 4 },
  bodyBot:  {
    backgroundColor: C.botBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bodyErr:  { backgroundColor: C.errorBubble, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.errorBorder },

  txt:     { fontSize: scaleFont(14), lineHeight: 21 },
  txtUser: { color: '#fff' },
  txtBot:  { color: C.text },
  txtErr:  { color: C.textError },

  time:     { fontSize: scaleFont(10), marginTop: 4, color: C.textSec },
  timeUser: { alignSelf: 'flex-end' },
  timeBot:  { alignSelf: 'flex-start' },

  retryBtn: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: C.errorBorder },
  retryTxt: { fontSize: scaleFont(11), color: C.textError, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Quick suggestions
// ─────────────────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: '🌫️ AQI hôm nay',        text: 'AQI hôm nay ở Hà Nội thế nào?' },
  { label: '💊 Lời khuyên sức khỏe', text: 'Lời khuyên sức khỏe khi ô nhiễm không khí?' },
  { label: '📅 Dự báo tuần',         text: 'Dự báo chất lượng không khí tuần này?' },
  { label: '😷 Cách bảo vệ',         text: 'Cách phòng tránh ô nhiễm không khí hiệu quả?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HistoryTab
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab({ sessions, onLoad, onDelete, onClearAll }) {
  if (sessions.length === 0) {
    return (
      <View style={ht.empty}>
        <Text style={ht.emptyIcon}>🗂️</Text>
        <Text style={ht.emptyTitle}>Chưa có lịch sử</Text>
        <Text style={ht.emptyDesc}>Các cuộc trò chuyện sẽ được lưu tự động sau khi bạn gửi tin.</Text>
      </View>
    );
  }

  return (
    <View style={ht.root}>
      <View style={ht.topBar}>
        <Text style={ht.topBarTitle}>Lịch sử trò chuyện</Text>
        <TouchableOpacity onPress={onClearAll} activeOpacity={0.75}>
          <Text style={ht.clearAll}>Xóa tất cả</Text>
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {sessions.map((s) => {
          const preview = s.messages.find((m) => m.sender === 'user')?.text || '(Trống)';
          return (
            <TouchableOpacity
              key={s.id}
              style={ht.item}
              onPress={() => onLoad(s)}
              activeOpacity={0.8}
            >
              <View style={ht.itemLeft}>
                <Text style={ht.itemIcon}>💬</Text>
              </View>
              <View style={ht.itemBody}>
                <Text style={ht.itemPreview} numberOfLines={2}>{preview}</Text>
                <Text style={ht.itemDate}>{dateLabel(s.createdAt)}</Text>
                <Text style={ht.itemCount}>{s.messages.filter(m => m.sender === 'user').length} câu hỏi</Text>
              </View>
              <TouchableOpacity
                style={ht.delBtn}
                onPress={() => onDelete(s.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={ht.delTxt}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ht = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  topBarTitle:{ fontSize: scaleFont(15), fontWeight: '700', color: C.text },
  clearAll:   { fontSize: scaleFont(13), color: '#ef4444', fontWeight: '600' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: scaleFont(17), fontWeight: '700', color: C.text },
  emptyDesc:  { fontSize: scaleFont(13), color: C.textSec, textAlign: 'center', lineHeight: 20 },

  item:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  itemLeft:   { marginRight: 12 },
  itemIcon:   { fontSize: 24 },
  itemBody:   { flex: 1, gap: 3 },
  itemPreview:{ fontSize: scaleFont(13), color: C.text, fontWeight: '500', lineHeight: 19 },
  itemDate:   { fontSize: scaleFont(11), color: C.textSec },
  itemCount:  { fontSize: scaleFont(11), color: C.accent, fontWeight: '600' },
  delBtn:     { padding: 4 },
  delTxt:     { fontSize: scaleFont(14), color: C.textSec, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AIChatScreen() {
  const [tab, setTab] = useState('chat'); // 'chat' | 'history'
  const [messages, setMessages] = useState([WELCOME_MSG()]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(() => Date.now().toString());

  const scrollRef   = useRef(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Load history from storage on mount ──
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSessions(JSON.parse(raw));
      } catch (_) {}
    })();
  }, []);

  // ── Save current session whenever messages change ──
  useEffect(() => {
    if (messages.length <= 1) return; // don't save empty/welcome-only chats
    const session = { id: sessionId, createdAt: new Date().toISOString(), messages };
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      const updated  = [session, ...filtered].slice(0, MAX_SESSIONS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [messages, sessionId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  // ── Send ──
  const send = useCallback(
    async (textParam) => {
      const text = (textParam ?? input).trim();
      if (!text || isTyping) return;

      const historyBeforeSend = buildHistory(messagesRef.current);
      const userMsg = { id: Date.now(), sender: 'user', text, time: timeNow() };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);

      try {
        const reply = await sendChatMessage(text, historyBeforeSend);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, sender: 'bot', text: reply, time: timeNow() },
        ]);
      } catch (err) {
        console.error('[AIChatScreen]', err.message);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, sender: 'bot', text: err.message, time: timeNow(), isError: true, retryText: text },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping]
  );

  const handleRetry = useCallback(
    (retryText) => {
      setMessages((prev) => prev.filter((m) => m.retryText !== retryText));
      send(retryText);
    },
    [send]
  );

  // ── New chat ──
  const startNewChat = useCallback(() => {
    setMessages([WELCOME_MSG()]);
    setSessionId(Date.now().toString());
    setInput('');
    setTab('chat');
  }, []);

  // ── Load session ──
  const loadSession = useCallback((session) => {
    setMessages(session.messages);
    setSessionId(session.id);
    setTab('chat');
  }, []);

  // ── Delete session ──
  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  // ── Clear all ──
  const clearAllSessions = useCallback(() => {
    Alert.alert(
      'Xóa toàn bộ lịch sử',
      'Bạn có chắc muốn xóa tất cả các cuộc trò chuyện?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: () => {
            setSessions([]);
            AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
          },
        },
      ]
    );
  }, []);

  const showSuggestions = messages.length <= 1 && !isTyping;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Text style={s.headerIconText}>✦</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>SmartAir AI</Text>
            <View style={s.headerOnline}>
              <View style={s.onlineDot} />
              <Text style={s.onlineTxt}>Online</Text>
            </View>
          </View>
        </View>

        {/* New chat button */}
        <TouchableOpacity style={s.newChatBtn} onPress={startNewChat} activeOpacity={0.75}>
          <Text style={s.newChatTxt}>✏️ Mới</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ── */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabItem, tab === 'chat' && s.tabItemActive]}
          onPress={() => setTab('chat')}
          activeOpacity={0.75}
        >
          <Text style={[s.tabTxt, tab === 'chat' && s.tabTxtActive]}>💬 Trò chuyện</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabItem, tab === 'history' && s.tabItemActive]}
          onPress={() => setTab('history')}
          activeOpacity={0.75}
        >
          <Text style={[s.tabTxt, tab === 'history' && s.tabTxtActive]}>
            🗂️ Lịch sử {sessions.length > 0 ? `(${sessions.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab content ── */}
      {tab === 'history' ? (
        <HistoryTab
          sessions={sessions}
          onLoad={loadSession}
          onDelete={deleteSession}
          onClearAll={clearAllSessions}
        />
      ) : (
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={s.msgList}
            contentContainerStyle={s.msgListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onRetry={handleRetry} />
            ))}

            {/* Typing bubble */}
            {isTyping && (
              <View style={[mb.row, mb.rowBot, { paddingHorizontal: 12 }]}>
                <View style={[mb.avatar, mb.avatarBot]}>
                  <Text style={mb.avatarTxt}>AI</Text>
                </View>
                <View style={[mb.body, mb.bodyBot, { marginLeft: 8 }]}>
                  <TypingIndicator />
                </View>
              </View>
            )}

            {/* Suggestions */}
            {showSuggestions && (
              <View style={s.suggestions}>
                <Text style={s.sugTitle}>Gợi ý câu hỏi</Text>
                <View style={s.sugGrid}>
                  {SUGGESTIONS.map((sug) => (
                    <TouchableOpacity
                      key={sug.text}
                      style={s.sugBtn}
                      onPress={() => send(sug.text)}
                      activeOpacity={0.75}
                    >
                      <Text style={s.sugBtnTxt}>{sug.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={s.inputArea}>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="Hỏi về chất lượng không khí..."
                placeholderTextColor={C.textSec}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => send()}
                returnKeyType="send"
                multiline
                editable={!isTyping}
                selectionColor={C.accent}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || isTyping) && s.sendBtnOff]}
                onPress={() => send()}
                disabled={!input.trim() || isTyping}
                activeOpacity={0.8}
              >
                <Text style={s.sendTxt}>↑</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.disclaimer}>
              SmartAir AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
            </Text>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — Light mode
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { color: '#fff', fontSize: scaleFont(20), fontWeight: '800' },
  headerTitle:    { fontSize: scaleFont(17), fontWeight: '700', color: C.text, letterSpacing: 0.2 },
  headerOnline:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:      { width: 7, height: 7, borderRadius: 999, backgroundColor: C.online },
  onlineTxt:      { fontSize: scaleFont(11), color: C.online, fontWeight: '600' },
  newChatBtn:     {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    borderWidth: 1,
    borderColor: C.accent,
  },
  newChatTxt: { fontSize: scaleFont(12), color: C.accentDark, fontWeight: '700' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: C.accent },
  tabTxt:        { fontSize: scaleFont(13), color: C.textSec, fontWeight: '500' },
  tabTxtActive:  { color: C.accent, fontWeight: '700' },

  // Message list
  msgList:        { flex: 1 },
  msgListContent: { paddingTop: 16, paddingBottom: 12 },

  // Suggestions
  suggestions: { paddingHorizontal: 16, marginTop: 24, marginBottom: 8 },
  sugTitle:    {
    fontSize: scaleFont(11),
    color: C.textSec,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sugGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugBtn:      {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    borderWidth: 1,
    borderColor: C.accent,
  },
  sugBtnTxt:   { fontSize: scaleFont(12), color: C.accentDark, fontWeight: '600' },

  // Input
  inputArea: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: scaleFont(14),
    color: C.text,
    paddingVertical: 6,
    marginRight: 8,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  sendBtnOff: { backgroundColor: '#d1d5db' },
  sendTxt:    { color: '#fff', fontSize: scaleFont(18), fontWeight: '700', lineHeight: 22 },
  disclaimer: {
    fontSize: scaleFont(10),
    color: C.textSec,
    textAlign: 'center',
    marginTop: 8,
  },
});
